/**
 * Creates the first admin user (from ADMIN_EMAIL / ADMIN_PASSWORD) and the "itu-2026" competition.
 * Add `--demo` to also insert 18 sample teams per category with qualification matches/scores.
 */
import bcrypt from 'bcryptjs';
import { env } from '../config';
import { logger } from '../logger';
import { pool, closePool } from './pool';
import { migrate } from './migrate';
import { ensureCompetition } from './ensureCompetition';
import { CATEGORIES } from '@itu/shared';

async function main() {
  await migrate();
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 12 chars) to seed an admin');
  const hash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await pool.query(
    `INSERT INTO admin_users (email, password_hash) VALUES ($1,$2)
     ON CONFLICT ((lower(email))) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [env.ADMIN_EMAIL, hash],
  );
  const comp = { id: await ensureCompetition('itu-2026', 'ITU 2026') };
  logger.info({ admin: env.ADMIN_EMAIL }, 'Seeded admin + itu-2026');

  if (process.argv.includes('--demo')) {
    for (const cat of CATEGORIES) {
      const prefix = cat === 'JUNIOR' ? 'J' : 'S';
      const ids: string[] = [];
      for (let i = 1; i <= 18; i++) {
        const r = await pool.query(
          `INSERT INTO teams (competition_id, category, code, name) VALUES ($1,$2,$3,$4)
           ON CONFLICT (competition_id, category, code) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [comp.id, cat, `${prefix}${String(i).padStart(2, '0')}`, `Demo team ${prefix}${i}`],
        );
        ids.push(r.rows[0].id);
      }
      // Round 1: pairs (1v2, 3v4, ...), Round 2: shifted pairs. Scores are deterministic demo numbers.
      for (const [round, base, shift] of [['FIRST_QUALIFICATION', 1, 0], ['SECOND_QUALIFICATION', 101, 1]] as const) {
        for (let m = 0; m < 9; m++) {
          const a = ids[(m * 2 + shift) % 18], b = ids[(m * 2 + 1 + shift) % 18];
          await pool.query(
            `INSERT INTO matches (competition_id, category, match_number, round, team_a_id, team_b_id, score_a, score_b, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'COMPLETED') ON CONFLICT (competition_id, category, match_number) DO NOTHING`,
            [comp.id, cat, base + m, round, a, b, 55 + ((m * 37 + shift * 11) % 40), 55 + ((m * 53 + shift * 7 + 5) % 40)],
          );
        }
      }
    }
    logger.info('Demo teams and qualification matches inserted');
  }
}

main()
  .then(() => closePool())
  .catch(async (err) => { logger.error({ err }, 'Seed failed'); await closePool().catch(() => undefined); process.exit(1); });
