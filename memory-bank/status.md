# Status Proyek

## Selesai
- Fondasi server dan endpoint streaming
- Fase 3: PDF.js render ke canvas; review manual desktop dan mobile lulus
- Fase 3b: Tailwind/Lucide polish viewer; review manual 11/11 lulus
- Fase 3c: Perbaikan temuan review keamanan; verifikasi otomatis lulus termasuk path traversal ditolak
- Fase 4a: autentikasi admin backend dengan bcrypt, regenerasi session ID saat login, endpoint login/logout, middleware `requireAuth`, dan konfigurasi cookie sesi.
- Fase 4a: tes auth lulus untuk password salah (401), login `admin123` (200 + cookie), serta route terlindungi (200).
- Fase 4b: halaman login, pemeriksaan sesi `/api/auth/me`, dan dashboard admin dengan tabel modul responsif.
- Fase 4c (backend upload): `POST /api/modul` terautentikasi, validasi tipe dan signature file, batas 20 MB, nama file unik, transaksi modul + job, dan rollback/cleanup file.
- Fase 4c: tes curl upload tanpa sesi ditolak (401), admin dapat mengunggah (201) dan membuat job `pending`; data uji dibersihkan.
- Verifikasi fondasi `scripts/verify.sh` lulus di port 3124; `scripts/verify.sh` tidak diubah.

## Sedang Dikerjakan
- Fase 4c: fungsi CRUD modul selain upload (belum dimulai).

## Langkah Selanjutnya
- Lanjutkan Fase 4c: CRUD modul selain upload setelah diminta.

## Masalah Diketahui (TODO, bukan bug)
- [2026-10-18] Status hijau check-circle tampil di atas PDF setelah render; pertimbangkan toast atau hide di iterasi berikutnya.
- [2026-10-18] Fase 3 dan 3b di-commit bersamaan karena public/ belum terlacak Git sejak awal. Ke depan, commit setelah setiap fase.
- [2026-10-18] Lazy-load halaman PDF untuk modul besar — TODO Fase 4.
- [2026-10-18] Race condition dengan 2+ modul belum diuji (hanya 1 modul di fixture).
- [2026-10-18] express-session masih memakai `MemoryStore` bawaan; gunakan session store persisten/bersama sebelum produksi agar sesi tersedia lintas restart dan worker.
- [2026-10-18] Verifikasi standar memakai port 3000 yang sedang digunakan proses Node lain; suite yang sama berhasil saat dijalankan di port 3124.

## Masalah Review
- Pemeriksaan manual Fase 4c tidak menemukan temuan level tinggi. Codex CLI `/review` tidak dapat dijalankan karena lingkungan gagal mendeteksi direktori home.
