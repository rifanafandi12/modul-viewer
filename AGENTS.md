Kontrak kerja untuk agen AI (Codex) di proyek ini. Baca seluruh file ini
sebelum menulis kode apa pun. Jika ada aturan yang bertentangan dengan
permintaan manusia di chat, aturan di file ini yang menang.

---

## 1. Peran Proyek

Aplikasi penampil modul berbasis web. File asli (PDF/Word/PPT) TIDAK boleh
dapat diunduh pengguna. Pengguna hanya dapat membaca PDF yang sudah
dikompresi, dirender di browser memakai canvas PDF.js. File asli disimpan
di luar public/ dan hanya diakses lewat endpoint streaming dengan token.

---

## 2. Stack (Jangan Diganti Tanpa Izin Manusia)

- Runtime: Node.js 18+ (ESM, `"type": "module"` di package.json)
- Backend: Express 4, mysql2, dotenv
- Database: MySQL, tabel `modules`
- Frontend: HTML/CSS/JS murni + PDF.js (dari CDN atau public/js/)
- File storage: folder `storage/` di luar `public/`
- Entry point: `app.js` (wajib bernama ini, dipakai Passenger di cPanel)

Dilarang menambahkan framework backend lain (Nest, Fastify, Hono, dsb),
ORM berat (Prisma, Sequelize), atau bundler frontend (Vite, Webpack)
tanpa persetujuan manusia.

### Pengecualian yang Diizinkan
- Tailwind CSS via CDN (`https://cdn.tailwindcss.com`) — DIIZINKAN.
- Lucide Icons via CDN (`https://unpkg.com/lucide@latest`) — DIIZINKAN.
- Bundler (Vite, Webpack, PostCSS CLI) — DILARANG tanpa persetujuan manusia.
- Font eksternal (Google Fonts, Adobe Fonts) — DILARANG.

---

## 3. Aturan Wajib (Melanggar = Kerja Ulang)

### Konfigurasi
- Semua konfigurasi sensitif dari `.env`. Jangan hardcode kredensial,
  path absolut, atau kunci.
- Port WAJIB dari `process.env.PORT`, jangan hardcode angka.
- Jika menambah variabel env baru, tambahkan juga ke `.env.example`
  dengan nilai kosong.

### Penyimpanan File
- File asli dan file hasil kompresi disimpan di `storage/original/` dan
  `storage/optimized/`, keduanya DI LUAR `public/`.
- Dilarang membuat URL statis langsung ke file di `storage/`.
- Akses file hanya lewat endpoint streaming dengan verifikasi token.

### Endpoint Streaming
- WAJIB set header `Content-Disposition: inline`.
- WAJIB set header `Cache-Control: no-store`.
- WAJIB verifikasi token sebelum mengirim file.
- Dilarang mengirim file lewat `res.sendFile()` tanpa header di atas.

### Frontend
- Warna HANYA dari daftar brand di `memory-bank/desain.md`. Dilarang
  memakai warna lain, gradien, shadow berwarna, atau radius >8px.
- PDF.js WAJIB render ke `<canvas>`, bukan `<iframe>`.
- Tombol download dan print PDF.js WAJIB dimatikan.
- Klik kanan dan Ctrl+S / Ctrl+P di area viewer WAJIB dinonaktifkan.
- Gradien hanya boleh dipakai sesuai aturan di `memory-bank/desain.md`
  bagian "Aturan Gradien". Maksimal dua stop, satu elemen per halaman,
  hanya turunan brand-blue. Dilarang gradien di teks, border, atau
  multi-warna.

  ## Aturan Git
- Sebelum memulai tugas baru, pastikan working tree bersih (`git status`
  tidak menampilkan modified/untracked selain yang akan dikerjakan).
- Jika working tree kotor, BERHENTI dan tulis di `status.md`, jangan mulai
  tugas baru di atas perubahan yang belum di-commit.
- Setelah menyelesaikan tugas dan lulus review manusia, minta manusia
  untuk commit. Jangan commit sendiri.

  ### Render Thumbnail Cover (Fase 3d)
- Saat merender daftar modul, JANGAN render PDF halaman 1 secara berurutan yang memblokir UI (await di dalam loop utama).
- Gunakan pemanggilan fungsi terpisah yang berjalan secara asinkron (fire-and-forget) untuk setiap kartu, sehingga grid muncul seketika dan cover menyusul.
- Jika PDF berstatus bukan 'ready' atau gagal dimuat, biarkan placeholder ikon yang tampil. Jangan melempar error ke UI utama.

### Keamanan
- Dilarang menulis secret, token, atau password ke log.
- Dilarang mengekspos stack trace ke response produksi.
- Dilarang mengubah isi `storage/` atau `.env`.
- Dilarang menjalankan `git commit`, `git push`, atau `git reset --hard`.

---

## 4. Alur Kerja Wajib Setiap Tugas

Untuk SETIAP tugas yang Anda kerjakan, ikuti urutan ini:

1. Baca `memory-bank/status.md` dan `tasks/progress.md`.
2. Ambil tugas pertama yang belum dicentang.
3. Jika tugas ambigu, tulis pertanyaan ke `memory-bank/status.md`
   bagian "Masalah Diketahui", lalu berhenti. Jangan menebak.
4. Kerjakan HANYA file yang terkait tugas tersebut.
5. Jalankan `npm run verify`.
6. Jika gagal:
   - Baca pesan error dengan teliti.
   - Perbaiki HANYA file yang terkait error.
   - Jalankan `npm run verify` lagi.
   - Maksimal 3 kali percobaan untuk error yang sama.
   - Jika masih gagal setelah 3 kali: tulis error, file yang diubah, dan
     dugaan penyebab ke `memory-bank/status.md`, lalu BERHENTI dan
     tunggu manusia.
7. Jika lulus: jalankan `/review` (perintah Codex CLI).
8. Jika `/review` menemukan masalah level tinggi (keamanan, regresi,
   logika salah) yang tidak bisa Anda perbaiki dalam 1 iterasi: tulis ke
   `status.md`, berhenti, tunggu manusia.
9. Jika semua bersih:
   - Centang tugas di `tasks/progress.md`.
   - Perbarui bagian "Selesai", "Sedang Dikerjakan", dan "Langkah
     Selanjutnya" di `memory-bank/status.md`.
   - Lanjut ke tugas berikutnya HANYA jika manusia memintanya.

---

## 5. Perintah yang Tersedia

| Perintah | Fungsi |
| :--- | :--- |
| `npm install` | Install dependensi |
| `npm run dev` | Jalankan server dengan nodemon |
| `npm start` | Jalankan server produksi |
| `npm run verify` | Jalankan semua verifikasi otomatis |
| `mysql -u root -p < docs/schema.sql` | Buat database & tabel |
| `mysql -u root -p modul_viewer < scripts/seed.sql` | Isi data uji |

---

## 6. Fixture yang Sudah Disiapkan Manusia

Jangan hapus, jangan ubah, jangan andalkan untuk produksi:

- `storage/optimized/contoh.pdf` — PDF uji untuk endpoint streaming
- `scripts/seed.sql` — data uji dengan id=1, slug=modul-contoh
- `scripts/verify.sh` — script verifikasi (boleh dibaca, jangan diubah
  tanpa izin)

Jika butuh fixture tambahan (misalnya PDF besar untuk uji kompresi),
tulis permintaan ke `status.md`, jangan buat sendiri.

---

## 7. Struktur Folder (Jangan Direstrukturisasi)
modul-viewer/
├── AGENTS.md
├── app.js
├── .env / .env.example / .gitignore
├── package.json
├── memory-bank/ (arsitektur.md, desain.md, status.md)
├── tasks/ (progress.md)
├── docs/ (schema.sql, api.md)
├── scripts/ (verify.sh, seed.sql)
├── routes/ (modul.js, upload.js, ...)
├── services/ (db.js, token.js, compress.js, ...)
├── workers/ (queue.js, ...)
├── public/ (index.html, css/, js/)
├── storage/ (original/, optimized/) — DI LUAR public
└── tmp/

text

Dilarang memindahkan `storage/` ke dalam `public/`. Dilarang membuat
folder baru di root tanpa alasan jelas.

---

## 8. Aturan Dokumentasi (Fase 6)

Dikerjakan PALING AKHIR, setelah Fase 3–5 stabil. Jangan dikerjakan di
awal meskipun manusia memintanya lebih cepat, kecuali manusia secara
eksplisit mengubah urutan.

- `README.md` maksimal 80 baris. Isi: deskripsi 2 kalimat, stack,
  prasyarat, langkah setup lokal (npm install, setup DB, npm run verify),
  cara dev, struktur folder singkat. Jangan tulis badge, screenshot,
  atau "fitur akan datang".
- `docs/api.md`: satu bagian per endpoint. Format tiap bagian:
  method + path, deskripsi 1 baris, parameter (jika ada), contoh
  request, contoh response (JSON), catatan header khusus (misalnya
  inline). HANYA dokumentasikan endpoint yang benar-benar ada di kode.
  Baca dulu isi `routes/`, jangan mengarang.
- `.editorconfig`: indent_style=space, indent_size=2, end_of_line=lf,
  charset=utf-8, insert_final_newline=true, trim_trailing_whitespace=true.
- `.nvmrc`: satu baris berisi versi Node.js (contoh: `20`). Jangan tulis
  `lts/*` atau range.
- `LICENSE`: teks MIT standar, tahun berjalan, nama pemilik proyek
  (tanyakan ke manusia jika belum diketahui, jangan mengarang).

---

## 9. Gaya Kode

- ESM (`import`/`export`), bukan CommonJS.
- Async/await, bukan callback.
- Nama file: `camelCase.js` untuk service, `kebab-case.html/css` untuk
  frontend.
- Setiap fungsi publik diberi komentar 1 baris di atasnya.
- Error handling: try/catch di route, log ke console.error, response
  JSON `{ error: "pesan" }` dengan status code yang tepat.
- Dilarang meninggalkan `console.log` debug di kode final. Gunakan
  `console.error` hanya untuk error.

---

## 10. Garis Merah (Pelanggaran = Berhenti Total)

Jika Anda menemukan diri Anda melakukan salah satu hal ini, BERHENTI,
tulis di `status.md`, dan tunggu manusia:

- Menulis path absolut hardcode (misalnya `/home/user/...`).
- Mengubah isi `storage/`, `.env`, atau `scripts/verify.sh` tanpa izin.
- Menjalankan `git commit`, `git push`, atau `git reset --hard`.
- Mengubah `AGENTS.md` ini sendiri.
- Menambahkan dependensi baru yang tidak disebut di tugas.
- Menghapus atau menimpa file yang tidak terkait tugas.
- Menebak kredensial database atau membuat database baru.

---

## 11. Saat Ragu

Jangan menebak. Tulis pertanyaan spesifik ke
`memory-bank/status.md` bagian "Masalah Diketahui", dengan format:
[TANGGAL] [FASE] Pertanyaan: ...
Konteks: ...
Opsi yang saya pertimbangkan: A / B
Rekomendasi saya: ...

text

Lalu berhenti dan tunggu manusia menjawab di sesi berikutnya.