import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { pool } from '../services/db.js';
import { requireAuth } from './auth.js';

const router = Router();
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MIME_TYPES = {
  '.pdf': ['application/pdf', 'application/octet-stream'],
  '.doc': ['application/msword', 'application/octet-stream'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/octet-stream'
  ],
  '.ppt': ['application/vnd.ms-powerpoint', 'application/octet-stream'],
  '.pptx': [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/octet-stream'
  ]
};

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, req.app.locals.tmpDir);
  },
  filename(req, file, callback) {
    callback(null, `${Date.now()}-${randomBytes(12).toString('hex')}.upload`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 1, fieldSize: 1024 },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!MIME_TYPES[extension] || !MIME_TYPES[extension].includes(file.mimetype)) {
      const error = new Error('Jenis file harus PDF, Word, atau PowerPoint.');
      error.status = 400;
      return callback(error);
    }

    callback(null, true);
  }
});

// Converts a title into a URL-safe base slug.
function slugify(value) {
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200) || 'modul';
}

// Confirms that the uploaded file signature is consistent with its extension.
async function validateFileSignature(filePath, extension) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const header = buffer.subarray(0, bytesRead);

    if (extension === '.pdf') return header.includes(Buffer.from('%PDF-'));
    if (extension === '.doc' || extension === '.ppt') {
      return header.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    }
    return header.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  } finally {
    await handle.close();
  }
}

// Moves an upload across filesystems by copying before removing the temporary file.
async function moveUpload(sourcePath, destinationPath) {
  try {
    await fs.rename(sourcePath, destinationPath);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fs.copyFile(sourcePath, destinationPath, fsConstants.COPYFILE_EXCL);
    await fs.unlink(sourcePath);
  }
}

// Parses one multipart file while returning upload errors as JSON responses.
function receiveUpload(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();

    const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
      ? 413
      : error.status || 400;
    res.status(status).json({ error: status === 413 ? 'Ukuran file maksimal 20 MB.' : error.message });
  });
}

// Resolves a stored basename and rejects paths that could escape its storage directory.
function resolveStoredFile(directory, filename) {
  if (typeof filename !== 'string' || !filename || path.basename(filename) !== filename) {
    const error = new Error('Path file modul tidak valid.');
    error.status = 400;
    throw error;
  }

  const filePath = path.resolve(directory, filename);
  const relative = path.relative(directory, filePath);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    const error = new Error('Path file modul tidak valid.');
    error.status = 400;
    throw error;
  }

  return filePath;
}

router.delete('/:id', requireAuth, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'ID modul tidak valid.' });
  }

  let connection;
  let transactionStarted = false;
  const stagedFiles = [];

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [rows] = await connection.execute(
      'SELECT id, original_file, optimized_file FROM modules WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (rows.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'Modul tidak ditemukan.' });
    }

    const module = rows[0];
    const files = [
      resolveStoredFile(req.app.locals.originalDir, module.original_file),
      module.optimized_file
        ? resolveStoredFile(req.app.locals.optimizedDir, module.optimized_file)
        : null
    ].filter(Boolean);

    for (const sourcePath of new Set(files)) {
      let fileStats;
      try {
        fileStats = await fs.lstat(sourcePath);
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      if (!fileStats.isFile()) {
        const error = new Error('File modul bukan file reguler.');
        error.status = 409;
        throw error;
      }

      const stagedPath = path.join(req.app.locals.tmpDir, `delete-${randomBytes(16).toString('hex')}`);
      try {
        await moveUpload(sourcePath, stagedPath);
        stagedFiles.push({ sourcePath, stagedPath });
      } catch (error) {
        try {
          await fs.access(stagedPath);
          await moveUpload(stagedPath, sourcePath);
        } catch {
          // Keep the original error; any failed restoration is reported below during rollback.
        }
        throw error;
      }
    }

    await connection.execute('DELETE FROM jobs WHERE module_id = ?', [module.id]);
    await connection.execute('DELETE FROM modules WHERE id = ?', [module.id]);
    await connection.commit();
    transactionStarted = false;

    for (const file of stagedFiles) {
      try {
        await fs.unlink(file.stagedPath);
      } catch (error) {
        if (error.code !== 'ENOENT') console.error('Gagal membersihkan file modul yang dihapus:', error.message);
      }
    }

    res.json({ ok: true });
  } catch (error) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Gagal membatalkan transaksi hapus modul:', rollbackError.message);
      }
    }

    for (const file of stagedFiles.reverse()) {
      try {
        await moveUpload(file.stagedPath, file.sourcePath);
      } catch (restoreError) {
        if (restoreError.code !== 'ENOENT') console.error('Gagal memulihkan file modul:', restoreError.message);
      }
    }

    console.error('Gagal menghapus modul:', error.message);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Modul gagal dihapus.' });
  } finally {
    connection?.release();
  }
});

router.post('/', requireAuth, receiveUpload, async (req, res) => {
  let connection;
  let transactionStarted = false;
  let destinationPath;
  const temporaryPath = req.file?.path;

  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title || title.length > 255) {
      if (temporaryPath) {
        await fs.unlink(temporaryPath).catch((cleanupError) => {
          if (cleanupError.code !== 'ENOENT') console.error('Gagal membersihkan file sementara:', cleanupError.message);
        });
      }
      return res.status(400).json({ error: 'Judul wajib diisi dan maksimal 255 karakter.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'File modul wajib diunggah.' });
    }

    const extension = path.extname(req.file.originalname).toLowerCase();
    const isValidSignature = await validateFileSignature(temporaryPath, extension);
    if (!isValidSignature) {
      await fs.unlink(temporaryPath);
      return res.status(400).json({ error: 'Isi file tidak sesuai dengan ekstensi yang dikirim.' });
    }

    const filename = `${Date.now()}-${randomBytes(12).toString('hex')}${extension}`;
    destinationPath = path.join(req.app.locals.originalDir, filename);

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    await moveUpload(temporaryPath, destinationPath);
    let slug;
    let moduleResult;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      slug = `${slugify(title)}-${randomBytes(8).toString('hex')}`;
      try {
        [moduleResult] = await connection.execute(
          `INSERT INTO modules (title, slug, original_file, status, file_size)
           VALUES (?, ?, ?, 'pending', ?)`,
          [title, slug, filename, req.file.size]
        );
        break;
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY' || attempt === 2) throw error;
      }
    }
    const [jobResult] = await connection.execute(
      "INSERT INTO jobs (module_id, type, status) VALUES (?, 'compress', 'pending')",
      [moduleResult.insertId]
    );

    await connection.commit();
    transactionStarted = false;

    res.status(201).json({
      ok: true,
      module: {
        id: moduleResult.insertId,
        title,
        slug,
        original_file: filename,
        status: 'pending',
        file_size: req.file.size
      },
      job: { id: jobResult.insertId, status: 'pending' }
    });
  } catch (error) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Gagal membatalkan transaksi upload:', rollbackError.message);
      }
    }

    if (destinationPath) {
      try {
        await fs.unlink(destinationPath);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') console.error('Gagal membersihkan file upload:', cleanupError.message);
      }
    }
    if (temporaryPath) {
      try {
        await fs.unlink(temporaryPath);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') console.error('Gagal membersihkan file sementara:', cleanupError.message);
      }
    }

    console.error('Gagal menyimpan upload modul:', error.message);
    res.status(500).json({ error: 'Upload gagal disimpan. Silakan coba lagi.' });
  } finally {
    connection?.release();
  }
});

export default router;
