import { EVENT_TZ, type Round } from './constants';
import type { Match, TeamRef } from './api';

const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: EVENT_TZ });
export const fmtTime = (iso: string | null) => (iso ? timeFmt.format(new Date(iso)).toUpperCase() : 'Time TBA');
export const teamCode = (t: TeamRef | null) => t?.code ?? 'TBD';
export const fmtScore = (n: number | null) => (n === null ? '–' : Number.isInteger(n) ? String(n) : n.toFixed(2));

/** Label used in the schedule workbook: PQ1..PQ8, Q1..Q4, SF1..SF2 */
export function slotLabel(round: Round, index: number): string {
  switch (round) {
    case 'PRE_QUARTER_FINAL': return `PQ${index + 1}`;
    case 'QUARTER_FINAL': return `Q${index + 1}`;
    case 'SEMI_FINAL': return `SF${index + 1}`;
    case 'THIRD_POSITION': return '3rd place';
    case 'FINAL': return 'Final';
    default: return '';
  }
}
export const matchTitle = (m: Match) => `${teamCode(m.teamA)} vs ${m.teamB ? m.teamB.code : m.round.endsWith('QUALIFICATION') ? '—' : 'TBD'}`;
