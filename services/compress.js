import fs from 'fs/promises';
import path from 'path';
import ILovePDFApi from '@ilovepdf/ilovepdf-nodejs';
import ILovePDFFile from '@ilovepdf/ilovepdf-nodejs/ILovePDFFile.js';

// Resolves a stored basename and rejects paths that could escape the originals directory.
function resolveOriginalPath(originalDir, filename) {
  if (typeof filename !== 'string' || !filename || filename !== filename.split(/[\\/]/).pop()) {
    throw new Error('Nama file asli tidak valid.');
  }

  const filePath = path.resolve(originalDir, filename);
  const relative = path.relative(originalDir, filePath);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Nama file asli tidak valid.');
  }
  return filePath;
}

// Removes credential-like values from SDK messages before errors reach worker logs or the database.
function safeApiError(error, credentials) {
  const rawMessage = error instanceof Error ? error.message : String(error);
  let message = rawMessage
    .replace(/\bBearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/\b(public|secret|api)[ _-]?key\s*[:=]\s*[^\s,;"']+/gi, '$1 key=[REDACTED]');
  for (const credential of credentials) {
    if (credential) message = message.replaceAll(credential, '[REDACTED]');
  }
  return new Error(`Kompresi iLovePDF gagal: ${message || 'Kesalahan tidak diketahui.'}`);
}

// Runs a remote iLovePDF compression task and writes only a verified PDF to the worker temp path.
export async function compressPdf({ originalDir, filename, temporaryPath, compressionLevel }) {
  if (filename.split('.').pop()?.toLowerCase() !== 'pdf') {
    throw new Error('Konversi Word/PPT belum didukung');
  }
  if (!['low', 'recommended', 'extreme'].includes(compressionLevel)) {
    throw new Error('Level kompresi tidak valid.');
  }

  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;
  const secretKey = process.env.ILOVEPDF_SECRET_KEY;
  if (!publicKey || !secretKey) {
    throw new Error('Kredensial API iLovePDF belum dikonfigurasi.');
  }

  const originalPath = resolveOriginalPath(originalDir, filename);
  let task;
  let taskStarted = false;

  try {
    const sourceBytes = await fs.readFile(originalPath);
    const inputFile = ILovePDFFile.fromArray(sourceBytes, filename);
    const api = new ILovePDFApi(publicKey, secretKey);
    task = api.newTask('compress');

    await task.start();
    taskStarted = true;
    await task.addFile(inputFile);
    await task.process({ compression_level: compressionLevel });

    const downloadedData = await task.download();
    const outputBytes = Buffer.from(downloadedData);
    if (outputBytes.length < 5 || outputBytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('Hasil kompresi iLovePDF bukan PDF yang valid.');
    }

    await fs.writeFile(temporaryPath, outputBytes, { flag: 'wx' });
    return outputBytes.byteLength;
  } catch (error) {
    await fs.unlink(temporaryPath).catch((cleanupError) => {
      if (cleanupError.code !== 'ENOENT') {
        console.error('Gagal membersihkan hasil sementara iLovePDF:', cleanupError.message);
      }
    });
    throw safeApiError(error, [publicKey, secretKey]);
  } finally {
    if (taskStarted) {
      try {
        await task.delete();
      } catch {
        console.error('Gagal menghapus task sementara iLovePDF.');
      }
    }
  }
}
