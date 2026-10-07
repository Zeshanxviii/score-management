export const CATEGORIES = ['JUNIOR', 'SENIOR'] as const;
export type Category = (typeof CATEGORIES)[number];
export type Board = 'QUALIFICATION' | 'FIRST_QUALIFICATION' | 'SECOND_QUALIFICATION' | 'PRE_QUARTER_FINAL' | 'QUARTER_FINAL' | 'SEMI_FINAL' | 'THIRD_POSITION' | 'FINAL';
export type Round = Exclude<Board, 'QUALIFICATION'>;
export type MatchStatus = 'SCHEDULED' | 'READY' | 'LIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export const MATCH_STATUSES: MatchStatus[] = ['SCHEDULED', 'READY', 'LIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'];
export type Alliance = 'RED' | 'BLUE';
export type Theme = 'dark' | 'light' | 'arena' | 'ocean';
export const THEMES: { id: Theme; label: string; swatch: string }[] = [
  { id: 'dark', label: 'Dark', swatch: '#0a1b33' },
  { id: 'light', label: 'Light', swatch: '#eef2f7' },
  { id: 'arena', label: 'Arena', swatch: '#1a0505' },
  { id: 'ocean', label: 'Ocean', swatch: '#04262b' },
];

export const SLUG: string = import.meta.env.VITE_COMPETITION_SLUG ?? 'itu-2026';
export const EVENT_TZ: string = import.meta.env.VITE_EVENT_TZ ?? 'Asia/Kolkata';

/** Every board has its own leaderboard / result list and its own visibility switches. */
export const BOARDS: { id: Board; short: string; title: string; subtitle: string }[] = [
  { id: 'QUALIFICATION', short: 'Qualification', title: 'Qualification', subtitle: 'Better score of the two rounds. Top 16 advance.' },
  { id: 'FIRST_QUALIFICATION', short: 'Round 1', title: 'Qualification · Round 1', subtitle: 'First qualification round scores' },
  { id: 'SECOND_QUALIFICATION', short: 'Round 2', title: 'Qualification · Round 2', subtitle: 'Second qualification round scores' },
  { id: 'PRE_QUARTER_FINAL', short: 'Pre-Quarter', title: 'Pre-Quarter-Final', subtitle: 'Winners advance to the Quarter-Final' },
  { id: 'QUARTER_FINAL', short: 'Quarter-Final', title: 'Quarter-Final', subtitle: 'Winners advance to the Semi-Final' },
  { id: 'SEMI_FINAL', short: 'Semi-Final', title: 'Semi-Final', subtitle: 'Winners go to the Final, losers to the 3rd position match' },
  { id: 'THIRD_POSITION', short: '3rd place', title: '3rd Position Match', subtitle: 'Losing semi-finalists' },
  { id: 'FINAL', short: 'Final', title: 'Final', subtitle: 'Champion and runner-up' },
];
export const boardMeta = (b: Board) => BOARDS.find((x) => x.id === b)!;
export const isQualBoard = (b: Board) => b === 'QUALIFICATION' || b === 'FIRST_QUALIFICATION' || b === 'SECOND_QUALIFICATION';
export const roundsOfBoard = (b: Board): Round[] => (b === 'QUALIFICATION' ? ['FIRST_QUALIFICATION', 'SECOND_QUALIFICATION'] : [b as Round]);
export const ROUND_LABEL: Record<Round, string> = {
  FIRST_QUALIFICATION: 'Qualification · Round 1', SECOND_QUALIFICATION: 'Qualification · Round 2', PRE_QUARTER_FINAL: 'Pre-Quarter-Final',
  QUARTER_FINAL: 'Quarter-Final', SEMI_FINAL: 'Semi-Final', THIRD_POSITION: '3rd Position', FINAL: 'Final',
};
