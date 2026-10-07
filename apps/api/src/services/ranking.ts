import { TOP_N } from '@itu/shared';

/** Pure ranking logic (no DB) so it can be unit tested. */
export interface TeamScores { teamId: string; code: string; name: string | null; schoolName?: string | null; alliance?: 'RED' | 'BLUE' | null; round1: number | null; round2: number | null }
export type RankStatus = 'TOP_16' | 'OUT' | 'TIE_TBD' | 'UNRANKED';
export interface LeaderboardRow extends TeamScores { best: number | null; score: number | null; rank: number | null; status: RankStatus | null }
export type ScoreKey = 'best' | 'round1' | 'round2';

export const maxNullable = (a: number | null, b: number | null): number | null =>
  a === null ? b : b === null ? a : Math.max(a, b);

/**
 * qualificationScore = MAX(round1, round2).
 * Ranking uses competition ranking (1,2,2,4): equal scores share a rank. No tie-break is applied because the
 * organisers have not confirmed one. If positions N and N+1 are equal, every team on that score is flagged TIE_TBD.
 */
export function rankTeams(teams: TeamScores[], key: ScoreKey, withStatus: boolean, cutoff = TOP_N): LeaderboardRow[] {
  const rows: LeaderboardRow[] = teams.map((t) => {
    const best = maxNullable(t.round1, t.round2);
    return { ...t, best, score: key === 'best' ? best : t[key], rank: null, status: null };
  });
  rows.sort((a, b) => {
    if (a.score === null && b.score === null) return a.code.localeCompare(b.code);
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score || a.code.localeCompare(b.code);
  });
  let prev: number | null = null;
  let prevRank = 0;
  rows.forEach((r, i) => {
    if (r.score === null) return;
    r.rank = r.score === prev ? prevRank : i + 1;
    prev = r.score;
    prevRank = r.rank;
  });
  if (withStatus) {
    const scored = rows.filter((r) => r.score !== null);
    const tieScore = scored.length > cutoff && scored[cutoff - 1].score === scored[cutoff].score ? scored[cutoff].score : null;
    scored.forEach((r, i) => {
      r.status = tieScore !== null && r.score === tieScore ? 'TIE_TBD' : i < cutoff ? 'TOP_16' : 'OUT';
    });
    rows.filter((r) => r.score === null).forEach((r) => (r.status = 'UNRANKED'));
  }
  return rows;
}
