import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { LoginSchema } from '@itu/shared';
import { pool } from '../db/pool';
import { AppError } from '../utils/errors';
import { getUser, requireAdmin, signToken } from '../middleware/auth';

const r = Router();
// Constant-time-ish response when the user does not exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
const loginLimiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts, try again in a minute' } } });

r.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = LoginSchema.parse(req.body);
  const { rows } = await pool.query('SELECT id, email, role, password_hash FROM admin_users WHERE lower(email) = lower($1)', [email]);
  const u = rows[0];
  const ok = await bcrypt.compare(password, u?.password_hash ?? DUMMY_HASH);
  if (!u || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  res.json({ data: { token: signToken({ id: u.id, email: u.email, role: u.role }), user: { id: u.id, email: u.email, role: u.role } } });
});

r.get('/me', requireAdmin, (_req, res) => res.json({ data: getUser(res) }));
export default r;
