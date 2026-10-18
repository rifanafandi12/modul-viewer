import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const SECRET = process.env.APP_SECRET;

const FORBIDDEN_SECRETS = new Set([
  'CHANGEME_GENERATE_WITH_NODE_CRYPTO',
  'default-secret',
  'ganti-dengan-string-acak-panjang-minimal-32-karakter',
  'ubah-ini-jadi-string-acak-minimal-32-karakter'
]);

function validateSecret(secret) {
  if (!secret || typeof secret !== 'string') {
    throw new Error(
      'APP_SECRET tidak di-set di .env. ' +
      'Generate dengan: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  if (secret.length < 32) {
    throw new Error(
      `APP_SECRET terlalu pendek (${secret.length} karakter, minimal 32). ` +
      'Generate dengan: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  if (FORBIDDEN_SECRETS.has(secret)) {
    throw new Error(
      'APP_SECRET masih memakai nilai placeholder dari .env.example atau contoh. ' +
      'Ganti dengan string acak. Generate dengan: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  if (/^(.)\1+$/.test(secret)) {
    throw new Error(
      'APP_SECRET terdiri dari satu karakter berulang. ' +
      'Gunakan string acak dari crypto.randomBytes.'
    );
  }
}

validateSecret(SECRET);

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