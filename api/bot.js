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
    const userQrName = `qr_${chatId}.jpg`;

    try {
        // 1. TANGANI TEKS
        if (msg.text) {
            await bot.sendMessage(chatId, 'Sistem siap. Silakan upload foto/file QR Code Anda.');
        } 
        
        // 2. TANGANI UPLOAD QR (Simpan sementara)
        else if (msg.photo || (msg.document && msg.document.mime_type && msg.document.mime_type.startsWith('image/'))) {
            const fileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : msg.document.file_id;
            const fileLink = await bot.getFileLink(fileId);
            const response = await fetch(fileLink);
            const buffer = await response.arrayBuffer();
            
            const { error } = await supabase.storage
                .from('bot-data')
                .upload(userQrName, buffer, { upsert: true });
                
            if (error) throw error;
            await bot.sendMessage(chatId, '✅ QR Code diterima. Silakan kirim file PDF-nya.');
        } 
        
        // 3. TANGANI PDF & RESET DATA
        else if (msg.document && msg.document.mime_type === 'application/pdf') {
            await bot.sendMessage(chatId, 'Memproses PDF...');
            
            // Download file
            const pdfLink = await bot.getFileLink(msg.document.file_id);
            const pdfRes = await fetch(pdfLink);
            const pdfBuffer = await pdfRes.arrayBuffer();

            // Lacak Teks
            const dataUint8Array = new Uint8Array(pdfBuffer);
            const loadingTask = pdfjsLib.getDocument({ data: dataUint8Array });
            const pdfDocPdfjs = await loadingTask.promise;
            const pagePdfjs = await pdfDocPdfjs.getPage(1);
            const textContent = await pagePdfjs.getTextContent();
            
            let targetY = null; 
            for (const item of textContent.items) {
                if (item.str && item.str.toLowerCase().includes('bioindustri')) {
                    targetY = item.transform[5];
                    break;
                }
            }

            // Ambil QR dari Supabase
            const { data, error } = await supabase.storage.from('bot-data').download(userQrName);
            if (error) return bot.sendMessage(chatId, 'Sesi direset. Harap kirim ulang foto QR Code terlebih dahulu.');
            const qrBuffer = await data.arrayBuffer();

            // Modifikasi PDF
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            let qrImage;
            try { qrImage = await pdfDoc.embedJpg(qrBuffer); } 
            catch (e) { qrImage = await pdfDoc.embedPng(qrBuffer); }

            const firstPage = pdfDoc.getPages()[0];
            const { width, height } = firstPage.getSize();

            const finalY = targetY !== null ? targetY - 10 : height * 0.380; 
            const finalX = width * 0.81; 

            firstPage.drawImage(qrImage, { 
                x: finalX,
                y: finalY,
                width: 25, 
                height: 25 
            });

            const pdfBytes = await pdfDoc.save();

            // Kirim Dokumen
            await bot.sendDocument(chatId, Buffer.from(pdfBytes), {}, { 
                filename: msg.document.file_name || 'Output_Signed.pdf', 
                contentType: 'application/pdf' 
            });

            // OPTIMASI: Langsung hapus QR code pengguna dari Supabase setelah pemakaian
            await supabase.storage.from('bot-data').remove([userQrName]);
        }
    } catch (error) {
        console.error(error);
        await bot.sendMessage(chatId, 'Terjadi kesalahan sistem atau file terlalu berat untuk diproses.');
    }

    res.status(200).send('OK');
}