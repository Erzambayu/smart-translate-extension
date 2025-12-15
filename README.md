# 🌐 AI Translator - Chrome Extension

Ekstensi Chrome untuk menerjemahkan teks secara instan menggunakan berbagai layanan AI. Cukup blok teks dan terjemahan akan muncul otomatis!

![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)
![Chrome](https://img.shields.io/badge/chrome-extension-green.svg)

## ✨ Fitur Utama

- **🔤 Terjemahan Instan** - Blok teks di halaman web, popup terjemahan muncul otomatis
- **📝 Terjemahan di Text Box** - Blok teks di input field, konfirmasi untuk mengganti dengan terjemahan
- **🤖 Multi-Provider AI** - Pilih dari 5 layanan: OpenAI, Gemini, DeepSeek, DeepL, atau Custom API
- **🔍 Auto-Detect Bahasa** - Deteksi bahasa sumber secara otomatis
- **🌙 Adaptive Theme** - Popup menyesuaikan dengan tema halaman (terang/gelap)
- **🌍 18 Bahasa** - ID, EN, JA, KO, ZH, ES, FR, DE, PT, RU, AR, HI, TH, VI, NL, PL, TR, IT

---

## 📦 Cara Instalasi

### Langkah 1: Download Ekstensi
Download atau clone repository ini ke komputer Anda.

### Langkah 2: Buka Chrome Extensions
1. Buka browser Chrome
2. Ketik `chrome://extensions/` di address bar
3. Tekan Enter

### Langkah 3: Aktifkan Developer Mode
Aktifkan toggle **"Developer mode"** di pojok kanan atas.

### Langkah 4: Load Ekstensi
1. Klik tombol **"Load unpacked"**
2. Pilih folder ekstensi yang sudah di-download
3. Ekstensi akan muncul di daftar dan icon akan tampil di toolbar

### Langkah 5: Setup API Key
1. Klik icon ekstensi di toolbar
2. Pilih **Translation Service** (provider AI)
3. Masukkan **API Key** Anda
4. Set bahasa sumber dan target
5. Klik **Save Settings**

---

## 🔑 Cara Mendapatkan API Key

### 1. OpenAI (ChatGPT) 💰 BERBAYAR

OpenAI menyediakan API berbayar dengan model GPT-4o-mini yang cepat dan akurat.

**Cara Mendapatkan:**
1. Buka [platform.openai.com](https://platform.openai.com)
2. Buat akun atau login
3. Klik **"API keys"** di sidebar kiri
4. Klik **"Create new secret key"**
5. Copy API key (hanya ditampilkan sekali!)

**Harga:**
- GPT-4o-mini: ~$0.00015 per 1K input tokens
- Deposit minimum: $5
- [Lihat pricing lengkap](https://openai.com/pricing)

---

### 2. Google Gemini ✅ GRATIS (dengan limit)

Google Gemini menyediakan tier gratis yang cukup untuk penggunaan personal.

**Cara Mendapatkan:**
1. Buka [aistudio.google.com](https://aistudio.google.com)
2. Login dengan akun Google
3. Klik **"Get API Key"** di sidebar
4. Klik **"Create API key"**
5. Pilih project atau buat baru
6. Copy API key

**Harga:**
- **GRATIS**: 15 RPM (requests per minute), 1M tokens/hari
- Berbayar: mulai dari $0.075 per 1M tokens
- [Lihat pricing lengkap](https://ai.google.dev/pricing)

> 💡 **Rekomendasi untuk pemula!** Gemini gratis sudah cukup untuk penggunaan sehari-hari.

---

### 3. DeepSeek ✅ GRATIS (dengan limit) + SANGAT MURAH

DeepSeek menawarkan API dengan harga sangat kompetitif dan tier gratis.

**Cara Mendapatkan:**
1. Buka [platform.deepseek.com](https://platform.deepseek.com)
2. Buat akun dan login
3. Klik **"API keys"** di sidebar
4. Klik **"Create new API key"**
5. Copy API key

**Harga:**
- **GRATIS**: Credit awal untuk testing
- Berbayar: ~$0.14 per 1M input tokens (SANGAT MURAH!)
- [Lihat pricing lengkap](https://platform.deepseek.com/api-docs/pricing)

> 💡 **Pilihan terbaik untuk hemat biaya!** DeepSeek sangat murah dengan kualitas bagus.

---

### 4. DeepL 💰 BERBAYAR (+ Free tier terbatas)

DeepL terkenal dengan kualitas terjemahan yang sangat akurat, terutama untuk bahasa Eropa.

**Cara Mendapatkan:**
1. Buka [deepl.com/pro-api](https://www.deepl.com/pro-api)
2. Pilih plan **"DeepL API Free"** atau **"DeepL API Pro"**
3. Buat akun dan verifikasi
4. Masuk ke dashboard
5. Copy **Authentication Key**

**Harga:**
- **Free**: 500,000 karakter/bulan (perlu kartu kredit untuk verifikasi)
- Pro: €4.99/bulan + €20 per 1M karakter
- [Lihat pricing lengkap](https://www.deepl.com/pro#developer)

> ⚠️ DeepL Free memerlukan verifikasi kartu kredit, tapi tidak dicharge.

---

### 5. Custom API 🔧 OPSIONAL

Untuk pengguna advanced yang ingin menggunakan API translation sendiri.

**Format Request:**
```json
POST /your-endpoint
{
  "text": "Text to translate",
  "source_lang": "en",
  "target_lang": "id"
}
```

**Format Response yang Didukung:**
```json
{
  "translation": "Hasil terjemahan"
}
// atau
{
  "translatedText": "Hasil terjemahan"
}
```

---

## 🎯 Cara Penggunaan

### Menerjemahkan Teks Biasa
1. Buka halaman web apapun
2. **Blok/select teks** yang ingin diterjemahkan
3. Tunggu ~0.5 detik
4. Popup terjemahan akan muncul di atas teks
5. Klik **"Copy"** untuk menyalin terjemahan

### Menerjemahkan di Text Box/Input
1. Ketik teks di input field atau textarea
2. **Blok/select teks** yang ingin diterjemahkan
3. Modal konfirmasi akan muncul
4. Klik **"Replace"** untuk mengganti dengan terjemahan

### Tips
- Tekan **Escape** untuk menutup popup
- Klik di luar popup untuk menutup
- Gunakan **Auto Detect** untuk bahasa sumber jika tidak yakin

---

## ⚙️ Pengaturan

| Setting | Deskripsi |
|---------|-----------|
| **Translation Service** | Pilih provider AI (OpenAI, Gemini, DeepSeek, DeepL, Custom) |
| **API Key** | API key dari provider yang dipilih |
| **Your Language** | Bahasa sumber (atau Auto Detect) |
| **Target Language** | Bahasa tujuan terjemahan |
| **Smart Translate** | Auto-detect dan swap bahasa berdasarkan input |
| **Service On/Off** | Aktifkan/nonaktifkan layanan terjemahan tanpa menonaktifkan ekstensi |

---

## 🚫 Situs yang Dikecualikan

Ekstensi ini tidak aktif di situs berikut untuk menghindari konflik:
- WhatsApp Web
- Discord
- Slack
- Telegram
- Microsoft Teams
- Google Meet
- Zoom

---

## 🐛 Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Popup tidak muncul | Refresh halaman setelah install/update ekstensi |
| "API key not configured" | Masukkan API key di pengaturan ekstensi |
| "Connection error" | Periksa koneksi internet, atau reload ekstensi |
| Error dari API | Periksa API key valid dan masih ada quota/credit |
| Popup terpotong | Sudah diperbaiki - popup akan muncul di bawah jika atas penuh |

---

## 📝 Changelog

### v1.1.0
- ✨ Tambah tombol On/Off service di header popup
- 🎨 Status indicator dengan animasi pulse saat aktif
- ⚡ Layanan terjemahan bisa diaktifkan/nonaktifkan tanpa menonaktifkan ekstensi
- 🔔 Notifikasi status saat toggle service

### v1.0.0
- Initial release
- Support untuk OpenAI, Gemini, DeepSeek, DeepL, Custom API
- Auto-detect bahasa
- Adaptive dark/light theme
- Smart popup positioning

---

## 📄 License

MIT License - Bebas digunakan dan dimodifikasi.

---

## 🤝 Kontribusi

Pull requests dan issues sangat diterima!

---

Made with ❤️ for better translation experience
