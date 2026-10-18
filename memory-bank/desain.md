# Spesifikasi Desain

## Warna (Hanya Ini)
- Biru utama #1E5AA8: tombol, link aktif, border hover
- Merah #D32F2F: badge gagal, garis bawah judul
- Hijau #4CAF50: badge sukses (Siap)
- Teks #212121: body, judul kartu
- Teks Muted #666666: tanggal, jumlah views
- Latar Halaman #F3F4F6 (bg-gray-100): latar belakang utama
- Latar Kartu #FFFFFF: kartu modul dan panel viewer
- Border #E0E0E0: garis tipis pemisah

## Aturan Keras
- **DILARANG TOTAL MENGGUNAKAN GRADIENT** di UI (header, tombol, background). Gradien hanya boleh ada di dalam gambar cover PDF.
- Tanpa shadow berwarna. Hanya shadow tipis abu-abu (hover pada kartu).
- Radius: 8px (rounded-lg) untuk kartu dan panel.
- Font: system-ui sans-serif.

## Layout Katalog (Halaman Utama)
- **Header:** Latar putih, border bawah. Logo `logo-1.png` di kiri (tinggi sekitar 32-40px).
- **Judul Halaman:** "Katalog Modul" dengan ikon `library`. Ada garis pemisah di bawah judul.
- **Grid Modul:** 
  - Desktop: 4-5 kolom (`grid-cols-4 lg:grid-cols-5`).
  - Tablet: 3 kolom.
  - Mobile: 1-2 kolom.
  - Jarak antar kartu (gap): 20px (gap-5).

## Desain Kartu Modul (Cover)
- Berbentuk persegi panjang vertikal (aspect-ratio 3:4) untuk area cover.
- **Area Cover:** 
  - Latar abu-abu `#F8F9FA`.
  - Menampilkan halaman 1 dari PDF sebagai gambar (dirender via PDF.js).
  - Jika PDF belum siap, tampilkan ikon `file-text` besar di tengah.
  - Gambar cover harus memenuhi area (object-fit: cover) dan menempel ke tepi atas kartu.
- **Info Kartu (di bawah cover):**
  - Padding 16px.
  - Judul modul: tebal, maksimal 2 baris (`line-clamp-2`), warna hitam.
  - Tag kategori: kotak biru `#3B82F6` dengan teks putih kecil "Modul".
  - Meta row (paling bawah): Ikon mata (`eye`) + jumlah views di kiri, Tanggal dibuat di kanan.

## Layout Viewer (Saat Modul Dibuka)
- Katalog disembunyikan, viewer muncul memenuhi layar.
- Header viewer: Tombol Back (panah kiri) + Judul Modul.
- Latar area PDF: putih, dengan border tipis.
- Tombol Back berfungsi mengembalikan tampilan ke Katalog.