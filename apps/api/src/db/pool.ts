import { Pool, PoolClient, types } from 'pg';
import { env } from '../config';
import { logger } from '../logger';

// NUMERIC (oid 1700) arrives as string by default; scores are small so parse to JS numbers.
types.setTypeParser(1700, (v) => parseFloat(v));

export type Db = Pool | PoolClient;

/** One shared pool per process. Never create pools per request. */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
  statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
  application_name: 'itu-scoreboard-api',
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : undefined,
});

// An idle client erroring (e.g. DB restart) must not crash the process.
pool.on('error', (err) => logger.error({ err }, 'Unexpected error on idle pg client'));

/** Runs fn inside a transaction on a dedicated pooled client; always releases the client. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error({ err: rollbackErr }, 'Rollback failed');
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function pingDb(): Promise<void> {
  await pool.query('SELECT 1');
}

export async function closePool(): Promise<void> {
  await pool.end();
}
