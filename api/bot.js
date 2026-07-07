const TelegramBotLib = require('node-telegram-bot-api');
const TelegramBot = TelegramBotLib.default || TelegramBotLib;
const { PDFDocument } = require('pdf-lib');
const { createClient } = require('@supabase/supabase-js');

// Inisialisasi Bot & Supabase (Tanpa polling)
const bot = new TelegramBot(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    // Vercel hanya memproses request POST dari webhook Telegram
    if (req.method !== 'POST') return res.status(200).send('Bot berjalan.');

    const msg = req.body.message;
    if (!msg) return res.status(200).send('OK');

    const chatId = msg.chat.id;

    try {
        // 1. Menangani Gambar (QR Code)
        if (msg.photo) {
            const photo = msg.photo[msg.photo.length - 1];
            const fileLink = await bot.getFileLink(photo.file_id);
            const response = await fetch(fileLink);
            const buffer = await response.arrayBuffer();
            
            // Upload & timpa file qr_code.jpg di Supabase
            const { error } = await supabase.storage
                .from('bot-data')
                .upload('qr_code.jpg', buffer, { upsert: true });
                
            if (error) throw error;
            await bot.sendMessage(chatId, 'QR Code berhasil disimpan/diperbarui!');
        } 
        
        // 2. Menangani Dokumen (PDF)
        else if (msg.document && msg.document.mime_type === 'application/pdf') {
            await bot.sendMessage(chatId, 'Memproses PDF...');
            
            // Unduh PDF dari Telegram
            const pdfLink = await bot.getFileLink(msg.document.file_id);
            const pdfRes = await fetch(pdfLink);
            const pdfBuffer = await pdfRes.arrayBuffer();

            // Unduh QR dari Supabase
            const { data, error } = await supabase.storage.from('bot-data').download('qr_code.jpg');
            if (error) return bot.sendMessage(chatId, 'Upload foto QR Code terlebih dahulu.');
            const qrBuffer = await data.arrayBuffer();

            // Load PDF dan QR Code
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            let qrImage;
            try { qrImage = await pdfDoc.embedJpg(qrBuffer); } 
            catch (e) { qrImage = await pdfDoc.embedPng(qrBuffer); }

            const firstPage = pdfDoc.getPages()[0];
            firstPage.drawImage(qrImage, { x: 510, y: 320, width: 22, height: 22 });

            const pdfBytes = await pdfDoc.save();

            // Kirim balik ke user menggunakan nama file asli
            await bot.sendDocument(chatId, Buffer.from(pdfBytes), {}, { 
                filename: msg.document.file_name || 'Output_Signed.pdf', 
                contentType: 'application/pdf' 
            });
        }
    } catch (error) {
        console.error(error);
        await bot.sendMessage(chatId, 'Terjadi kesalahan saat memproses dokumen.');
    }

    // Wajib merespon 200 OK agar Telegram tidak mengulang webhook terus-menerus
    res.status(200).send('OK');
}