import { Router } from 'express';
import { pool } from '../services/db.js';
import { requireAuth } from './auth.js';

const router = Router();
const COMPRESSION_LEVELS = new Set(['low', 'recommended', 'extreme']);

router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT setting_value FROM settings WHERE setting_key = ?',
      ['compression_level']
    );
    if (rows.length === 0) {
      return res.status(500).json({ error: 'Pengaturan level kompresi belum tersedia.' });
    }

    const compressionLevel = rows[0].setting_value;
    if (!COMPRESSION_LEVELS.has(compressionLevel)) {
      return res.status(500).json({ error: 'Pengaturan level kompresi tidak valid.' });
    }

    res.json({ compression_level: compressionLevel });
  } catch (error) {
    console.error('Gagal membaca pengaturan kompresi:', error.message);
    res.status(500).json({ error: 'Pengaturan gagal dibaca.' });
  }
});

router.patch('/', requireAuth, async (req, res) => {
  try {
    const compressionLevel = req.body?.compression_level;
    if (typeof compressionLevel !== 'string' || !COMPRESSION_LEVELS.has(compressionLevel)) {
      return res.status(400).json({ error: 'Level kompresi harus low, recommended, atau extreme.' });
    }

    await pool.execute(
      `INSERT INTO settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      ['compression_level', compressionLevel, compressionLevel]
    );

    res.json({ ok: true, compression_level: compressionLevel });
  } catch (error) {
    console.error('Gagal menyimpan pengaturan kompresi:', error.message);
    res.status(500).json({ error: 'Pengaturan gagal disimpan.' });
  }
});

export default router;
