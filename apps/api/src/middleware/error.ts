import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../logger';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.issues } });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  const e = err as { code?: string; detail?: string; type?: string; status?: number };
  if (e?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON body' } });
  }
  if (e?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } });
  }
  // PostgreSQL constraint violations -> meaningful 4xx
  switch (e?.code) {
    case '23505':
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with these values already exists' } });
    case '23503': {
      const inUse = /still referenced/i.test(e.detail ?? '');
      return res.status(inUse ? 409 : 400).json({
        error: { code: inUse ? 'IN_USE' : 'INVALID_REFERENCE', message: inUse ? 'Record is still used by matches' : 'Referenced record does not exist in this category' },
      });
    }
    case '23514':
      return res.status(400).json({ error: { code: 'CONSTRAINT_VIOLATION', message: 'Values violate a competition rule (e.g. winner must be team A or B, teams must differ)' } });
    case '22P02':
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Invalid identifier or value format' } });
  }
  logger.error({ err, reqId: (req as Request & { id?: string }).id }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}
