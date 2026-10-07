import { Router } from 'express';
import { BoardSchema, IdSchema, LiveBoardSchema, MatchCreateSchema, MatchPatchSchema, RoundSchema, RoundScheduleSchema,
  SettingsPatchSchema, TeamBulkSchema, TeamCreateSchema, TeamPatchSchema, ThemeSchema, type Board } from '@itu/shared';
import { pool, withTransaction } from '../db/pool';
import { getScope } from '../middleware/scope';
import { getUser } from '../middleware/auth';
import { AppError, notFound } from '../utils/errors';
import { audit } from '../services/audit';
import { publishChange } from '../services/events';
import { getBoard, getLiveBoard, getSettings, getTheme } from '../services/boards';
import { getMatch, listMatches } from '../services/matches';

/** Admin routes for ONE competition + ONE category: /competitions/:slug/categories/:category/... (JWT required upstream) */
const r = Router({ mergeParams: true });

/* ============================== TEAMS ============================== */
r.get('/teams', async (_req, res) => {
  const { competitionId, category } = getScope(res);
  const { rows } = await pool.query('SELECT id, code, name, school_name AS "schoolName", alliance FROM teams WHERE competition_id=$1 AND category=$2 ORDER BY code', [competitionId, category]);
  res.json({ data: rows });
});

r.post('/teams', async (req, res) => {
  const { competitionId, category } = getScope(res);
  const body = TeamCreateSchema.parse(req.body);
  const { rows } = await pool.query('INSERT INTO teams (competition_id, category, code, name, school_name, alliance) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, code, name, school_name AS "schoolName", alliance', [competitionId, category, body.code, body.name ?? null, body.schoolName ?? null, body.alliance ?? null]);
  await audit(pool, { competitionId, actorId: getUser(res).id, entity: 'team', entityId: rows[0].id, action: 'CREATE', after: rows[0] });
  publishChange(competitionId, category);
  res.status(201).json({ data: rows[0] });
});

r.post('/teams/bulk', async (req, res) => {
  const { competitionId, category } = getScope(res);
  const { teams } = TeamBulkSchema.parse(req.body);
  const out = await withTransaction(async (c) => {
    const { rows } = await c.query(
      'INSERT INTO teams (competition_id, category, code, name, school_name, alliance) SELECT $1, $2, x.code, x.name, x.school_name, x.alliance FROM jsonb_to_recordset($3::jsonb) AS x(code text, name text, school_name text, alliance text) RETURNING id, code, name, school_name AS "schoolName", alliance',
      [competitionId, category, JSON.stringify(teams.map((t) => ({ code: t.code, name: t.name ?? null, school_name: t.schoolName ?? null, alliance: t.alliance ?? null })))],
    );
    await audit(c, { competitionId, actorId: getUser(res).id, entity: 'team', action: 'BULK_CREATE', after: { count: rows.length } });
    return rows;
  });
  publishChange(competitionId, category);
  res.status(201).json({ data: out });
});

r.patch('/teams/:id', async (req, res) => {
  const { competitionId, category } = getScope(res);
  const id = IdSchema.parse(req.params.id);
  const body = TeamPatchSchema.parse(req.body);
  const { rows } = await pool.query(
    `UPDATE teams SET code = COALESCE($4, code), name = CASE WHEN $5::boolean THEN $6 ELSE name END,
      school_name = CASE WHEN $7::boolean THEN $8 ELSE school_name END,
      alliance = CASE WHEN $9::boolean THEN $10 ELSE alliance END
      WHERE id=$1 AND competition_id=$2 AND category=$3 RETURNING id, code, name, school_name AS "schoolName", alliance`,
    [id, competitionId, category, body.code ?? null, body.name !== undefined, body.name ?? null, body.schoolName !== undefined, body.schoolName ?? null, body.alliance !== undefined, body.alliance ?? null],
  );
  if (!rows[0]) throw notFound('Team');
  await audit(pool, { competitionId, actorId: getUser(res).id, entity: 'team', entityId: id, action: 'UPDATE', after: rows[0] });
  publishChange(competitionId, category);
  res.json({ data: rows[0] });
});

r.delete('/teams/:id', async (req, res) => {
  const { competitionId, category } = getScope(res);
  const id = IdSchema.parse(req.params.id);
  const used = await pool.query(
    'SELECT 1 FROM matches WHERE competition_id=$2 AND category=$3 AND (team_a_id=$1 OR team_b_id=$1 OR winner_id=$1) LIMIT 1',
    [id, competitionId, category],
  );
  if (used.rowCount) throw new AppError(409, 'TEAM_IN_USE', 'This team is assigned to one or more matches. Remove it from those matches first.');
  const { rowCount } = await pool.query('DELETE FROM teams WHERE id=$1 AND competition_id=$2 AND category=$3', [id, competitionId, category]);
  if (!rowCount) throw notFound('Team');
  await audit(pool, { competitionId, actorId: getUser(res).id, entity: 'team', entityId: id, action: 'DELETE' });
  publishChange(competitionId, category);
  res.status(204).end();
});

/* ============================== MATCHES ============================== */
const COLS = { matchNumber: 'match_number', round: 'round', teamAId: 'team_a_id', teamBId: 'team_b_id', scoreA: 'score_a',
  scoreB: 'score_b', winnerId: 'winner_id', status: 'status', scheduledAt: 'scheduled_at' } as const;

function assertConsistent(a: string | null, b: string | null, w: string | null) {
  if (a && b && a === b) throw new AppError(400, 'SAME_TEAM', 'Team A and Team B must be different');
  if (w && w !== a && w !== b) throw new AppError(409, 'WINNER_INVALID', 'Winner must be Team A or Team B. Clear or change winnerId when changing the teams of a decided match.');
}

r.get('/matches', async (req, res) => {
  const { competitionId, category } = getScope(res);
  const round = req.query.round ? RoundSchema.parse(String(req.query.round).toUpperCase()) : undefined;
  res.json({ data: await listMatches(competitionId, category, { round }) });
});

r.get('/matches/:id', async (req, res) => {
  const { competitionId, category } = getScope(res);
  const m = await getMatch(competitionId, category, IdSchema.parse(req.params.id));
  if (!m) throw notFound('Match');
  res.json({ data: m });
});

r.post('/matches', async (req, res) => {
  const { competitionId, category } = getScope(res);
  const b = MatchCreateSchema.parse(req.body);
  assertConsistent(b.teamAId ?? null, b.teamBId ?? null, b.winnerId ?? null);
  const match = await withTransaction(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO matches (competition_id, category, match_number, round, team_a_id, team_b_id, score_a, score_b, winner_id, status, scheduled_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [competitionId, category, b.matchNumber, b.round, b.teamAId ?? null, b.teamBId ?? null, b.scoreA ?? null, b.scoreB ?? null, b.winnerId ?? null, b.status, b.scheduledAt ?? null],
    );
    const created = (await getMatch(competitionId, category, rows[0].id, c))!;
    await audit(c, { competitionId, actorId: getUser(res).id, entity: 'match', entityId: created.id, action: 'CREATE', after: created });
    return created;
  });
  publishChange(competitionId, category);
  res.status(201).json({ data: match });
});

/** Edits any field, including on COMPLETED matches (audited). Send `version` to detect concurrent edits. */
r.patch('/matches/:id', async (req, res) => {
  const { competitionId, category } = getScope(res);
  const id = IdSchema.parse(req.params.id);
  const body = MatchPatchSchema.parse(req.body);
  const updated = await withTransaction(async (c) => {
    const cur = (await c.query('SELECT team_a_id, team_b_id, winner_id, version FROM matches WHERE id=$1 AND competition_id=$2 AND category=$3 FOR UPDATE', [id, competitionId, category])).rows[0];
    if (!cur) throw notFound('Match');
    if (body.version !== undefined && body.version !== cur.version) {
      throw new AppError(409, 'VERSION_CONFLICT', 'This match was changed by someone else. Reload and try again.', { currentVersion: cur.version });
    }
    assertConsistent(
      body.teamAId !== undefined ? body.teamAId : cur.team_a_id,
      body.teamBId !== undefined ? body.teamBId : cur.team_b_id,
      body.winnerId !== undefined ? body.winnerId : cur.winner_id,
    );
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, col] of Object.entries(COLS)) {
      const v = (body as Record<string, unknown>)[key];
      if (v !== undefined) { vals.push(v); sets.push(`${col} = $${vals.length}`); }
    }
    if (!sets.length) throw new AppError(400, 'NO_CHANGES', 'No fields to update');
    const before = await getMatch(competitionId, category, id, c);
    vals.push(id);
    await c.query(`UPDATE matches SET ${sets.join(', ')}, version = version + 1 WHERE id = $${vals.length}`, vals);
    const after = (await getMatch(competitionId, category, id, c))!;
    await audit(c, { competitionId, actorId: getUser(res).id, entity: 'match', entityId: id, action: 'UPDATE', before, after });
    return after;
  });
  publishChange(competitionId, category);
  res.json({ data: updated });
});

r.delete('/matches/:id', async (req, res) => {
  const { competitionId, category } = getScope(res);
  const id = IdSchema.parse(req.params.id);
  await withTransaction(async (c) => {
    const before = await getMatch(competitionId, category, id, c);
    if (!before) throw notFound('Match');
    await c.query('DELETE FROM matches WHERE id=$1', [id]);
    await audit(c, { competitionId, actorId: getUser(res).id, entity: 'match', entityId: id, action: 'DELETE', before });
  });
  publishChange(competitionId, category);
  res.status(204).end();
});

/** Explicit admin action: lay out start times for a round (match + preparation buffer). Never runs automatically. */
r.post('/rounds/:round/schedule', async (req, res) => {
  const { competitionId, category } = getScope(res);
  const round = RoundSchema.parse(String(req.params.round).toUpperCase());
  const b = RoundScheduleSchema.parse(req.body);
  const rowCount = await withTransaction(async (c) => {
    const result = await c.query(
      `UPDATE matches m SET scheduled_at = $3::timestamptz + (s.idx * ($4::int + $5::int)) * interval '1 minute',
              duration_minutes = $4::int, buffer_minutes = $5::int, version = m.version + 1
         FROM (SELECT id, row_number() OVER (ORDER BY match_number) - 1 AS idx FROM matches
                WHERE competition_id=$1 AND category=$2 AND round=$6 AND status <> 'CANCELLED') s
        WHERE m.id = s.id`,
      [competitionId, category, b.startAt, b.matchDurationMinutes, b.bufferMinutes, round],
    );
    await audit(c, { competitionId, actorId: getUser(res).id, entity: 'round', action: 'SCHEDULE', after: { round, ...b, matches: result.rowCount } });
    return result.rowCount;
  });
  publishChange(competitionId, category);
  res.json({ data: { round, scheduled: rowCount } });
});

/* ============================== BOARDS / LEADERBOARDS ============================== */
/** Unfiltered admin view of any board (QUALIFICATION, FIRST_QUALIFICATION, ..., FINAL). */
r.get('/boards/:board', async (req, res) => {
  const board = BoardSchema.parse(String(req.params.board).toUpperCase());
  res.json({ data: await getBoard(getScope(res), board) });
});

/* ============================== VISIBILITY + LIVE BOARD ============================== */
r.get('/settings', async (_req, res) => {
  const { competitionId, category } = getScope(res);
  res.json({ data: Object.values(await getSettings(competitionId, category)), live: await getLiveBoard(competitionId, category), theme: await getTheme(competitionId, category) });
});

r.put('/settings/:board', async (req, res) => {
  const { competitionId, category } = getScope(res);
  const board = BoardSchema.parse(String(req.params.board).toUpperCase()) as Board;
  const b = SettingsPatchSchema.parse(req.body);
  const { rows } = await pool.query(
    `UPDATE display_settings SET show_scores = COALESCE($4, show_scores), show_winner = COALESCE($5, show_winner), show_leaderboard = COALESCE($6, show_leaderboard)
      WHERE competition_id=$1 AND category=$2 AND board=$3
      RETURNING board, show_scores AS "showScores", show_winner AS "showWinner", show_leaderboard AS "showLeaderboard"`,
    [competitionId, category, board, b.showScores ?? null, b.showWinner ?? null, b.showLeaderboard ?? null],
  );
  if (!rows[0]) throw notFound('Settings');
  await audit(pool, { competitionId, actorId: getUser(res).id, entity: 'settings', action: 'UPDATE', after: rows[0] });
  publishChange(competitionId, category);
  res.json({ data: rows[0] });
});

r.put('/live', async (req, res) => {
  const { competitionId, category } = getScope(res);
  const { board } = LiveBoardSchema.parse(req.body);
  await pool.query('UPDATE live_state SET active_board=$3 WHERE competition_id=$1 AND category=$2', [competitionId, category, board]);
  await audit(pool, { competitionId, actorId: getUser(res).id, entity: 'live', action: 'SET_BOARD', after: { board } });
  publishChange(competitionId, category);
  res.json({ data: { board } });
});

r.put('/theme', async (req, res) => {
  const { competitionId, category } = getScope(res);
  const theme = ThemeSchema.parse(req.body.theme);
  const { rows } = await pool.query('UPDATE live_state SET theme=$3 WHERE competition_id=$1 AND category=$2 RETURNING theme', [competitionId, category, theme]);
  if (!rows[0]) throw notFound('Theme');
  await audit(pool, { competitionId, actorId: getUser(res).id, entity: 'live', action: 'SET_THEME', after: { theme } });
  publishChange(competitionId, category);
  res.json({ data: { theme: rows[0].theme } });
});

export default r;
