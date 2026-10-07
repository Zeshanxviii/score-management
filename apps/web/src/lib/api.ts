import { SLUG, type Alliance, type Board, type Category, type MatchStatus, type Round, type Theme } from './constants';

export interface TeamRef { id: string; code: string; name: string | null; schoolName?: string | null; alliance?: Alliance | null }
export interface Match {
  id: string; category: Category; matchNumber: number; round: Round; status: MatchStatus;
  teamA: TeamRef | null; teamB: TeamRef | null; scoreA: number | null; scoreB: number | null;
  winnerId: string | null; scheduledAt: string | null; durationMinutes: number; bufferMinutes: number; version: number;
}
export type RankStatus = 'TOP_16' | 'OUT' | 'TIE_TBD' | 'UNRANKED';
export interface LbRow { teamId: string; code: string; name: string | null; schoolName?: string | null; alliance?: Alliance | null; round1: number | null; round2: number | null; best: number | null; score: number | null; rank: number | null; status: RankStatus | null }
export type BoardData =
  | { type: 'LEADERBOARD'; board: Board; rows: LbRow[]; hidden?: boolean }
  | { type: 'MATCHES'; board: Board; matches: Match[]; hidden?: boolean };
export interface Settings { board: Board; showScores: boolean; showWinner: boolean; showLeaderboard: boolean }
export interface Display {
  competition: { name: string; slug: string }; category: Category; activeBoard: Board; shownBoard: Board; theme: Theme;
  settings: Settings | null; board: BoardData; current: Match | null; upcoming: Match[];
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

const V1 = `${(import.meta.env.VITE_API_URL as string | undefined) ?? ''}/api/v1`;

async function raw(path: string, o: { method?: string; body?: unknown; token?: string | null } = {}): Promise<any> {
  let res: Response;
  try {
    res = await fetch(V1 + path, {
      method: o.method ?? 'GET',
      headers: { ...(o.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}) },
      body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server');
  }
  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? 'ERROR', json?.error?.message ?? res.statusText);
  return json;
}

const pub = (c: Category) => `/public/${SLUG}/${c.toLowerCase()}`;
const adm = (c: Category) => `/competitions/${SLUG}/categories/${c.toLowerCase()}`;

export const publicApi = {
  display: async (c: Category, board?: Board | null): Promise<Display> => (await raw(`${pub(c)}/display${board ? `?board=${board}` : ''}`)).data,
  streamUrl: (c: Category) => `${V1}${pub(c)}/stream`,
};

const TOKEN_KEY = 'itu-admin-token';
export const auth = {
  get: () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string | null) => { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

export interface TeamsImportResult { junior: number; senior: number; total: number; red: number; blue: number; skipped: { row: number; reason: string }[] }
export const adminApi = {
  login: async (email: string, password: string): Promise<string> => (await raw('/auth/login', { method: 'POST', body: { email, password } })).data.token,
  teams: async (t: string, c: Category): Promise<TeamRef[]> => (await raw(`${adm(c)}/teams`, { token: t })).data,
  createTeam: async (t: string, c: Category, body: { code: string; name?: string | null; schoolName?: string | null; alliance?: Alliance | null }): Promise<TeamRef> =>
    (await raw(`${adm(c)}/teams`, { method: 'POST', token: t, body })).data,
  updateTeam: async (t: string, c: Category, id: string, body: { code?: string; name?: string | null; schoolName?: string | null; alliance?: Alliance | null }): Promise<TeamRef> =>
    (await raw(`${adm(c)}/teams/${id}`, { method: 'PATCH', token: t, body })).data,
  deleteTeam: async (t: string, c: Category, id: string): Promise<void> => { await raw(`${adm(c)}/teams/${id}`, { method: 'DELETE', token: t }); },
  importTeamsExcel: async (t: string, file: File): Promise<TeamsImportResult> => {
    const fd = new FormData();
    fd.append('file', file);
    let res: Response;
    try {
      res = await fetch(`${V1}/competitions/${SLUG}/teams/import`, { method: 'POST', headers: { Authorization: `Bearer ${t}` }, body: fd });
    } catch {
      throw new ApiError(0, 'NETWORK', 'Cannot reach the server');
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? 'ERROR', json?.error?.message ?? res.statusText);
    return json.data;
  },
  shuffleAlliance: async (t: string): Promise<Record<string, { red: number; blue: number }>> =>
    (await raw(`/competitions/${SLUG}/teams/shuffle-alliance`, { method: 'POST', token: t })).data,
  matches: async (t: string, c: Category): Promise<Match[]> => (await raw(`${adm(c)}/matches`, { token: t })).data,
  patchMatch: async (t: string, c: Category, id: string, body: Record<string, unknown>): Promise<Match> => (await raw(`${adm(c)}/matches/${id}`, { method: 'PATCH', token: t, body })).data,
  board: async (t: string, c: Category, b: Board): Promise<BoardData> => (await raw(`${adm(c)}/boards/${b}`, { token: t })).data,
  settings: async (t: string, c: Category): Promise<{ settings: Settings[]; live: Board; theme: Theme }> => { const j = await raw(`${adm(c)}/settings`, { token: t }); return { settings: j.data, live: j.live, theme: j.theme ?? 'dark' }; },
  putTheme: async (t: string, c: Category, theme: Theme): Promise<Theme> => (await raw(`${adm(c)}/theme`, { method: 'PUT', token: t, body: { theme } })).data.theme,
  putSettings: async (t: string, c: Category, b: Board, body: Partial<Omit<Settings, 'board'>>): Promise<Settings> => (await raw(`${adm(c)}/settings/${b}`, { method: 'PUT', token: t, body })).data,
  putLive: async (t: string, c: Category, board: Board) => { await raw(`${adm(c)}/live`, { method: 'PUT', token: t, body: { board } }); },
};
