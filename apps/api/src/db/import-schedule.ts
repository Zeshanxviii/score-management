/**
 * Imports the official ITU 2026 workbook (converted to data/itu-2026-schedule.json) for both categories:
 *  - teams found in the qualification rounds
 *  - every match with its start time (match + preparation slot = 5 min)
 * Knockout matches are created WITHOUT teams: pairings are assigned manually by the administrator.
 * Existing matches are left untouched unless --force is passed (so live scores are never overwritten by accident).
 *
 * Env: EVENT_DATE (default from file), EVENT_TZ_OFFSET (default +05:30)
 */
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config';
import { logger } from '../logger';
import { pool, closePool, withTransaction } from './pool';
import { migrate } from './migrate';
import { ensureCompetition } from './ensureCompetition';

interface Row { no: number; round: string; teamA: string | null; teamB: string | null; start: string | null }
interface File { event: { name: string; date: string }; categories: Record<string, Row[]> }

async function main() {
  const force = process.argv.includes('--force');
  const file: File = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/itu-2026-schedule.json'), 'utf8'));
  const date = process.env.EVENT_DATE ?? file.event.date;
  const offset = process.env.EVENT_TZ_OFFSET ?? '+05:30';
  void env;
  await migrate();
  const competitionId = await ensureCompetition('itu-2026', file.event.name);

  for (const [category, rows] of Object.entries(file.categories)) {
    await withTransaction(async (c) => {
      const codes = [...new Set(rows.flatMap((r) => [r.teamA, r.teamB]).filter((x): x is string => !!x))];
      await c.query(
        `INSERT INTO teams (competition_id, category, code) SELECT $1, $2, unnest($3::text[]) ON CONFLICT (competition_id, category, code) DO NOTHING`,
        [competitionId, category, codes],
      );
      const ids = new Map((await c.query('SELECT id, code FROM teams WHERE competition_id=$1 AND category=$2', [competitionId, category])).rows.map((t) => [t.code, t.id]));
      let inserted = 0;
      for (const r of rows) {
        const at = r.start ? `${date}T${r.start}:00${offset}` : null;
        const res = await c.query(
          `INSERT INTO matches (competition_id, category, match_number, round, team_a_id, team_b_id, scheduled_at, duration_minutes, buffer_minutes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,2,3)
           ON CONFLICT (competition_id, category, match_number) ${force
             ? 'DO UPDATE SET round=EXCLUDED.round, team_a_id=EXCLUDED.team_a_id, team_b_id=EXCLUDED.team_b_id, scheduled_at=EXCLUDED.scheduled_at, version=matches.version+1'
             : 'DO NOTHING'}`,
          [competitionId, category, r.no, r.round, r.teamA ? ids.get(r.teamA) : null, r.teamB ? ids.get(r.teamB) : null, at],
        );
        inserted += res.rowCount ?? 0;
      }
      logger.info({ category, teams: codes.length, matches: rows.length, written: inserted }, 'Schedule imported');
    });
  }
}

main()
  .then(() => closePool())
  .catch(async (err) => { logger.error({ err }, 'Import failed'); await closePool().catch(() => undefined); process.exit(1); });
