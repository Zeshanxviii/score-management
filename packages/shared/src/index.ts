import { z } from 'zod';

/* ---------- Domain constants (single source of truth for API + future web app) ---------- */
export const CATEGORIES = ['JUNIOR', 'SENIOR'] as const;
export const ROUNDS = [
  'FIRST_QUALIFICATION',
  'SECOND_QUALIFICATION',
  'PRE_QUARTER_FINAL',
  'QUARTER_FINAL',
  'SEMI_FINAL',
  'THIRD_POSITION',
  'FINAL',
] as const;
/** A "board" is something the public screen can show: the overall qualification table or any single round. */
export const BOARDS = ['QUALIFICATION', ...ROUNDS] as const;
export const MATCH_STATUSES = ['SCHEDULED', 'READY', 'LIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const;
export const QUALIFICATION_ROUNDS = ['FIRST_QUALIFICATION', 'SECOND_QUALIFICATION'] as const;
export const QUALIFICATION_BOARDS = ['QUALIFICATION', ...QUALIFICATION_ROUNDS] as const;
export const TOP_N = 16;

export type Category = (typeof CATEGORIES)[number];
export type Round = (typeof ROUNDS)[number];
export type Board = (typeof BOARDS)[number];
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const ALLIANCES = ['RED', 'BLUE'] as const;
export type Alliance = (typeof ALLIANCES)[number];

export const THEMES = ['dark', 'light', 'arena', 'ocean'] as const;
export type Theme = (typeof THEMES)[number];

export const CategorySchema = z.enum(CATEGORIES);
export const RoundSchema = z.enum(ROUNDS);
export const BoardSchema = z.enum(BOARDS);
export const MatchStatusSchema = z.enum(MATCH_STATUSES);
export const AllianceSchema = z.enum(ALLIANCES);
export const ThemeSchema = z.enum(THEMES);

export const isQualificationBoard = (b: Board): boolean => (QUALIFICATION_BOARDS as readonly string[]).includes(b);

/* ---------- Request schemas ---------- */
export const IdSchema = z.string().uuid();

export const LoginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) }).strict();

export const CompetitionCreateSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase letters, numbers and dashes only').min(2).max(64),
    name: z.string().trim().min(1).max(200),
  })
  .strict();

const teamCode = z.string().trim().min(1).max(16).transform((s) => s.toUpperCase());
const teamAlliance = AllianceSchema.nullish();
const teamName = z.string().trim().max(200).nullish();
export const TeamCreateSchema = z.object({ code: teamCode, name: teamName, schoolName: teamName, alliance: teamAlliance }).strict();
export const TeamBulkSchema = z.object({ teams: z.array(TeamCreateSchema).min(1).max(200) }).strict();
export const TeamPatchSchema = z.object({ code: teamCode.optional(), name: teamName, schoolName: teamName, alliance: teamAlliance }).strict();

const score = z.number().min(0).max(100000).nullish();
const matchShape = {
  matchNumber: z.number().int().positive(),
  round: RoundSchema,
  teamAId: IdSchema.nullish(),
  teamBId: IdSchema.nullish(),
  scoreA: score,
  scoreB: score,
  winnerId: IdSchema.nullish(),
  scheduledAt: z.string().datetime({ offset: true }).nullish(),
};
export const MatchCreateSchema = z.object({ ...matchShape, status: MatchStatusSchema.default('SCHEDULED') }).strict();
export const MatchPatchSchema = z
  .object(matchShape)
  .partial()
  .extend({ status: MatchStatusSchema.optional(), version: z.number().int().positive().optional() })
  .strict();

export const RoundScheduleSchema = z
  .object({
    startAt: z.string().datetime({ offset: true }),
    matchDurationMinutes: z.number().int().min(1).max(120).default(2),
    bufferMinutes: z.number().int().min(0).max(120).default(3),
  })
  .strict();

export const SettingsPatchSchema = z
  .object({ showScores: z.boolean().optional(), showWinner: z.boolean().optional(), showLeaderboard: z.boolean().optional() })
  .strict();

export const LiveBoardSchema = z.object({ board: BoardSchema }).strict();
