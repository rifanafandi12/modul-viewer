import { Router } from 'express';
import { pool } from '../services/db.js';
import { generateToken, verifyToken } from '../services/token.js';
import fs from 'fs';
import path from 'path';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, title, slug, status, file_size, created_at FROM modules ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal ambil data modul' });
  }
});

router.get('/:id/meta', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM modules WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Modul tidak ditemukan' });

    const modul = rows[0];
    if (modul.status !== 'ready') {
      return res.status(409).json({ error: 'Modul belum siap ditampilkan', status: modul.status });
    }

    const token = generateToken({ id: modul.id, file: modul.optimized_file }, 300);

    res.json({
      id: modul.id,
      title: modul.title,
      slug: modul.slug,
      file_size: modul.file_size,
      token,
      stream_url: `/api/modul/${modul.id}/stream?token=${token}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal ambil metadata' });
  }
});

router.get('/:id/stream', async (req, res) => {
  try {
    const { token } = req.query;
    const payload = verifyToken(token);
    if (!payload || String(payload.id) !== String(req.params.id)) {
      return res.status(403).json({ error: 'Token tidak valid atau kedaluwarsa' });
    }

    const fileName = payload.file;
    if (!fileName) return res.status(404).json({ error: 'File tidak ditemukan' });

    // Anti path traversal: basename + validasi resolve di dalam optimizedDir
    const safeName = path.basename(fileName);
    const optimizedDir = req.app.locals.optimizedDir;
    const filePath = path.resolve(optimizedDir, safeName);
    const relative = path.relative(optimizedDir, filePath);

    if (relative.startsWith('..') || path.isAbsolute(relative) || relative === '') {
      return res.status(403).json({ error: 'Path file tidak valid' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File fisik tidak ditemukan' });
    }

    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'no-store');

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal streaming file' });
  }
});

export default router;