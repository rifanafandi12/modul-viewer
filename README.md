# Modul Viewer

Aplikasi penampil modul berbasis web yang dirancang untuk keamanan dan performa. Pengguna dapat membaca modul (PDF) secara langsung di browser tanpa dapat mengunduh file aslinya. Dilengkapi dengan portal admin untuk mengelola modul dan sistem kompresi otomatis untuk menghemat ruang penyimpanan dan mempercepat waktu muat.

## Fitur Utama

- **Anti-Unduh (Streaming):** PDF dirender ke dalam elemen `<canvas>` menggunakan PDF.js. File asli tidak terekspos ke publik dan dikirim melalui endpoint API yang dilindungi token sementara (HMAC).
- **Kompresi Otomatis:** File PDF yang diunggah akan diproses secara asinkron di latar belakang menggunakan API iLovePDF untuk meminimalkan ukuran file.
- **Portal Admin (CRUD):** Dashboard admin untuk mengunggah, melihat, mengedit pengaturan, dan menghapus modul.
- **Keamanan Sesi:** Autentikasi admin menggunakan bcrypt dan manajemen sesi dengan cookie `httpOnly` dan `sameSite`.
- **Desain Responsif:** Antarmuka dibangun dengan Tailwind CSS, menggunakan grid layout untuk katalog modul dan desain yang bersih tanpa gradien.

## Teknologi yang Digunakan

- **Backend:** Node.js, Express.js, MySQL (mysql2)
- **Frontend:** HTML, Vanilla JavaScript, Tailwind CSS (CDN), Lucide Icons, PDF.js
- **Autentikasi:** express-session, bcrypt
- **Pemrosesan File:** multer, iLovePDF API
- **Arsitektur:** Antrean pekerjaan (queue) berbasis database untuk pemrosesan file asinkron.

## Prasyarat

- Node.js versi 18 atau lebih baru.
- MySQL / MariaDB.
- Akun iLovePDF Developer (untuk Public Key dan Secret Key).

## Cara Menjalankan di Lokal

1. **Clone repositori:**
   ```bash
   git clone https://github.com/USERNAME/NAMA-REPO.git
   cd NAMA-REPO