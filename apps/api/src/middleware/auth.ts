import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config';
import { AppError } from '../utils/errors';

export interface AuthUser { id: string; email: string; role: string }

export function signToken(user: AuthUser): string {
  return jwt.sign({ email: user.email, role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError(401, 'UNAUTHORIZED', 'Missing bearer token');
  try {
    const p = jwt.verify(header.slice(7), env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    if (!p.sub || p.role !== 'ADMIN') throw new Error('bad claims');
    res.locals.user = { id: p.sub, email: p.email as string, role: p.role } satisfies AuthUser;
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
  next();
}

export const getUser = (res: Response): AuthUser => res.locals.user as AuthUser;
