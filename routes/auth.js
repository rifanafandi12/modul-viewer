import { Router } from 'express';
import { createAdminSession, verifyCredentials } from '../services/auth.js';

const router = Router();
export const SESSION_COOKIE_NAME = 'modul_viewer.sid';
export const SESSION_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax'
};

// Requires an authenticated admin session for protected endpoints.
export function requireAuth(req, res, next) {
  if (!req.session?.admin?.id) {
    return res.status(401).json({ error: 'Autentikasi diperlukan' });
  }

  next();
}

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const user = await verifyCredentials(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    await createAdminSession(req, user);
    res.json({ ok: true, user });
  } catch (error) {
    console.error('Gagal memproses login admin:', error.message);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

router.post('/logout', (req, res) => {
  if (!req.session) {
    res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS);
    return res.json({ ok: true });
  }

  req.session.destroy((error) => {
    if (error) {
      console.error('Gagal mengakhiri sesi admin:', error.message);
      return res.status(500).json({ error: 'Terjadi kesalahan server' });
    }

    res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS);
    res.json({ ok: true });
  });
});

if (process.env.NODE_ENV === 'test') {
  router.get('/_test/protected', requireAuth, (req, res) => {
    res.json({ ok: true });
  });
}

export default router;
