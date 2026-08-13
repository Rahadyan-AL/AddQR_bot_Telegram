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

    // --- TANGANI KLIK TOMBOL (CALLBACK QUERY) ---
    if (req.body.callback_query) {
        const callbackQuery = req.body.callback_query;
        const chatId = callbackQuery.message.chat.id;
        
        if (callbackQuery.data === 'use_old') {
            await bot.sendMessage(chatId, '✅ Sip! Silakan langsung kirimkan file PDF-nya.');
        } else if (callbackQuery.data === 'upload_new') {
            await bot.sendMessage(chatId, 'Silakan upload foto/file QR Code yang baru.');
        }
        
        await bot.answerCallbackQuery(callbackQuery.id);
        return res.status(200).send('OK');
    }

    const msg = req.body.message;
    if (!msg) return res.status(200).send('OK');

    const chatId = msg.chat.id;
    const userQrName = `qr_${chatId}.jpg`; // Nama file unik per user

    try {
        // 1. TANGANI TEKS BEBAS / START
        if (msg.text) {
            // Cek apakah user sudah punya file QR di Supabase
            const { data: files } = await supabase.storage.from('bot-data').list('', { search: userQrName });
            const hasOldQR = files && files.length > 0;

            if (hasOldQR) {
                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Gunakan QR Lama', callback_data: 'use_old' }],
                            [{ text: 'Upload QR Baru', callback_data: 'upload_new' }]
                        ]
                    }
                };
                await bot.sendMessage(chatId, 'Anda sudah memiliki QR Code yang tersimpan. Ingin pakai yang mana?', options);
            } else {
                await bot.sendMessage(chatId, 'Halo! Bot sudah aktif. Silakan upload foto/file QR Code Anda terlebih dahulu.');
            }
        } 
        
        // 2. TANGANI UPLOAD QR
        else if (msg.photo || (msg.document && msg.document.mime_type && msg.document.mime_type.startsWith('image/'))) {
            const fileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : msg.document.file_id;
            const fileLink = await bot.getFileLink(fileId);
            const response = await fetch(fileLink);
            const buffer = await response.arrayBuffer();
            
            const { error } = await supabase.storage
                .from('bot-data')
                .upload(userQrName, buffer, { upsert: true });
                
            if (error) throw error;
            await bot.sendMessage(chatId, '✅ QR Code berhasil disimpan! Sekarang kirimkan file PDF-nya.');
        } 
        
        // 3. TANGANI PDF
        else if (msg.document && msg.document.mime_type === 'application/pdf') {
            await bot.sendMessage(chatId, 'Memproses PDF...');
            
            const pdfLink = await bot.getFileLink(msg.document.file_id);
            const pdfRes = await fetch(pdfLink);
            const pdfBuffer = await pdfRes.arrayBuffer();

            const dataUint8Array = new Uint8Array(pdfBuffer);
            const loadingTask = pdfjsLib.getDocument({ data: dataUint8Array });
            const pdfDocPdfjs = await loadingTask.promise;
            const pagePdfjs = await pdfDocPdfjs.getPage(1);
            const textContent = await pagePdfjs.getTextContent();
            
            let targetY = null; 
            for (const item of textContent.items) {
                // Gunakan toLowerCase agar deteksi lebih kebal terhadap perubahan font/format
                if (item.str && item.str.toLowerCase().includes('bioindustri')) {
                    targetY = item.transform[5];
                    break;
                }
            }

            const { data, error } = await supabase.storage.from('bot-data').download(userQrName);
            if (error) return bot.sendMessage(chatId, 'Upload foto QR Code terlebih dahulu.');
            const qrBuffer = await data.arrayBuffer();

            const pdfDoc = await PDFDocument.load(pdfBuffer);
            let qrImage;
            try { qrImage = await pdfDoc.embedJpg(qrBuffer); } 
            catch (e) { qrImage = await pdfDoc.embedPng(qrBuffer); }

            const firstPage = pdfDoc.getPages()[0];
            const { width, height } = firstPage.getSize();

            // Logika Penentuan Posisi
            let finalY;
            if (targetY !== null) {
                // Jika teks PDF digital terbaca
                finalY = targetY - 10; 
            } else {
                // Jika PDF murni hasil scan gambar (fallback persentase proporsional)
                finalY = height * 0.380; 
            }

            // Gunakan persentase untuk X agar aman di ukuran kertas A4, F4, atau Letter
            const finalX = width * 0.81; 

            firstPage.drawImage(qrImage, { 
                x: finalX,
                y: finalY,
                width: 25, // Sedikit dibesarkan agar proporsional
                height: 25 
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