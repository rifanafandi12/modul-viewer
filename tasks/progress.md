# Daftar Tugas

## Fase 1: Fondasi ✅
## Fase 2: Streaming Inti ✅
## Fase 3: Integrasi PDF.js ✅
## Fase 3b: Polish Desain Awal ✅
## Fase 3c: Perbaikan Temuan Keamanan ✅

## Fase 3d: Revisi Desain Katalog & Cover Modul ⬜ (TUGAS SAAT INI)
- [ ] Timpa `public/index.html`: hapus sidebar, buat grid layout katalog, tambah logo.
- [ ] Timpa `public/js/viewer.js`: 
      - Ganti logika render list menjadi render kartu grid.
      - Tambahkan fungsi `generateCoverThumbnail` untuk merender halaman 1 PDF ke dalam kartu secara asinkron.
      - Buat logika transisi: klik kartu -> sembunyikan katalog -> tampilkan viewer.
      - Buat tombol back di viewer untuk kembali ke katalog.
- [ ] Timpa `public/css/style.css`: hapus style sidebar lama, tambahkan style untuk cover (aspect-ratio 3:4).
- [ ] Uji manual di browser: pastikan cover muncul, klik masuk viewer, tombol back berfungsi.

## Fase 4: Upload & Kompresi ⬜