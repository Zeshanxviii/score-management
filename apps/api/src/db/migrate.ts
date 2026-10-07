import fs from 'node:fs';
import path from 'node:path';
import { pool, closePool } from './pool';
import { logger } from '../logger';

// Works from both src/db (tsx) and dist/db (compiled): ../../migrations
const DIR = path.resolve(__dirname, '../../migrations');

export async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    // Advisory lock so concurrent instances starting together don't race.
    await client.query('SELECT pg_advisory_lock(727274)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const done = new Set((await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      logger.info({ file }, 'Applying migration');
      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(path.join(DIR, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    logger.info('Migrations up to date');
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)').catch(() => undefined);
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then(() => closePool())
    .catch(async (err) => {
      logger.error({ err }, 'Migration failed');
      await closePool().catch(() => undefined);
      process.exit(1);
    });
}
