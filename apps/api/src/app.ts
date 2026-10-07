import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { env, isProd } from './config';
import { logger } from './logger';
import { pingDb } from './db/pool';
import { errorHandler, notFoundHandler } from './middleware/error';
import { loadScope } from './middleware/scope';
import authRoutes from './routes/auth';
import competitionRoutes from './routes/competitions';
import publicRoutes from './routes/public';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = (req.headers['x-request-id'] as string) || randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/ready' },
  }));
  app.use(helmet());
  app.use(cors({
    // Production: only listed origins. Development with no list: allow any origin.
    origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : !isProd,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }));
  app.use(compression({ filter: (req, res) => (req.path.endsWith('/stream') ? false : compression.filter(req, res)) }));
  app.use(express.json({ limit: '100kb' }));

  // Liveness vs readiness (readiness checks the DB pool)
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/ready', async (_req, res) => {
    try { await pingDb(); res.json({ status: 'ready' }); }
    catch { res.status(503).json({ status: 'unavailable' }); }
  });

  const api = express.Router();
  api.use(rateLimit({ windowMs: 60_000, limit: env.RATE_LIMIT_PER_MIN, standardHeaders: 'draft-7', legacyHeaders: false,
    // SSE connections are long-lived and cheap; don't count them against the limit.
    skip: (req) => req.path.endsWith('/stream'),
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } } }));
  api.use('/auth', authRoutes);
  api.use('/competitions', competitionRoutes);
  api.use('/public/:slug/:category', loadScope, publicRoutes);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
