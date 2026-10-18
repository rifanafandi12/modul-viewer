# Daftar Tugas

## Fase 1: Fondasi ✅
- [x] package.json + .env + struktur folder
- [x] services/db.js
- [x] app.js (start + /health)
- [x] routes/modul.js GET /api/modul

## Fase 2: Streaming Inti ✅
- [x] services/token.js
- [x] GET /api/modul/:id/meta
- [x] GET /api/modul/:id/stream (inline + no-store)
- [x] npm run verify lulus

## Fase 3: Frontend PDF.js ⬜ (TUGAS BERIKUTNYA UNTUK CODEX)
- [ ] Muat PDF.js dari CDN atau public/js/
- [ ] public/js/viewer.js: klik modul → fetch /meta → render PDF ke <canvas>
- [ ] Matikan tombol download & print PDF.js
- [ ] Nonaktifkan klik kanan & Ctrl+S/P di area viewer
- [ ] Update desain.md jika ada komponen baru
## Fase 3b: Polish Desain Viewer dengan Tailwind ⬜
- [ ] Tambahkan Tailwind CDN + konfigurasi tema brand di index.html
- [ ] Tambahkan Lucide via CDN, inisialisasi `lucide.createIcons()`
- [ ] Ganti `public/css/style.css` menjadi hanya: `@keyframes` spinner,
      styling `<canvas>` PDF, dan reset minimal. Sisanya pakai Tailwind utility.
- [ ] Redesign header: brand + ikon `book-open`, gradien biru (satu-satunya gradien)
- [ ] Redesign sidebar daftar modul: kartu tipis, ikon `file-text`, status badge
      (pakai `check-circle` hijau untuk ready, `alert-circle` merah untuk failed,
      `loader` netral untuk processing/pending)
- [ ] Redesign panel viewer: latar `bg-[#F8F9FA]`, border tipis, spacing lapang
- [ ] State loading: spinner Lucide `loader-2` dengan animasi spin (satu-satunya animasi)
- [ ] State error: ikon `alert-circle` merah + pesan
- [ ] State empty: ikon `folder-open` + "Belum ada modul"
- [ ] Responsif: sidebar stack di bawah `md:`
- [ ] Uji manual di browser (desktop + mobile viewport)
## Fase 3c: Perbaikan Temuan Review Keamanan ✅
- [x] services/token.js: hapus fallback 'default-secret'. Jika APP_SECRET kosong/<32 karakter, throw error saat import sehingga server gagal start.
- [x] app.js: resolve STORAGE_PATH dan OPTIMIZED_DIR sekali saat startup, validasi folder ada, ekspos via app.locals.
- [x] routes/modul.js: gunakan OPTIMIZED_DIR dari app.locals, jangan resolve ulang.
- [x] routes/modul.js: validasi nama file dari token — path.basename() + path.relative() cek di dalam OPTIMIZED_DIR.
- [x] public/js/viewer.js: pindahkan listener keydown dari #viewer ke document.
- [x] scripts/verify.sh: tambah tes path traversal (token dengan file '../../.env' harus ditolak, bukan 200).
- [x] scripts/gen-token.mjs: helper generate token untuk verify.
- [x] npm run verify lulus, path traversal ditolak (status 403).

## Fase 4: Upload & Kompresi ⬜ (Dibahas Nanti)
- [ ] Endpoint upload (multer)
- [ ] Kompresi PDF (pdf-lib + sharp)
- [ ] Queue sederhana + cron

## Fase 5: Konversi Office ⬜ (Dibahas Nanti)
- [ ] Konversi Word/PPT via API eksternal