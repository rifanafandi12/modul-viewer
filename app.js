import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { testConnection } from './services/db.js';
import modulRouter from './routes/modul.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve dan validasi storage path SEKALI saat startup
const STORAGE_PATH = path.resolve(__dirname, process.env.STORAGE_PATH || './storage');
const OPTIMIZED_DIR = path.join(STORAGE_PATH, 'optimized');
const ORIGINAL_DIR = path.join(STORAGE_PATH, 'original');

if (!fs.existsSync(OPTIMIZED_DIR)) {
  console.error(`FATAL: Folder optimized tidak ada: ${OPTIMIZED_DIR}`);
  process.exit(1);
}
if (!fs.existsSync(ORIGINAL_DIR)) {
  console.error(`FATAL: Folder original tidak ada: ${ORIGINAL_DIR}`);
  process.exit(1);
}

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ekspos path yang sudah di-resolve ke route — HARUS sebelum mount router
app.locals.optimizedDir = OPTIMIZED_DIR;
app.locals.originalDir = ORIGINAL_DIR;

app.use('/api/modul', modulRouter);

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
  console.log(`Storage optimized: ${OPTIMIZED_DIR}`);
  console.log(`Storage original:  ${ORIGINAL_DIR}`);
  try {
    await testConnection();
  } catch (err) {
    console.error('Gagal konek MySQL:', err.message);
  }
});