import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import session from 'express-session';
import MySQLStore from 'express-mysql-session';
import { testConnection } from './services/db.js';
import modulRouter from './routes/modul.js';
import authRouter from './routes/auth.js';
import uploadRouter from './routes/upload.js';
import settingsRouter from './routes/settings.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- RESOLVE STORAGE & TMP PATH ---
const STORAGE_PATH = path.resolve(__dirname, process.env.STORAGE_PATH || './storage');
const OPTIMIZED_DIR = path.join(STORAGE_PATH, 'optimized');
const ORIGINAL_DIR = path.join(STORAGE_PATH, 'original');
const TMP_DIR = path.resolve(__dirname, process.env.TMP_PATH || './tmp');

// Pastikan semua folder ada saat aplikasi dinyalakan
if (!fs.existsSync(OPTIMIZED_DIR)) fs.mkdirSync(OPTIMIZED_DIR, { recursive: true });
if (!fs.existsSync(ORIGINAL_DIR)) fs.mkdirSync(ORIGINAL_DIR, { recursive: true });
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const app = express();
app.set('trust proxy', 1); // Penting untuk cPanel/Passenger

// --- MIDDLEWARE AUTOSSL BYPASS ---
// Mencegah Passenger/Express memblokir verifikasi AutoSSL
app.use((req, res, next) => {
  if (req.path.startsWith('/.well-known/')) {
    return res.status(404).send('Not handled by Node.js');
  }
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- KONFIGURASI SESSION MYSQL ---
const sessionStore = new (MySQLStore(session))({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  createDatabaseTable: true
});

app.use(session({
  key: 'modul_session',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 // 1 jam
  }
}));

// --- APP LOCALS ---
// Ekspos path ke route agar bisa diakses oleh Multer dan Stream
app.locals.optimizedDir = OPTIMIZED_DIR;
app.locals.originalDir = ORIGINAL_DIR;
app.locals.tmpDir = TMP_DIR; // Ini yang memperbaiki error upload Multer

// --- ROUTES ---
app.use('/api/auth', authRouter);
app.use('/api/modul', modulRouter);
app.use('/api/modul', uploadRouter);
app.use('/api/settings', settingsRouter);

app.get('/health', (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

// --- ERROR HANDLING ---
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(err.status || 500).json({ error: err.message || 'Terjadi kesalahan server' });
});

// --- START SERVER ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server jalan di port ${PORT}`);
  console.log(`Storage original:  ${ORIGINAL_DIR}`);
  console.log(`Storage optimized: ${OPTIMIZED_DIR}`);
  console.log(`Temp directory:    ${TMP_DIR}`);
  try {
    await testConnection();
  } catch (err) {
    console.error('Gagal konek MySQL:', err.message);
  }
});
