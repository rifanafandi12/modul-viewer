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
- Fase 4d: worker kompresi PDF memakai klaim job `SELECT ... FOR UPDATE` dalam transaksi, polling jeda 5 detik, heartbeat, pemulihan job stale, dan output disimpan atomik sebelum modul/job menjadi `ready`/`done`.
- Fase 4d: kompresi memakai API iLovePDF `compress` level `recommended`; hasil diunduh ke buffer, divalidasi dengan magic number `%PDF-`, lalu ditulis ke file sementara worker. Task remote dihapus setelah proses.
- Kredensial API iLovePDF dibaca dari `ILOVEPDF_PUBLIC_KEY` dan `ILOVEPDF_SECRET_KEY`; kedua nama variabel tersedia kosong di `.env.example`. Nilai `.env` tidak dibaca atau dicatat.
- Fase 4d: cakupan `try...catch` mencakup persiapan path hingga penyimpanan hasil; error asli dicatat ke `jobs.error`, job/modul ditandai `failed`, dan worker mencetak `Gagal memproses job` beserta ID dan error.
- Fase 4d: Word/PPT ditandai `failed` dengan pesan `Konversi Word/PPT belum didukung`; perintah `npm run worker` tersedia.
- `node --check` dan import SDK iLovePDF berhasil; `git diff --check` lulus. `npm.cmd run verify` exit code 0 dan semua pemeriksaan HTTP dilaporkan lulus, tetapi app yang diluncurkan script tidak dapat bind ke port 3000 (`EADDRINUSE`), sehingga endpoint kemungkinan dijawab oleh server yang sudah berjalan. Verifikasi otomatis tidak menjalankan kompresi melalui API.
- Fase 4e: API settings admin membaca dan menyimpan `compression_level` (`low`, `recommended`, `extreme`) dengan autentikasi; skema key-value dan seed awal ditambahkan ke `docs/schema.sql`.
- Fase 4e: worker membaca level sekali pada awal setiap job dan meneruskannya ke iLovePDF; dashboard memiliki menu Pengaturan dan modal simpan.
- Pemeriksaan sintaks dan `git diff --check` lulus. `npm.cmd run verify` exit code 0, tetapi server tes mendapat `EADDRINUSE` pada port 3000 sehingga pemeriksaan HTTP mungkin dijawab server yang sudah berjalan; verifikasi tidak menguji API settings secara langsung.

## Sedang Dikerjakan
- (kosong)

## Langkah Selanjutnya
- Fase 5: Konversi Office (belum dimulai).

## Masalah Diketahui (TODO, bukan bug)
- [2026-10-18] Status hijau check-circle tampil di atas PDF setelah render; pertimbangkan toast atau hide di iterasi berikutnya.
- [2026-10-18] Fase 3 dan 3b di-commit bersamaan karena public/ belum terlacak Git sejak awal. Ke depan, commit setelah setiap fase.
- [2026-10-18] Lazy-load halaman PDF untuk modul besar — TODO Fase 4.
- [2026-10-18] Race condition dengan 2+ modul belum diuji (hanya 1 modul di fixture).
- [2026-10-18] express-session masih memakai `MemoryStore` bawaan; gunakan session store persisten/bersama sebelum produksi agar sesi tersedia lintas restart dan worker.
- [2026-10-18] Proses Node lain memakai port 3000 sehingga verifikasi dijalankan pada port alternatif.

## Masalah Review
- Pemeriksaan manual Fase 4c tidak menemukan temuan level tinggi. Codex CLI `/review` tidak dapat dijalankan karena lingkungan gagal mendeteksi direktori home.
- Fase 4d: review manual kode tidak menemukan masalah level tinggi; `codex review --uncommitted` tidak berjalan karena CLI tidak dapat mendeteksi direktori home.
- Koreksi worker Fase 4d diverifikasi dengan `node --check` dan `git diff --check`. `npm.cmd run verify` exit code 0, tetapi server uji tetap mendapat `EADDRINUSE` di port 3000; Codex CLI review tetap terhalang direktori home.
- Integrasi iLovePDF: pemeriksaan manual tidak menemukan masalah level tinggi; Codex CLI review tidak dapat berjalan karena direktori home tidak terdeteksi. Kompresi API langsung belum dites untuk menghindari penggunaan kredensial/kredit tanpa verifikasi terpisah.
- Fase 4e: pemeriksaan manual endpoint, validasi nilai, pembacaan worker per job, dan alur UI tidak menemukan masalah level tinggi; `codex review --uncommitted` tetap gagal karena CLI tidak menemukan direktori home.
