## Gaya Visual (Berlaku untuk viewer dan admin CRUD)

### Referensi
Produk SaaS modern dengan sidebar tipis, konten lapang, tipografi tegas,
aksen warna tunggal. Bukan startup, bukan aplikasi konsumen. Kesan:
profesional, tenang, dapat dipercaya.

### Framework CSS
- Gunakan **Tailwind CSS via CDN** (`https://cdn.tailwindcss.com`), bukan build step.
- Konfigurasi tema di `<script>tailwind.config = {...}</script>` di `index.html`.
- File `public/css/style.css` hanya untuk hal yang tidak bisa dilakukan
  Tailwind CDN: `@keyframes` spinner, styling `<canvas>` PDF, dan reset minimal.
- Dilarang menambah bundler (Vite, Webpack, PostCSS CLI) tanpa persetujuan manusia.

### Palet Warna (Tailwind config)
brand-blue: #1E5AA8
brand-blue-dk: #154478 (untuk hover/active)
brand-red: #D32F2F
brand-red-lt: #FBE9E9 (untuk background badge merah)
brand-green: #4CAF50
brand-green-lt:#E8F5E9
text-main: #212121
text-muted: #666666
border-soft: #E0E0E0
bg-soft: #F8F9FA

text

### Aturan Gradien (Boleh, Tapi Terkontrol)
Gradien DIIZINKAN dengan batasan ketat berikut:
- Maksimal **dua stop warna**, tidak boleh tiga atau lebih.
- Hanya boleh dipakai di **satu elemen per halaman** (pilih: header ATAU
  tombol utama ATAU hero, bukan ketiganya).
- Arah: `to-b` (vertikal), `to-br` (diagonal halus), atau `to-r`.
- Warna: turunan dari brand-blue saja (contoh: `from-[#1E5AA8] to-[#154478]`),
  ATAU dari brand-blue ke brand-blue yang lebih terang
  (`from-[#1E5AA8] to-[#2E6FC8]`). Dilarang mencampur biru dengan merah/hijau
  dalam satu gradien.
- Dilarang: gradien di teks (`bg-clip-text`), gradien di border, gradien
  multi-warna (ungu-pink, biru-cyan, dsb), gradien di background halaman penuh.
- Dilarang: gradien + shadow berwarna di elemen yang sama.

Contoh gradien yang DIIZINKAN:
- Header: `bg-gradient-to-b from-[#1E5AA8] to-[#154478]`
- Tombol utama: `bg-gradient-to-r from-[#1E5AA8] to-[#2E6FC8]`

Contoh gradien yang DILARANG:
- `bg-gradient-to-r from-purple-500 to-pink-500` (bukan brand)
- `bg-gradient-to-r from-[#1E5AA8] via-[#9333EA] to-[#D32F2F]` (tiga warna)
- `bg-clip-text text-transparent bg-gradient-to-r ...` (teks gradien)
- `bg-gradient-to-br from-[#1E5AA8] to-[#D32F2F]` (campur biru-merah)

### Prinsip Umum
- Latar putih bersih, negative space cukup (minimal 24px antar blok).
- Satu aksen warna per elemen, jangan campur biru dan merah dalam satu komponen.
- Ikon garis (stroke), ukuran 16–20px, warna mengikuti teks atau aksen.
- Shadow hanya abu-abu netral dengan opacity <0.1 (Tailwind: `shadow-sm`,
  `shadow`). Dilarang `shadow-lg`, `shadow-xl`, atau `shadow-{warna}`.
- Radius: `rounded` (4px) untuk tombol/input, `rounded-lg` (8px) untuk
  kartu/panel. Dilarang `rounded-xl`, `rounded-2xl`, `rounded-full` kecuali
  untuk avatar.
- Transisi: `transition-colors duration-150` saja. Dilarang animasi bounce,
  pulse, spin (kecuali spinner loading fungsional).

### Tipografi
- Font: `font-sans` (system-ui bawaan Tailwind)
- Body: `text-sm` atau `text-base`, `leading-relaxed`
- Judul panel: `text-lg font-semibold`
- Judul halaman: `text-2xl font-bold`
- Dilarang Google Fonts, font dekoratif, letter-spacing berlebihan.

### Layout Viewer (Fase 3b)
- Header: `h-16`, latar gradien biru (satu-satunya gradien di halaman),
  teks putih, brand di kiri, ikon `book-open` Lucide di samping brand.
- Sidebar kiri: `w-72` (288px), daftar modul berupa kartu tipis dengan
  border `border-[#E0E0E0]`, ikon `file-text` di kiri judul.
- Panel kanan: area PDF, latar `bg-[#F8F9FA]`, border tipis, padding 24px.
- Responsif: di bawah `md:` (768px), sidebar stack di atas viewer.

### Layout Admin CRUD (Fase 4, belum dikerjakan)
- Sidebar kiri: navigasi (Dashboard, Modul, Pengaturan), `w-60` (240px).
- Konten: tabel modul dengan kolom Judul, Status, Ukuran, Aksi.
- Tombol utama (Tambah Modul) di kanan atas konten, gradien biru.
- Form upload: modal atau halaman terpisah, drag-and-drop area dengan
  border dashed `border-[#E0E0E0]`.

### Ikon
- Sumber: **Lucide** via CDN (`https://unpkg.com/lucide@latest`).
- Ukuran: 16px inline dengan teks (`w-4 h-4`), 20px untuk tombol
  (`w-5 h-5`), 24px untuk header (`w-6 h-6`).
- Dilarang: sparkles, rocket, zap, star, fire, crown, atau ikon dekoratif
  tanpa makna fungsional.

### Larangan Keras
- Gradien di luar aturan di atas
- Glassmorphism, `backdrop-filter`, `backdrop-blur`
- Shadow berwarna (`shadow-blue-500`, `shadow-red-500`)
- Animasi bounce, pulse, spin (kecuali spinner loading fungsional)
- Emoji di UI
- Font eksternal (Google Fonts, Adobe Fonts)
- `dark:` variant (belum ada dark mode di roadmap)