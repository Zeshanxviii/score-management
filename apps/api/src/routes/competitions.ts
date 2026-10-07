import { Router } from 'express';
import multer from 'multer';
import { CompetitionCreateSchema, CATEGORIES } from '@itu/shared';
import { pool, withTransaction } from '../db/pool';
import { requireAdmin, getUser } from '../middleware/auth';
import { loadScope } from '../middleware/scope';
import { audit } from '../services/audit';
import { AppError, notFound } from '../utils/errors';
import { parseTeamsWorkbook, importParsedTeams, shuffleAlliances } from '../services/teams-excel';
import scoped from './scoped';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/\.xlsx?$/i.test(file.originalname) || file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel')) cb(null, true);
    else cb(new AppError(400, 'BAD_FILE', 'Upload an .xlsx workbook'));
  },
});

const r = Router();
r.use(requireAdmin);

r.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, slug, name, created_at AS "createdAt" FROM competitions ORDER BY created_at DESC');
  res.json({ data: rows });
});

r.post('/', async (req, res) => {
  const body = CompetitionCreateSchema.parse(req.body);
  const out = await withTransaction(async (c) => {
    const { rows } = await c.query('INSERT INTO competitions (slug, name) VALUES ($1,$2) RETURNING id, slug, name, created_at AS "createdAt"', [body.slug, body.name]);
    const comp = rows[0];
    // Independent state per category: live board pointer + visibility for every board.
    await c.query('INSERT INTO live_state (competition_id, category) SELECT $1, unnest($2::category[])', [comp.id, CATEGORIES]);
    await c.query(
      `INSERT INTO display_settings (competition_id, category, board)
       SELECT $1, c, b FROM unnest(enum_range(NULL::category)) c, unnest(enum_range(NULL::board_type)) b`,
      [comp.id],
    );
    await audit(c, { competitionId: comp.id, actorId: getUser(res).id, entity: 'competition', entityId: comp.id, action: 'CREATE', after: comp });
    return comp;
  });
  res.status(201).json({ data: out });
});

r.get('/:slug', async (req, res) => {
  const { rows } = await pool.query('SELECT id, slug, name, created_at AS "createdAt" FROM competitions WHERE slug=$1', [String(req.params.slug)]);
  if (!rows[0]) throw notFound('Competition');
  res.json({ data: rows[0] });
});

r.get('/:slug/audit', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.entity, a.entity_id AS "entityId", a.action, a.before, a.after, a.created_at AS "createdAt", u.email AS actor
       FROM audit_log a JOIN competitions c ON c.id=a.competition_id LEFT JOIN admin_users u ON u.id=a.actor_id
      WHERE c.slug=$1 ORDER BY a.id DESC LIMIT 200`,
    [String(req.params.slug)],
  );
  res.json({ data: rows });
});

/* Excel team import: reads the "Confirmed teams" workbook, upserts J*->JUNIOR / S*->SENIOR
   and assigns RED/BLUE in balanced random order per category. */
r.post('/:slug/teams/import', upload.single('file'), async (req, res) => {
  const slug = String(req.params.slug);
  const { rows } = await pool.query('SELECT id FROM competitions WHERE slug=$1', [slug]);
  if (!rows[0]) throw notFound('Competition');
  if (!req.file) throw new AppError(400, 'NO_FILE', 'Attach the workbook as multipart field "file"');
  const { teams, skipped } = parseTeamsWorkbook(req.file.buffer);
  if (!teams.length) throw new AppError(400, 'NO_TEAMS', 'No team rows found in the workbook');
  const counts = await importParsedTeams(rows[0].id, teams, getUser(res).id);
  const red = teams.filter((t) => t.alliance === 'RED').length;
  res.status(201).json({ data: { ...counts, red, blue: teams.length - red, skipped } });
});

/* Re-randomises RED/BLUE evenly across existing teams (per category). */
r.post('/:slug/teams/shuffle-alliance', async (req, res) => {
  const slug = String(req.params.slug);
  const { rows } = await pool.query('SELECT id FROM competitions WHERE slug=$1', [slug]);
  if (!rows[0]) throw notFound('Competition');
  const byCategory = await shuffleAlliances(rows[0].id);
  await audit(pool, { competitionId: rows[0].id, actorId: getUser(res).id, entity: 'team', action: 'SHUFFLE_ALLIANCE', after: byCategory });
  res.json({ data: byCategory });
});

r.use('/:slug/categories/:category', loadScope, scoped);
export default r;
