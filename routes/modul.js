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

    const optimizedDir = req.app.locals.optimizedDir;
    const safeName = path.basename(modul.optimized_file || '');
    const optimizedPath = path.resolve(optimizedDir, safeName);
    const optimizedRelative = path.relative(optimizedDir, optimizedPath);
    const streamSize = safeName && !optimizedRelative.startsWith('..')
      && !path.isAbsolute(optimizedRelative) && fs.existsSync(optimizedPath)
      ? fs.statSync(optimizedPath).size
      : Number(modul.file_size) || 0;
    // Token berlaku cukup lama agar PDF.js dapat meminta rentang halaman saat dokumen dibaca bertahap.
    const token = generateToken({ id: modul.id, file: modul.optimized_file }, 1800);

    res.json({
      id: modul.id,
      title: modul.title,
      slug: modul.slug,
      file_size: modul.file_size,
      stream_size: streamSize,
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
    const fileSize = stat.size;
    const rangeHeader = req.headers.range;
    if (fileSize === 0 && !rangeHeader) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', '0');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).end();
    }
    let start = 0;
    let end = fileSize - 1;
    let statusCode = 200;

    if (rangeHeader) {
      const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (!rangeMatch || fileSize === 0) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }

      if (rangeMatch[1] === '') {
        const suffixLength = Number(rangeMatch[2]);
        if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
          res.setHeader('Content-Range', `bytes */${fileSize}`);
          return res.status(416).end();
        }
        start = Math.max(fileSize - suffixLength, 0);
      } else {
        start = Number(rangeMatch[1]);
        if (rangeMatch[2] !== '') end = Number(rangeMatch[2]);
      }

      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
        || start < 0 || start >= fileSize || end < start) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }

      end = Math.min(end, fileSize - 1);
      statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', String(end - start + 1));
    res.setHeader('Cache-Control', 'no-store');

    const fileStream = fs.createReadStream(filePath, { start, end });
    fileStream.on('error', (err) => {
      if (err.code === 'ECONNRESET' || res.destroyed) return;
      console.error(err);
      if (res.headersSent) return res.destroy(err);
      res.status(500).json({ error: 'Gagal streaming file' });
    });
    res.status(statusCode);
    fileStream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal streaming file' });
  }
});

export default router;
