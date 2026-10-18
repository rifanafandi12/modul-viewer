# Daftar Tugas

## Fase 1: Fondasi ✅
## Fase 2: Streaming Inti ✅
## Fase 3: Integrasi PDF.js ✅
## Fase 3b: Polish Desain Awal ✅
## Fase 3c: Perbaikan Temuan Keamanan ✅

## Fase 3d: Revisi Desain Katalog & Cover Modul ✅
- [x] Timpa `public/index.html`: hapus sidebar, buat grid layout katalog, tambah logo.
- [x] Timpa `public/js/viewer.js`: render kartu grid + fungsi cover thumbnail.
- [x] Timpa `public/css/style.css`: styling cover 3:4.
- [x] Uji manual di browser: cover muncul, viewer berfungsi, anti-unduh aman.

## Fase 4a: Autentikasi Admin (Backend) ⬜ (TUGAS SAAT INI)
- [x] Update `docs/schema.sql` dengan tabel `users` (sudah tersedia; seed admin valid untuk `admin123`)
- [x] Install `bcrypt` dan `express-session` (sudah tersedia)
- [x] Buat `services/auth.js` (verifikasi password)
- [x] Buat `routes/auth.js` (endpoint login/logout)
- [x] Buat middleware `requireAuth`
- [x] Update `app.js` untuk mount `express-session` dan route auth
- [x] Tambahkan dan jalankan `scripts/test-auth.sh` (login gagal/berhasil dan akses route terlindungi)
- [x] `npm run verify` lulus

## Fase 4b: UI Login & Dashboard Admin ✅
- [x] Buat `public/login.html` dan `public/js/auth.js` dengan Tailwind CDN serta alur login.
- [x] Tambah endpoint sesi `GET /api/auth/me` dengan middleware `requireAuth`.
- [x] Buat dashboard `public/admin/index.html` dan `public/js/admin.js` dengan pemeriksaan sesi dan tabel modul responsif.
- [x] Tabel memakai wrapper `overflow-x-auto`; `public/css/style.css` tidak diubah.
- [x] Verifikasi otomatis dan tes endpoint `/api/auth/me` lulus.
## Fase 4c: Fitur Upload & CRUD Modul ⬜
## Fase 5: Konversi Office ⬜
