# Status Proyek

## Selesai
- Fondasi server dan endpoint streaming
- Fase 3: PDF.js render ke canvas; review manual desktop dan mobile lulus
- Fase 3b: Tailwind/Lucide polish viewer; review manual 11/11 lulus
- Fase 3c: Perbaikan 4 temuan keamanan dari Codex review:
  - APP_SECRET fail-fast (tidak ada fallback)
  - Storage path di-resolve sekali di app.js, divalidasi, diekspos via app.locals
  - Anti path traversal di endpoint stream (basename + relative check)
  - Listener keydown Ctrl+S/P dipindah ke document
- Verifikasi otomatis lulus, termasuk tes path traversal (status 403)
- Commit: (akan diisi setelah commit)

## Sedang Dikerjakan
- (kosong)

## Langkah Selanjutnya
- Fase 4a: Upload & Kompresi PDF (lihat memory-bank/arsitektur.md bagian Fase 4)
- Sebelum mulai: putuskan cakupan (4a/4b/4c) dan sumber kompresi (pdf-lib+sharp / Ghostscript / API eksternal)

## Masalah Diketahui (TODO, bukan bug)
- [2026-10-18] Status hijau check-circle tampil di atas PDF setelah render; pertimbangkan toast atau hide di iterasi berikutnya.
- [2026-10-18] Fase 3 dan 3b di-commit bersamaan karena public/ belum terlacak Git sejak awal. Ke depan, commit setelah setiap fase.
- [2026-10-18] Lazy-load halaman PDF untuk modul besar — TODO Fase 4.
- [2026-10-18] Race condition dengan 2+ modul belum diuji (hanya 1 modul di fixture).
- [2026-10-18] Keempat temuan Codex review ditutup oleh manusia (bukan Codex) di Fase 3c. Codex tidak menulis perbaikan ini, jadi konteksnya tidak ada di sesi sebelumnya.

## Catatan untuk Codex (sesi berikutnya)
- Fase 3c dikerjakan oleh manusia, bukan kamu. Jika kamu melihat kode di services/token.js, app.js, routes/modul.js, public/js/viewer.js, scripts/verify.sh, dan scripts/gen-token.mjs, itu hasil perbaikan manusia, jangan diubah tanpa alasan kuat.
- Sebelum mulai Fase 4, tunggu instruksi manusia.