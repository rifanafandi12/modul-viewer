# Arsitektur Proyek

Dokumen ini adalah sumber kebenaran arsitektur. Jika kode dan dokumen ini
berbeda, dokumen ini yang benar dan kode harus disesuaikan. Perubahan
pada dokumen ini hanya boleh dilakukan oleh manusia.

---

## 1. Tujuan

Membangun aplikasi web penampil modul pembelajaran. Pengguna dapat
membaca modul di browser, tetapi tidak dapat mengunduh file asli.
File besar (PDF/Word/PPT) dikompresi atau dikonversi terlebih dahulu
di server sebelum ditampilkan, agar loading cepat dan stabil.

---

## 2. Diagram Alur
[Admin/Manusia]
│ upload file (Fase 4)
▼
[storage/original/] ──► [Proses kompresi/konversi] ──► [storage/optimized/]
(file asli) (Fase 4, async) (PDF terkompresi)
│
│
[Pengguna] │
│ 1. GET /api/modul │
│ 2. GET /api/modul/:id/meta ──► dapat token (5 menit) │
│ 3. GET /api/modul/:id/stream?token=... ◄──────────────────┘
│ (server verifikasi token, stream PDF inline)
▼
[PDF.js render ke <canvas>]

text

---

## 3. Stack dan Perannya

| Lapisan | Teknologi | Peran |
| :--- | :--- | :--- |
| Runtime | Node.js 18+ (ESM) | Menjalankan server |
| Web framework | Express 4 | Routing, middleware, streaming |
| Database driver | mysql2 (promise) | Query ke MySQL |
| Env | dotenv | Baca `.env` |
| Database | MySQL | Simpan metadata modul |
| Frontend | HTML/CSS/JS murni | Halaman daftar & viewer |
| PDF render | PDF.js | Render PDF ke canvas |
| Token | HMAC-SHA256 (crypto bawaan) | Tanda tangan token stream |
| Kompresi PDF | pdf-lib + sharp (Fase 4) | Kecilkan PDF tanpa Ghostscript |
| Queue | Tabel MySQL + cron (Fase 4) | Proses async tanpa timeout |
| Konversi Office | API eksternal (Fase 5) | Word/PPT → PDF |

---

## 4. Struktur Database

Database: `modul_viewer`, charset `utf8mb4`.

### Tabel `modules`

| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| id | INT PK AI | |
| title | VARCHAR(255) | Judul modul |
| slug | VARCHAR(255) UNIQUE | Identifier URL-friendly |
| original_file | VARCHAR(255) | Nama file di storage/original/ |
| optimized_file | VARCHAR(255) | Nama file di storage/optimized/ |
| status | ENUM | pending/processing/ready/failed |
| file_size | BIGINT | Ukuran file optimized (byte) |
| created_at | TIMESTAMP | |

DDL lengkap: `docs/schema.sql`.

### Tabel mendatang (Fase 4)

- `jobs` — antrian kompresi/konversi
  (id, module_id, type, status, error, created_at, started_at, finished_at)

---

## 5. Endpoint

### Sudah ada (Fase 1–2)

| Method | Path | Fungsi |
| :--- | :--- | :--- |
| GET | `/health` | Health check, kembalikan `{ ok: true }` |
| GET | `/api/modul` | Daftar modul (tanpa file) |
| GET | `/api/modul/:id/meta` | Metadata + token stream |
| GET | `/api/modul/:id/stream` | Stream PDF dengan token |

### Akan datang (Fase 4–5)

| Method | Path | Fungsi |
| :--- | :--- | :--- |
| POST | `/api/modul` | Upload file baru |
| POST | `/api/modul/:id/reprocess` | Kompresi ulang |

Dokumentasi detail: `docs/api.md` (Fase 6).

---

## 6. Alur Token (Anti-Unduh Lapis 2)

1. Frontend memanggil `GET /api/modul/:id/meta`.
2. Server membuat payload `{ id, file, exp }` dengan `exp = now + 300s`.
3. Payload di-encode base64url, ditandatangani HMAC-SHA256 dengan
   `APP_SECRET`, hasilnya `base64url.signature`.
4. Server mengembalikan `{ token, stream_url }`.
5. Frontend memanggil `stream_url`.
6. Server memverifikasi signature dan `exp`. Jika valid, stream file.
7. Token tidak dapat dipakai ulang setelah 5 menit.

Implementasi: `services/token.js`.

---

## 7. Anti-Unduh (Berlapis)

| Lapis | Implementasi | Status |
| :--- | :--- | :--- |
| 1. Penyimpanan | File di `storage/` luar `public/`, tanpa URL statis | ✅ |
| 2. Token | HMAC + expiry 5 menit, terikat id modul | ✅ |
| 3. Header | `Content-Disposition: inline`, `Cache-Control: no-store` | ✅ |
| 4. Frontend | PDF.js ke canvas, disable download/print | ⬜ Fase 3 |
| 5. Frontend | Disable klik kanan, Ctrl+S/P di area viewer | ⬜ Fase 3 |
| 6. Watermark | Overlay div transparan berisi ID user | ⬜ Opsional |

Catatan jujur: tidak ada cara 100% mencegah pengguna yang bertekad
menyimpan konten. Tujuan lapisan ini adalah membuat upaya tersebut
memerlukan keahlian teknis, bukan sekadar klik kanan.

---

## 8. Alur Kompresi/Konversi (Fase 4–5)

### PDF besar

1. Admin upload → simpan ke `storage/original/` → insert row
   `modules` dengan status `pending`.
2. Insert row di tabel `jobs`.
3. Cron cPanel (tiap 1 menit) menjalankan `node workers/queue.js`.
4. Worker mengambil job, set status `processing`.
5. Worker menjalankan kompresi:
   - Utama: `pdf-lib` untuk hapus objek tak terpakai +
     `sharp` untuk rekompres gambar di dalam PDF.
   - Ghostscript TIDAK dipakai (belum tentu ada di shared hosting).
6. Hasil ke `storage/optimized/`, update `modules.status = 'ready'`.
7. Jika gagal: status `failed`, error dicatat di `jobs.error`.

### Word/PPT

1. Sama seperti PDF, tetapi step kompresi diganti dengan panggilan
   ke API eksternal (CloudConvert / ConvertAPI) untuk konversi ke PDF.
2. PDF hasil konversi kemudian dikompresi seperti alur PDF di atas.
3. Kunci API disimpan di `.env`, TIDAK di kode.

---

## 9. Batasan Lingkungan (cPanel Shared Hosting)

- Proses Python/Node berjalan di bawah Passenger, satu proses per
  aplikasi.
- Batas waktu request: asumsikan 60 detik. Semua proses berat HARUS
  async via queue + cron.
- Tidak ada Ghostscript, LibreOffice, atau ImageMagick yang dijamin.
  Gunakan library Node murni (pdf-lib, sharp).
- Tidak ada akses root. Tidak bisa install paket sistem.
- Memori proses terbatas (di paket Ultimated M: 2 GB, tapi anggap
  aman 256 MB per proses untuk perhitungan desain).
- File system persisten antar deploy, jadi `storage/` aman.

---

## 10. Keputusan yang Sudah Dikunci

Keputusan berikut sudah final. Jangan diubah tanpa persetujuan manusia:

- Entry file bernama `app.js`.
- ESM (`"type": "module"`), bukan CommonJS.
- Express 4, bukan Express 5 (stabilitas middleware).
- MySQL, bukan SQLite/Postgres.
- Token HMAC buatan sendiri, bukan JWT library.
- PDF.js render ke canvas, bukan iframe.
- Tidak ada frontend framework (React/Vue) di Fase 1–3.
- Tidak ada login/registrasi sampai Fase 5 selesai.
- Tidak ada upload via UI sampai Fase 4.

---

## 11. Yang Sengaja Ditunda

Jangan dikerjakan sebelum tugasnya muncul di `tasks/progress.md`:

- Login/registrasi user
- Panel admin
- Watermark dinamis per user
- Pencarian/filter modul
- Kategori/tag modul
- Statistik baca
- Multi-bahasa
- Dark mode

---

## 12. Perubahan Dokumen Ini

Hanya manusia yang boleh mengubah file ini. Jika Codex merasa ada
keputusan arsitektur yang perlu diubah, tulis usulan di
`memory-bank/status.md` bagian "Masalah Diketahui", jangan edit
langsung.