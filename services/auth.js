import bcrypt from 'bcrypt';
import { pool } from './db.js';

// Verifies the supplied password against the stored admin password hash.
export async function verifyCredentials(username, password) {
  const [rows] = await pool.execute(
    'SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1',
    [username]
  );

  if (rows.length === 0) return null;

  const user = rows[0];
  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) return null;

  return { id: user.id, username: user.username };
}

// Regenerates the session ID before attaching the authenticated admin identity.
export async function createAdminSession(req, user) {
  await new Promise((resolve, reject) => {
    req.session.regenerate((error) => error ? reject(error) : resolve());
  });

  req.session.admin = user;

  await new Promise((resolve, reject) => {
    req.session.save((error) => error ? reject(error) : resolve());
  });
}
