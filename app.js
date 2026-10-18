import express from 'express';
import session from 'express-session';
import MySQLStore from 'express-mysql-session';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { testConnection } from './services/db.js';
import modulRouter from './routes/modul.js';
import authRouter from './routes/auth.js';
import uploadRouter from './routes/upload.js';
import settingsRouter from './routes/settings.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve dan validasi storage path SEKALI saat startup
const STORAGE_PATH = path.resolve(__dirname, process.env.STORAGE_PATH || './storage');
const OPTIMIZED_DIR = path.join(STORAGE_PATH, 'optimized');
const ORIGINAL_DIR = path.join(STORAGE_PATH, 'original');
const TMP_DIR = path.resolve(__dirname, process.env.TMP_PATH || './tmp');
const PUBLIC_DIR = path.join(__dirname, 'public');
const TMP_RELATIVE_TO_PUBLIC = path.relative(PUBLIC_DIR, TMP_DIR);

if (!fs.existsSync(OPTIMIZED_DIR)) {
  console.error(`FATAL: Folder optimized tidak ada: ${OPTIMIZED_DIR}`);
  process.exit(1);
}
if (!fs.existsSync(ORIGINAL_DIR)) {
  console.error(`FATAL: Folder original tidak ada: ${ORIGINAL_DIR}`);
  process.exit(1);
}
if (
  TMP_RELATIVE_TO_PUBLIC === '' ||
  (TMP_RELATIVE_TO_PUBLIC !== '..' &&
    !TMP_RELATIVE_TO_PUBLIC.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(TMP_RELATIVE_TO_PUBLIC))
) {
  console.error('FATAL: TMP_PATH harus berada di luar folder public.');
  process.exit(1);
}
fs.mkdirSync(TMP_DIR, { recursive: true });

const app = express();

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error('FATAL: SESSION_SECRET harus berisi minimal 32 karakter.');
  process.exit(1);
}

app.set('trust proxy', 1);

const MySQLSessionStore = MySQLStore(session);
const sessionStore = new MySQLSessionStore({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  clearExpired: true,
  createDatabaseTable: true
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  store: sessionStore,
  name: 'modul_viewer.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  }
}));

// Ekspos path yang sudah di-resolve ke route — HARUS sebelum mount router
app.locals.optimizedDir = OPTIMIZED_DIR;
app.locals.originalDir = ORIGINAL_DIR;
app.locals.tmpDir = TMP_DIR;

app.use('/api/modul', modulRouter);
app.use('/api/auth', authRouter);
app.use('/api/modul', uploadRouter);
app.use('/api/settings', settingsRouter);

app.get('/health', (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(err.status || 500).json({ error: err.message || 'Terjadi kesalahan server' });
});

if (process.env.NODE_ENV !== 'production' && process.env.PORT) {
  app.listen(process.env.PORT, () => {
    console.log(`Server jalan di http://localhost:${process.env.PORT}`);
  });
}

testConnection().catch((err) => {
  console.error('Gagal konek MySQL:', err.message);
});

export default app;
