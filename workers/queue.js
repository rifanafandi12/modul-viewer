import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { pool } from '../services/db.js';
import { compressPdf } from '../services/compress.js';

dotenv.config();

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const storageDir = path.resolve(rootDir, process.env.STORAGE_PATH || './storage');
const originalDir = path.join(storageDir, 'original');
const optimizedDir = path.join(storageDir, 'optimized');
const POLL_DELAY_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 60_000;
const STALE_AFTER_MINUTES = 15;
const COMPRESSION_LEVELS = new Set(['low', 'recommended', 'extreme']);
let stopping = false;

// Pauses the queue loop without blocking the event loop.
function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Resolves a stored basename and rejects paths that could escape their storage folder.
function resolveStoredPath(directory, filename) {
  if (typeof filename !== 'string' || !filename || path.basename(filename) !== filename) {
    throw new Error('Path file modul tidak valid.');
  }

  const filePath = path.resolve(directory, filename);
  const relative = path.relative(directory, filePath);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Path file modul tidak valid.');
  }
  return filePath;
}

// Requeues jobs whose worker lease expired and returns their modules to pending.
async function recoverStaleJobs() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE jobs
       SET status = 'pending', started_at = NULL, error = NULL
       WHERE type = 'compress' AND status = 'processing'
         AND started_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [STALE_AFTER_MINUTES]
    );
    await connection.execute(
      `UPDATE modules m
       INNER JOIN jobs j ON j.module_id = m.id
       SET m.status = 'pending'
       WHERE j.type = 'compress' AND j.status = 'pending' AND m.status = 'processing'`
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Claims one pending compression job under a row lock before returning it to the loop.
async function claimJob() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT id, module_id
       FROM jobs
       WHERE type = 'compress' AND status = 'pending'
       ORDER BY created_at ASC, id ASC
       LIMIT 1 FOR UPDATE`
    );

    if (rows.length === 0) {
      await connection.commit();
      return null;
    }

    const job = rows[0];
    const [jobUpdate] = await connection.execute(
      `UPDATE jobs SET status = 'processing', started_at = NOW(), finished_at = NULL, error = NULL
       WHERE id = ? AND status = 'pending'`,
      [job.id]
    );
    if (jobUpdate.affectedRows !== 1) {
      await connection.rollback();
      return null;
    }

    await connection.execute("UPDATE modules SET status = 'processing' WHERE id = ?", [job.module_id]);
    await connection.commit();
    return job;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Refreshes the processing timestamp so recovery only requeues jobs from a dead worker.
function startHeartbeat(jobId) {
  return setInterval(() => {
    pool.execute(
      "UPDATE jobs SET started_at = NOW() WHERE id = ? AND status = 'processing'",
      [jobId]
    ).catch((error) => console.error('Gagal memperbarui lease job:', error.message));
  }, HEARTBEAT_INTERVAL_MS);
}

// Marks a claimed job and its module failed with the original processing error message.
async function markJobFailed(job, message) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [jobUpdate] = await connection.execute(
      "UPDATE jobs SET status = 'failed', error = ?, finished_at = NOW() WHERE id = ? AND status = 'processing'",
      [message, job.id]
    );
    await connection.execute(
      "UPDATE modules SET status = 'failed' WHERE id = ?",
      [job.module_id]
    );
    if (jobUpdate.affectedRows !== 1) {
      throw new Error('Status job tidak berubah menjadi failed.');
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Stores the optimized file reference and completes the job in one database transaction.
async function markJobDone(job, filename) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [moduleUpdate] = await connection.execute(
      "UPDATE modules SET optimized_file = ?, status = 'ready' WHERE id = ? AND status = 'processing'",
      [filename, job.module_id]
    );
    const [jobUpdate] = await connection.execute(
      "UPDATE jobs SET status = 'done', error = NULL, finished_at = NOW() WHERE id = ? AND status = 'processing'",
      [job.id]
    );
    if (moduleUpdate.affectedRows !== 1 || jobUpdate.affectedRows !== 1) {
      throw new Error('Status job berubah sebelum penyimpanan selesai.');
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Compresses one claimed job and keeps temporary output invisible until the PDF is complete.
async function processJob(job) {
  let temporaryPath;
  let finalPath;
  let heartbeat;

  try {
    const temporaryName = `.job-${job.id}-${randomBytes(8).toString('hex')}.tmp`;
    const finalName = `job-${job.id}.pdf`;
    temporaryPath = path.join(optimizedDir, temporaryName);
    finalPath = resolveStoredPath(optimizedDir, finalName);
    heartbeat = startHeartbeat(job.id);

    const [rows] = await pool.execute(
      'SELECT original_file FROM modules WHERE id = ?',
      [job.module_id]
    );
    if (rows.length === 0) throw new Error('Modul tidak ditemukan.');

    const [settingsRows] = await pool.execute(
      'SELECT setting_value FROM settings WHERE setting_key = ?',
      ['compression_level']
    );
    const compressionLevel = settingsRows[0]?.setting_value;
    if (!COMPRESSION_LEVELS.has(compressionLevel)) {
      throw new Error('Pengaturan level kompresi tidak ada atau tidak valid.');
    }

    const originalPath = resolveStoredPath(originalDir, rows[0].original_file);
    const filename = path.basename(originalPath);
    await compressPdf({ originalDir, filename, temporaryPath, compressionLevel });
    await fs.rename(temporaryPath, finalPath);
    await markJobDone(job, finalName);
  } catch (err) {
    console.error('Gagal memproses job', job.id, err);

    for (const filePath of [temporaryPath, finalPath].filter(Boolean)) {
      await fs.unlink(filePath).catch((cleanupError) => {
        if (cleanupError.code !== 'ENOENT') {
          console.error('Gagal membersihkan output kompresi:', cleanupError);
        }
      });
    }

    const errorMessage = err instanceof Error ? err.message : String(err);
    try {
      await markJobFailed(job, errorMessage);
    } catch (statusError) {
      console.error('Gagal menyimpan status job gagal:', job.id, statusError);
      throw statusError;
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

// Runs the worker continuously, sleeping between polls when the queue is empty.
async function run() {
  await fs.access(originalDir);
  await fs.access(optimizedDir);
  await recoverStaleJobs();
  let lastRecovery = Date.now();

  while (!stopping) {
    try {
      if (Date.now() - lastRecovery >= HEARTBEAT_INTERVAL_MS) {
        await recoverStaleJobs();
        lastRecovery = Date.now();
      }

      const job = await claimJob();
      if (!job) {
        await delay(POLL_DELAY_MS);
        continue;
      }

      console.log(`Memproses job kompresi ${job.id}.`);
      await processJob(job);
    } catch (error) {
      console.error('Worker antrean gagal:', error.message);
      await delay(POLL_DELAY_MS);
    }
  }

  await pool.end();
}

process.once('SIGINT', () => { stopping = true; });
process.once('SIGTERM', () => { stopping = true; });

run().catch(async (error) => {
  console.error('Worker tidak dapat dijalankan:', error.message);
  await pool.end();
  process.exitCode = 1;
});
