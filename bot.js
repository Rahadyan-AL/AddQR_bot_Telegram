require('dotenv').config();
const TelegramBotLib = require('node-telegram-bot-api');
const TelegramBot = TelegramBotLib.default || TelegramBotLib;
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Paksa IPv4 agar tidak timeout di jaringan yang tidak support IPv6
dns.setDefaultResultOrder('ipv4first');

const token = process.env.BOT_TOKEN;
// Inisialisasi tanpa polling dulu
const bot = new TelegramBot(token, { polling: false });

// Hapus webhook aktif (jika ada) lalu mulai polling
// dropPendingUpdates: true agar update lama tidak diproses ulang
bot.deleteWebhook({ drop_pending_updates: true })
    .then(() => {
        bot.startPolling();
        console.log('Bot sedang berjalan...');
    })
    .catch((err) => {
        console.error('Gagal menghapus webhook:', err.message);
        process.exit(1);
    });

// Tangani error polling agar bot tidak crash
bot.on('polling_error', (err) => {
    // EFATAL biasanya koneksi terputus sementara, bot akan retry otomatis
    if (err.code !== 'EFATAL') {
        console.error('[polling_error]', err.message);
    }
});

// Safety net: tangkap semua unhandled promise rejection
process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason?.message || reason);
});

const qrPath = path.join(__dirname, 'qr_code.jpg');

// 1. Menangani Gambar (QR Code)
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    // Ambil resolusi tertinggi
    const photo = msg.photo[msg.photo.length - 1]; 
    
    try {
        const fileLink = await bot.getFileLink(photo.file_id);
        const response = await fetch(fileLink);
        const buffer = await response.arrayBuffer();
        
        // Simpan dan timpa file QR lama
        fs.writeFileSync(qrPath, Buffer.from(buffer));
        bot.sendMessage(chatId, 'QR Code berhasil disimpan/diperbarui!');
    } catch (error) {
        bot.sendMessage(chatId, 'Gagal menyimpan QR Code.');
    }
});

// 2. Menangani Dokumen (PDF)
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    
    if (msg.document.mime_type !== 'application/pdf') {
        return bot.sendMessage(chatId, 'Harap kirim file dalam format PDF.');
    }

    if (!fs.existsSync(qrPath)) {
        return bot.sendMessage(chatId, 'Upload foto QR Code terlebih dahulu.');
    }

    try {
        bot.sendMessage(chatId, 'Memproses PDF...');
        
        // Unduh PDF
        const fileLink = await bot.getFileLink(msg.document.file_id);
        const pdfResponse = await fetch(fileLink);
        const pdfBuffer = await pdfResponse.arrayBuffer();

        // Load PDF dan QR Code
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const qrImageBytes = fs.readFileSync(qrPath);
        
        // Deteksi format gambar QR (JPG/PNG)
        let qrImage;
        try {
            qrImage = await pdfDoc.embedJpg(qrImageBytes);
        } catch (e) {
            qrImage = await pdfDoc.embedPng(qrImageBytes);
        }

        // Ambil halaman pertama
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];

        // --- SESUAIKAN KOORDINAT INI ---
        // (0,0) ada di sudut KIRI BAWAH halaman
        const xCoord = 510; 
        const yCoord = 320; 
        const qrSize = 22; 

        firstPage.drawImage(qrImage, {
            x: xCoord,
            y: yCoord,
            width: qrSize,
            height: qrSize,
        });

        // Simpan PDF baru
        const pdfBytes = await pdfDoc.save();
        const outputPath = path.join(__dirname, msg.document.file_name);
        fs.writeFileSync(outputPath, pdfBytes);

        // Kirim balik ke user
        await bot.sendDocument(chatId, outputPath);
        
        // Hapus file output setelah dikirim (opsional)
        try { fs.unlinkSync(outputPath); } catch (_) {}

    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, 'Terjadi kesalahan saat memproses dokumen.');
    }
});

