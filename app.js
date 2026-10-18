import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { testConnection } from './services/db.js';
import modulRouter from './routes/modul.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

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
  try {
    await testConnection();
  } catch (err) {
    console.error('Gagal konek MySQL:', err.message);
  }
});