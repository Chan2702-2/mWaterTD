# Survey Pro - Web Survey System Mobile-First

Aplikasi survey lapangan berbasis web yang dioptimalkan untuk penggunaan di smartphone. Mirip dengan mWater Surveyor namun dengan UI yang lebih clean dan modern.

## Fitur Utama

- ✅ **Mobile-First Design** - UI seperti aplikasi mobile dengan bottom navigation
- ✅ **Authentication** - Login/Daftar dengan Supabase Auth
- ✅ **Dashboard** - Statistik dan peta lokasi survey
- ✅ **Form Builder** - Admin dapat membuat form survey dinamis
- ✅ **Survey Entry** - Petugas dapat mengisi survey dengan kamera & GPS
- ✅ **Map View** - Tampilkan lokasi survey di peta Leaflet
- ✅ **Data List** - Lihat semua data dengan search & filter
- ✅ **Export Data** - Export ke CSV/Excel
- ✅ **Photo Storage** - Foto disimpan di Supabase Storage
- ✅ **PWA Support** - Dapat diinstal sebagai aplikasi mobile
- ✅ **Offline Mode** - Service worker untuk caching

## Tech Stack

- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Map**: Leaflet.js
- **Hosting**: Vercel (recommended)

## Struktur Project

```
survey-pro/
├── index.html              # Halaman utama (Login + Dashboard)
├── form-builder.html       # Admin - Buat form survey
├── css/
│   └── styles.css          # Custom Tailwind styles
├── js/
│   ├── supabase.js        # Supabase client & helpers
│   └── app.js             # Main app logic
├── sw.js                  # Service Worker (PWA)
├── manifest.json          # PWA manifest
├── supabase-setup.sql     # Database schema
├── tailwind.config.js     # Tailwind config
└── package.json
```

## Cara Setup

### 1. Setup Supabase

1. Buat project di [Supabase](https://supabase.com)
2. Buka **SQL Editor** dan jalankan script di [`supabase-setup.sql`](supabase-setup.sql)
3. Buka **Settings > API** dan salin:
   - Project URL
   - `anon` public key

### 2. Konfigurasi Supabase Client

Buka [`js/supabase.js`](js/supabase.js) dan ganti:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 3. Deploy ke Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Atau cukup push ke GitHub dan connect ke Vercel.

### 4. Setup Admin User

1. Daftar user baru melalui aplikasi
2. Buka Supabase **Table Editor > profiles**
3. Edit user dan ubah `role` menjadi `admin`

## Cara Penggunaan

### Untuk Admin:

1. Login sebagai admin
2. Buka **Form Builder** (tautan khusus)
3. Buat form survey dengan menambahkan pertanyaan
4. Pilih tipe pertanyaan (text, number, photo, GPS, dll)
5. Simpan form

### Untuk Surveyor:

1. Login sebagai surveyor
2. Pilih form survey di halaman Survey
3. Isi pertanyaan survey
4. Ambil foto dengan kamera HP
5. Lokasi GPS akan diambil otomatis
6. Submit survey

## Tipe Pertanyaan Tersedia

| Tipe | Deskripsi |
|------|-----------|
| `text` | Input teks pendek |
| `number` | Input angka |
| `textarea` | Input teks panjang |
| `date` | Input tanggal |
| `dropdown` | Pilihan satu (dropdown) |
| `checkbox` | Pilihan banyak |
| `photo` | Upload foto (kamera) |
| `gps` | Koordinat GPS |

## API Reference

### Auth
```javascript
// Login
await SurveyApp.Auth.signIn(email, password);

// Daftar
await SurveyApp.Auth.signUp(email, password, { name, role });

// Logout
await SurveyApp.Auth.signOut();
```

### Forms
```javascript
// Ambil semua form
const forms = await SurveyApp.Forms.getAll();

// Ambil form berdasarkan ID
const form = await SurveyApp.Forms.getById(formId);
```

### Surveys
```javascript
// Ambil semua survey
const surveys = await SurveyApp.Surveys.getAll();

// Stats
const stats = await SurveyApp.Surveys.getStats();
```

## PWA Installation

Aplikasi mendukung PWA (Progressive Web App):
- Install ke homescreen HP
- Bekerja offline (dengan cache)
- Notifikasi (jika dikonfigurasi)

## Dark Mode

Dark mode dapat ditambahkan dengan:
1. Menambahkan class `dark` ke `<html>`
2. Mengkonfigurasi Tailwind untuk dark mode

## Keamanan

- Semua tabel menggunakan Row Level Security (RLS)
- Hanya admin yang dapat membuat/mengubah form
- Surveyor hanya dapat melihat data sendiri
- Foto diupload ke private bucket

## Lisensi

MIT License
# mWaterTD
