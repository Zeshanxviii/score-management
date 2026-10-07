import type { Category, MatchStatus, Round } from '@itu/shared';
import { pool, type Db } from '../db/pool';

export interface TeamRef { id: string; code: string; name: string | null; schoolName: string | null; alliance: 'RED' | 'BLUE' | null }
export interface MatchDto {
  id: string; category: Category; matchNumber: number; round: Round; status: MatchStatus;
  teamA: TeamRef | null; teamB: TeamRef | null; scoreA: number | null; scoreB: number | null;
  winnerId: string | null; scheduledAt: string | null; durationMinutes: number; bufferMinutes: number; version: number;
}

const SELECT = `
  SELECT m.id, m.category, m.match_number, m.round, m.status, m.score_a, m.score_b, m.winner_id, m.scheduled_at,
         m.duration_minutes, m.buffer_minutes, m.version,
         ta.id AS a_id, ta.code AS a_code, ta.name AS a_name, ta.school_name AS a_school, ta.alliance AS a_alliance,
         tb.id AS b_id, tb.code AS b_code, tb.name AS b_name, tb.school_name AS b_school, tb.alliance AS b_alliance
  FROM matches m
  LEFT JOIN teams ta ON ta.id = m.team_a_id
  LEFT JOIN teams tb ON tb.id = m.team_b_id`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function map(r: any): MatchDto {
  return {
    id: r.id, category: r.category, matchNumber: r.match_number, round: r.round, status: r.status,
    teamA: r.a_id ? { id: r.a_id, code: r.a_code, name: r.a_name, schoolName: r.a_school ?? null, alliance: r.a_alliance ?? null } : null,
    teamB: r.b_id ? { id: r.b_id, code: r.b_code, name: r.b_name, schoolName: r.b_school ?? null, alliance: r.b_alliance ?? null } : null,
    scoreA: r.score_a, scoreB: r.score_b, winnerId: r.winner_id,
    scheduledAt: r.scheduled_at ? new Date(r.scheduled_at).toISOString() : null,
    durationMinutes: r.duration_minutes, bufferMinutes: r.buffer_minutes, version: r.version,
  };
}

const ORDERS = {
  number: 'm.match_number',
  upcoming: 'm.scheduled_at NULLS LAST, m.match_number',
  recent: 'm.updated_at DESC',
} as const;

export interface ListOpts { round?: Round; rounds?: Round[]; statuses?: MatchStatus[]; limit?: number; order?: keyof typeof ORDERS }

export async function listMatches(competitionId: string, category: Category, opts: ListOpts = {}, db: Db = pool): Promise<MatchDto[]> {
  const params: unknown[] = [competitionId, category];
  let where = 'WHERE m.competition_id = $1 AND m.category = $2';
  if (opts.round) { params.push(opts.round); where += ` AND m.round = $${params.length}`; }
  if (opts.rounds?.length) { params.push(opts.rounds); where += ` AND m.round = ANY($${params.length}::round_type[])`; }
  if (opts.statuses?.length) { params.push(opts.statuses); where += ` AND m.status = ANY($${params.length}::match_status[])`; }
  let sql = `${SELECT} ${where} ORDER BY ${ORDERS[opts.order ?? 'number']}`;
  if (opts.limit) { params.push(opts.limit); sql += ` LIMIT $${params.length}`; }
  return (await db.query(sql, params)).rows.map(map);
}

export async function getMatch(competitionId: string, category: Category, id: string, db: Db = pool): Promise<MatchDto | null> {
  const { rows } = await db.query(`${SELECT} WHERE m.id = $1 AND m.competition_id = $2 AND m.category = $3`, [id, competitionId, category]);
  return rows[0] ? map(rows[0]) : null;
}
