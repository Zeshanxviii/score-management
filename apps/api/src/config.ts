import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().default(30_000),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().default(5_000),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().default(10_000),
  DB_SSL: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  CORS_ORIGINS: z.string().default('').transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(300),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:\n', JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}
export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
