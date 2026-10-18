import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const SECRET = process.env.APP_SECRET || 'default-secret';

export function generateToken(payload, ttlSeconds = 300) {
  const data = { ...payload, exp: Date.now() + ttlSeconds * 1000 };
  const json = JSON.stringify(data);
  const b64 = Buffer.from(json).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;

  const expected = crypto.createHmac('sha256', SECRET).update(b64).digest('base64url');
  if (expected !== sig) return null;

  try {
    const data = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}