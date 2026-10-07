import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { CategorySchema, type Category } from '@itu/shared';
import { pool } from '../db/pool';
import { AppError, notFound } from '../utils/errors';

export interface Scope { competitionId: string; competitionName: string; slug: string; category: Category }

/** Resolves :slug + :category into a validated scope. Every data query is filtered by it (category isolation). */
export async function loadScope(req: Request, res: Response, next: NextFunction) {
  const slug = z.string().min(1).max(64).parse(String(req.params.slug));
  const category = CategorySchema.parse(String(req.params.category).toUpperCase());
  const { rows } = await pool.query<{ id: string; name: string }>('SELECT id, name FROM competitions WHERE slug = $1', [slug]);
  if (!rows[0]) throw notFound('Competition');
  res.locals.scope = { competitionId: rows[0].id, competitionName: rows[0].name, slug, category } satisfies Scope;
  next();
}

export function getScope(res: Response): Scope {
  const s = res.locals.scope as Scope | undefined;
  if (!s) throw new AppError(500, 'INTERNAL', 'Scope not loaded');
  return s;
}
