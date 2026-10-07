import { isQualificationBoard, QUALIFICATION_ROUNDS, type Board, type Category, type Round, type Theme } from '@itu/shared';
import { pool, type Db } from '../db/pool';
import { listMatches, type MatchDto } from './matches';
import { rankTeams, type LeaderboardRow, type ScoreKey, type TeamScores } from './ranking';
import type { Scope } from '../middleware/scope';

export interface BoardSettings { board: Board; showScores: boolean; showWinner: boolean; showLeaderboard: boolean }
export type SettingsMap = Record<string, BoardSettings>;

export type BoardData =
  | { type: 'LEADERBOARD'; board: Board; rows: LeaderboardRow[]; hidden?: boolean }
  | { type: 'MATCHES'; board: Board; matches: MatchDto[]; hidden?: boolean };

/** Per-team score in each qualification round, taken from matches (team may be on either side). Cancelled matches are ignored. */
export async function teamQualificationScores(competitionId: string, category: Category, db: Db = pool): Promise<TeamScores[]> {
  const { rows } = await db.query(
    `WITH s AS (
       SELECT round, team_a_id AS team_id, score_a AS score FROM matches
        WHERE competition_id=$1 AND category=$2 AND round = ANY($3::round_type[]) AND status <> 'CANCELLED' AND team_a_id IS NOT NULL
       UNION ALL
       SELECT round, team_b_id, score_b FROM matches
        WHERE competition_id=$1 AND category=$2 AND round = ANY($3::round_type[]) AND status <> 'CANCELLED' AND team_b_id IS NOT NULL
     ), agg AS (
       SELECT team_id,
              MAX(score) FILTER (WHERE round='FIRST_QUALIFICATION')  AS round1,
              MAX(score) FILTER (WHERE round='SECOND_QUALIFICATION') AS round2
         FROM s GROUP BY team_id
     )
      SELECT t.id AS "teamId", t.code, t.name, t.school_name AS "schoolName", t.alliance, a.round1, a.round2
        FROM teams t LEFT JOIN agg a ON a.team_id = t.id
       WHERE t.competition_id=$1 AND t.category=$2`,
    [competitionId, category, QUALIFICATION_ROUNDS],
  );
  return rows;
}

export async function getBoard(scope: Pick<Scope, 'competitionId' | 'category'>, board: Board, db: Db = pool): Promise<BoardData> {
  if (isQualificationBoard(board)) {
    const teams = await teamQualificationScores(scope.competitionId, scope.category, db);
    const key: ScoreKey = board === 'FIRST_QUALIFICATION' ? 'round1' : board === 'SECOND_QUALIFICATION' ? 'round2' : 'best';
    return { type: 'LEADERBOARD', board, rows: rankTeams(teams, key, board === 'QUALIFICATION') };
  }
  const matches = await listMatches(scope.competitionId, scope.category, { round: board as Round }, db);
  return { type: 'MATCHES', board, matches };
}

export async function getSettings(competitionId: string, category: Category, db: Db = pool): Promise<SettingsMap> {
  const { rows } = await db.query(
    `SELECT board, show_scores AS "showScores", show_winner AS "showWinner", show_leaderboard AS "showLeaderboard"
       FROM display_settings WHERE competition_id=$1 AND category=$2`,
    [competitionId, category],
  );
  return Object.fromEntries(rows.map((r) => [r.board, r as BoardSettings]));
}

export async function getLiveBoard(competitionId: string, category: Category, db: Db = pool): Promise<Board> {
  const { rows } = await db.query('SELECT active_board FROM live_state WHERE competition_id=$1 AND category=$2', [competitionId, category]);
  return (rows[0]?.active_board ?? 'QUALIFICATION') as Board;
}

export async function getTheme(competitionId: string, category: Category, db: Db = pool): Promise<Theme> {
  const { rows } = await db.query('SELECT theme FROM live_state WHERE competition_id=$1 AND category=$2', [competitionId, category]);
  return (rows[0]?.theme ?? 'dark') as Theme;
}

/* ---------- Visibility: hidden data is removed server-side, never just hidden by the client ---------- */
export function filterMatch(m: MatchDto, s: BoardSettings | undefined): MatchDto {
  if (!s) return m;
  return { ...m, scoreA: s.showScores ? m.scoreA : null, scoreB: s.showScores ? m.scoreB : null, winnerId: s.showWinner ? m.winnerId : null };
}

export function filterBoard(data: BoardData, s: BoardSettings | undefined): BoardData {
  if (!s) return data;
  if (!s.showLeaderboard) return data.type === 'LEADERBOARD' ? { type: 'LEADERBOARD', board: data.board, rows: [], hidden: true } : { type: 'MATCHES', board: data.board, matches: [], hidden: true };
  if (data.type === 'LEADERBOARD') {
    return s.showScores ? data : { ...data, rows: data.rows.map((r) => ({ ...r, round1: null, round2: null, best: null, score: null })) };
  }
  return { ...data, matches: data.matches.map((m) => filterMatch(m, s)) };
}

/** Rounds whose matches belong to a board: QUALIFICATION covers both qualification rounds. */
export const roundsOfBoard = (b: Board): Round[] => (b === 'QUALIFICATION' ? [...QUALIFICATION_ROUNDS] : [b as Round]);

/**
 * Public screen payload for one board: the leaderboard, the ONE current (LIVE/PAUSED) match and the next 3 upcoming
 * matches of that board's rounds. `viewBoard` lets a spectator look at another board; default is the admin's live board.
 */
export async function publicDisplay(scope: Scope, viewBoard?: Board) {
  const { competitionId, category } = scope;
  const [settings, active, theme] = await Promise.all([getSettings(competitionId, category), getLiveBoard(competitionId, category), getTheme(competitionId, category)]);
  const shown = viewBoard ?? active;
  const rounds = roundsOfBoard(shown);
  const [current, upcoming, data] = await Promise.all([
    listMatches(competitionId, category, { rounds, statuses: ['LIVE', 'PAUSED'], order: 'recent', limit: 1 }),
    listMatches(competitionId, category, { rounds, statuses: ['SCHEDULED', 'READY'], order: 'upcoming', limit: 3 }),
    getBoard(scope, shown),
  ]);
  const board = filterBoard(data, settings[shown]);
  return {
    competition: { name: scope.competitionName, slug: scope.slug },
    category,
    activeBoard: active,
    shownBoard: shown,
    theme,
    settings: settings[shown] ?? null,
    board,
    current: current[0] ? filterMatch(current[0], settings[current[0].round]) : null,
    upcoming: upcoming.map((m) => filterMatch(m, settings[m.round])),
  };
}
