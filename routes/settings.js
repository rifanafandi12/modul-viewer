import { Router } from 'express';
import { pool } from '../services/db.js';
import { requireAuth } from './auth.js';

const router = Router();
const COMPRESSION_LEVELS = new Set(['low', 'recommended', 'extreme']);

router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT setting_key, setting_value FROM settings WHERE setting_key IN (?, ?)',
      ['compression_level', 'enable_compression']
    );

    const settings = Object.fromEntries(rows.map(({ setting_key, setting_value }) => [setting_key, setting_value]));
    const compressionLevel = settings.compression_level;
    if (!COMPRESSION_LEVELS.has(compressionLevel)) {
      return res.status(500).json({ error: 'Pengaturan level kompresi tidak valid.' });
    }
    if (!['true', 'false'].includes(settings.enable_compression)) {
      return res.status(500).json({ error: 'Pengaturan kompresi otomatis belum tersedia atau tidak valid.' });
    }

    res.json({
      compression_level: compressionLevel,
      enable_compression: settings.enable_compression === 'true'
    });
  } catch (error) {
    console.error('Gagal membaca pengaturan kompresi:', error.message);
    res.status(500).json({ error: 'Pengaturan gagal dibaca.' });
  }
});

router.patch('/', requireAuth, async (req, res) => {
  try {
    const hasCompressionLevel = Object.hasOwn(req.body || {}, 'compression_level');
    const hasEnableCompression = Object.hasOwn(req.body || {}, 'enable_compression');
    const compressionLevel = req.body?.compression_level;
    const enableCompression = req.body?.enable_compression;

    if (!hasCompressionLevel && !hasEnableCompression) {
      return res.status(400).json({ error: 'Minimal satu pengaturan harus dikirim.' });
    }
    if (hasCompressionLevel && (typeof compressionLevel !== 'string' || !COMPRESSION_LEVELS.has(compressionLevel))) {
      return res.status(400).json({ error: 'Level kompresi harus low, recommended, atau extreme.' });
    }
    if (hasEnableCompression && typeof enableCompression !== 'boolean') {
      return res.status(400).json({ error: 'enable_compression harus berupa boolean.' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      if (hasCompressionLevel) {
        await connection.execute(
          `INSERT INTO settings (setting_key, setting_value)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE setting_value = ?`,
          ['compression_level', compressionLevel, compressionLevel]
        );
      }
      if (hasEnableCompression) {
        const settingValue = String(enableCompression);
        await connection.execute(
          `INSERT INTO settings (setting_key, setting_value)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE setting_value = ?`,
          ['enable_compression', settingValue, settingValue]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    res.json({
      ok: true,
      ...(hasCompressionLevel && { compression_level: compressionLevel }),
      ...(hasEnableCompression && { enable_compression: enableCompression })
    });
  } catch (error) {
    console.error('Gagal menyimpan pengaturan kompresi:', error.message);
    res.status(500).json({ error: 'Pengaturan gagal disimpan.' });
  }
});

export default router;
