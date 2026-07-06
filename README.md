# 🤖 AddQR Bot Telegram

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-Bot-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

**Bot Telegram yang secara otomatis menambahkan QR Code ke dalam file PDF.**  
Kirim foto QR → kirim PDF → terima PDF yang sudah tertempel QR. Semudah itu! 🚀

</div>

---

## ✨ Fitur

| Fitur | Keterangan |
|---|---|
| 📷 **Simpan QR Code** | Kirim foto QR ke bot, langsung tersimpan untuk digunakan |
| 📄 **Sisipkan QR ke PDF** | Kirim file PDF, bot akan menempelkan QR di halaman pertama |
| 🔁 **Update QR Kapan Saja** | Kirim foto baru untuk mengganti QR yang tersimpan |
| 🏷️ **Nama File Asli** | Output PDF dikembalikan dengan nama file yang sama seperti yang dikirim |
| 🛡️ **Stabil & Crash-proof** | Error handling lengkap, bot tidak crash saat ada gangguan jaringan |

---

## 📋 Cara Penggunaan

### Langkah 1 — Simpan QR Code
Kirim **foto** QR Code kamu ke bot melalui chat Telegram.

> ✅ Bot akan membalas: *"QR Code berhasil disimpan/diperbarui!"*

### Langkah 2 — Kirim File PDF
Kirim file **PDF** yang ingin ditambahkan QR Code-nya.

> ⏳ Bot akan membalas: *"Memproses PDF..."*  
> ✅ Lalu mengirimkan kembali file PDF yang sudah tertempel QR Code.

### Langkah 3 — Ganti QR (Opsional)
Cukup kirim foto QR baru kapan saja untuk mengganti QR yang tersimpan.

---

## 🛠️ Instalasi & Menjalankan Bot

### Prasyarat
- [Node.js](https://nodejs.org/) versi 18 atau lebih baru
- Token Bot Telegram dari [@BotFather](https://t.me/BotFather)

### 1. Clone Repositori
```bash
git clone https://github.com/Rahadyan-AL/AddQR_bot_Telegram.git
cd AddQR_bot_Telegram
```

### 2. Install Dependensi
```bash
npm install
```

### 3. Konfigurasi Token Bot
Buka file `bot.js` dan ganti token dengan token bot milikmu:
```js
// bot.js, baris 12
const token = 'ISI_TOKEN_BOT_KAMU_DI_SINI';
```

### 4. Jalankan Bot
```bash
node bot.js
```

> Output yang diharapkan: `Bot sedang berjalan...`

---

## ⚙️ Konfigurasi Posisi QR

Posisi dan ukuran QR pada PDF dapat disesuaikan di dalam `bot.js`:

```js
// Koordinat dihitung dari sudut KIRI BAWAH halaman (satuan: points)
const xCoord = 510;  // Posisi horizontal
const yCoord = 320;  // Posisi vertikal
const qrSize = 22;   // Ukuran QR (lebar & tinggi dalam points)
```

> 💡 **Tips:** 1 inch = 72 points. Ukuran halaman A4 adalah 595 × 842 points.

---

## 📦 Dependensi

| Package | Fungsi |
|---|---|
| [`node-telegram-bot-api`](https://www.npmjs.com/package/node-telegram-bot-api) | Komunikasi dengan Telegram Bot API |
| [`pdf-lib`](https://www.npmjs.com/package/pdf-lib) | Membaca dan memodifikasi file PDF |

---

## 📁 Struktur Proyek

```
AddQR_bot_Telegram/
├── bot.js           # File utama bot
├── package.json     # Konfigurasi proyek & dependensi
├── .gitignore       # Exclude file sensitif dari git
└── README.md        # Dokumentasi ini
```

> **Catatan:** `qr_code.jpg` (file QR yang tersimpan) tidak di-upload ke repositori karena bersifat data lokal.

---

## 🔒 Keamanan

> [!WARNING]
> Jangan pernah meng-commit token bot kamu ke repositori publik! Simpan token di variabel environment atau file `.env` yang sudah di-gitignore.

Cara yang lebih aman menggunakan `.env`:
```bash
# Install dotenv
npm install dotenv
```
```js
// Di bot.js
require('dotenv').config();
const token = process.env.BOT_TOKEN;
```
```env
# File .env (jangan di-commit!)
BOT_TOKEN=token_bot_kamu_di_sini
```

---

## 📄 Lisensi

Proyek ini menggunakan lisensi [MIT](LICENSE).

---

<div align="center">
  Dibuat dengan ❤️ oleh <a href="https://github.com/Rahadyan-AL">Rahadyan-AL</a>
</div>
