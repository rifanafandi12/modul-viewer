# Status Proyek

## Selesai
- Fondasi server dan endpoint streaming
- Fase 3: PDF.js render ke canvas; review manual desktop dan mobile lulus
- Fase 3b: Tailwind/Lucide polish viewer; review manual 11/11 lulus
- Fase 3c: Perbaikan temuan review keamanan; verifikasi otomatis lulus termasuk path traversal ditolak
- Fase 4a: autentikasi admin backend dengan bcrypt, regenerasi session ID saat login, endpoint login/logout, middleware `requireAuth`, dan konfigurasi cookie sesi.
- Fase 4a: tes auth lulus untuk password salah (401), login `admin123` (200 + cookie), serta route terlindungi (200).
- Fase 4b: halaman login, pemeriksaan sesi `/api/auth/me`, dan dashboard admin dengan tabel modul responsif.
- Fase 4c: upload admin dengan batas 20 MB, validasi tipe/signature, staging dan transaksi modul + job.
- Fase 4c: modal drag-and-drop dengan progress bar, refresh tabel tanpa reload, badge `Pending`/`Processing`, dan hapus modul beserta file melalui endpoint terproteksi.
- Tes curl upload/hapus lulus: tanpa sesi mendapat 401, admin dapat upload dan menghapus; skrip tidak mengharapkan status `ready`.
- Verifikasi fondasi `scripts/verify.sh` lulus pada port 3130 karena port standar 3000 sedang digunakan; file verifikasi tidak diubah.

## Sedang Dikerjakan
- (kosong)

## Langkah Selanjutnya
- Fase 5: Konversi Office (belum dimulai).

## Masalah Diketahui (TODO, bukan bug)
- [2026-10-18] [Fase 4d] Tugas ditahan sebelum implementasi karena `git status` menunjukkan perubahan belum terselesaikan pada `package.json` dan `package-lock.json`. Mohon konfirmasi bahwa perubahan ini memang bagian dari pemasangan `pdf-lib` untuk Fase 4d atau bersihkan/commit terlebih dahulu; belum ada kode worker yang ditulis.
- [2026-10-18] Status hijau check-circle tampil di atas PDF setelah render; pertimbangkan toast atau hide di iterasi berikutnya.
- [2026-10-18] Fase 3 dan 3b di-commit bersamaan karena public/ belum terlacak Git sejak awal. Ke depan, commit setelah setiap fase.
- [2026-10-18] Lazy-load halaman PDF untuk modul besar — TODO Fase 4.
- [2026-10-18] Race condition dengan 2+ modul belum diuji (hanya 1 modul di fixture).
- [2026-10-18] express-session masih memakai `MemoryStore` bawaan; gunakan session store persisten/bersama sebelum produksi agar sesi tersedia lintas restart dan worker.
- [2026-10-18] Proses Node lain memakai port 3000 sehingga verifikasi dijalankan pada port alternatif.

## Masalah Review
- Pemeriksaan manual Fase 4c tidak menemukan temuan level tinggi. Codex CLI `/review` tidak dapat dijalankan karena lingkungan gagal mendeteksi direktori home.
