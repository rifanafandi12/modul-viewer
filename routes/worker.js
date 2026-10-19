import { Router } from 'express';
import { timingSafeEqual } from 'crypto';
import { processQueue } from '../workers/queue.js';

const router = Router();

// Compares the supplied cron key without exposing secret values or timing details.
function matchesCronSecret(suppliedKey, configuredSecret) {
  if (typeof suppliedKey !== 'string' || typeof configuredSecret !== 'string' || !configuredSecret) {
    return false;
  }
  if (Buffer.byteLength(suppliedKey) !== Buffer.byteLength(configuredSecret)) return false;

  const suppliedBuffer = Buffer.from(suppliedKey);
  const configuredBuffer = Buffer.from(configuredSecret);
  return suppliedBuffer.length === configuredBuffer.length
    && timingSafeEqual(suppliedBuffer, configuredBuffer);
}

router.get('/run', (req, res) => {
  if (!matchesCronSecret(req.query.key, process.env.CRON_SECRET)) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  res.status(202).json({ ok: true, message: 'Worker triggered' });
  setImmediate(() => {
    void processQueue().catch((error) => {
      console.error('Worker background gagal:', error.message);
    });
  });
});

export default router;
