const TelegramBotLib = require('node-telegram-bot-api');
const TelegramBot = TelegramBotLib.default || TelegramBotLib;
const { PDFDocument } = require('pdf-lib');
const { createClient } = require('@supabase/supabase-js');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');

const bot = new TelegramBot(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('Bot berjalan.');

    const msg = req.body.message;
    if (!msg) return res.status(200).send('OK');

    const chatId = msg.chat.id;

    try {
        if (msg.text) {
            await bot.sendMessage(chatId, 'Halo! Bot sudah aktif dan siap digunakan. Silakan upload foto QR Code Anda terlebih dahulu.');
        }
        // 2. Tangani QR Code (dikirim sebagai Foto ATAU File Gambar)
        else if (msg.photo || (msg.document && msg.document.mime_type && msg.document.mime_type.startsWith('image/'))) {
            // Ambil ID file tergantung cara user mengirimnya
            const fileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : msg.document.file_id;
            
            const fileLink = await bot.getFileLink(fileId);
            const response = await fetch(fileLink);
            const buffer = await response.arrayBuffer();
            
            const { error } = await supabase.storage
                .from('bot-data')
                .upload('qr_code.jpg', buffer, { upsert: true });
                
            if (error) throw error;
            
            // Pesan konfirmasi QR
            await bot.sendMessage(chatId, '✅ QR Code berhasil disimpan! Sekarang kirimkan file PDF-nya.');
        } 
        
        // 3. Tangani PDF
        else if (msg.document && msg.document.mime_type === 'application/pdf') {
            await bot.sendMessage(chatId, 'Memproses PDF...');
            
            const pdfLink = await bot.getFileLink(msg.document.file_id);
            const pdfRes = await fetch(pdfLink);
            const pdfBuffer = await pdfRes.arrayBuffer();

            // 1. Lacak koordinat teks "Bioindustri"
            const dataUint8Array = new Uint8Array(pdfBuffer);
            const loadingTask = pdfjsLib.getDocument({ data: dataUint8Array });
            const pdfDocPdfjs = await loadingTask.promise;
            const pagePdfjs = await pdfDocPdfjs.getPage(1);
            const textContent = await pagePdfjs.getTextContent();
            
            let targetY = 320; // Titik default jika teks tidak ditemukan
            for (const item of textContent.items) {
                if (item.str && item.str.includes('Bioindustri')) {
                    targetY = item.transform[5]; // Mengambil koordinat Y (vertikal)
                    break;
                }
            }

            const { data, error } = await supabase.storage.from('bot-data').download('qr_code.jpg');
            if (error) return bot.sendMessage(chatId, 'Upload foto QR Code terlebih dahulu.');
            const qrBuffer = await data.arrayBuffer();

            // 2. Tempel QR di koordinat yang ditemukan
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            let qrImage;
            try { qrImage = await pdfDoc.embedJpg(qrBuffer); } 
            catch (e) { qrImage = await pdfDoc.embedPng(qrBuffer); }

            const firstPage = pdfDoc.getPages()[0];
            const { width } = firstPage.getSize();

            firstPage.drawImage(qrImage, { 
                x: width - 85,    // Kolom tanda tangan di kanan
                y: targetY - 5,   // Sejajar dengan baris teks
                width: 22, 
                height: 22 
            });

            const pdfBytes = await pdfDoc.save();

            await bot.sendDocument(chatId, Buffer.from(pdfBytes), {}, { 
                filename: msg.document.file_name || 'Output_Signed.pdf', 
                contentType: 'application/pdf' 
            });
        }
    } catch (error) {
        console.error(error);
        await bot.sendMessage(chatId, 'Terjadi kesalahan saat memproses dokumen.');
    }

    res.status(200).send('OK');
}