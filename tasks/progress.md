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

## Fase 4: Upload & Kompresi ⬜ (Dibahas Nanti)
- [ ] Endpoint upload (multer)
- [ ] Kompresi PDF (pdf-lib + sharp)
- [ ] Queue sederhana + cron

## Fase 5: Konversi Office ⬜ (Dibahas Nanti)
- [ ] Konversi Word/PPT via API eksternal