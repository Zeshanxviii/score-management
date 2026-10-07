import { CATEGORIES } from '@itu/shared';
import { pool } from './pool';

/** Idempotently creates a competition with live-state + visibility rows for every category/board. */
export async function ensureCompetition(slug: string, name: string): Promise<string> {
  const { rows } = await pool.query(
    'INSERT INTO competitions (slug, name) VALUES ($1,$2) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id',
    [slug, name],
  );
  const id: string = rows[0].id;
  await pool.query('INSERT INTO live_state (competition_id, category) SELECT $1, unnest($2::category[]) ON CONFLICT DO NOTHING', [id, CATEGORIES]);
  await pool.query(
    `INSERT INTO display_settings (competition_id, category, board)
     SELECT $1, c, b FROM unnest(enum_range(NULL::category)) c, unnest(enum_range(NULL::board_type)) b ON CONFLICT DO NOTHING`,
    [id],
  );
  return id;
}
