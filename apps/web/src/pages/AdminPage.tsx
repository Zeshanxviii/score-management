import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ExternalLink, LogOut, MonitorPlay, Pencil, Plus, Shuffle, Trash2, Upload } from 'lucide-react';
import { AllianceDot } from '../components/AllianceBadge';
import { TeamModal, type TeamForm } from '../components/TeamModal';
import { adminApi, ApiError, auth, type BoardData, type Match, type Settings, type TeamRef } from '../lib/api';
import { CATEGORIES, MATCH_STATUSES, ROUND_LABEL, THEMES, boardMeta, isQualBoard, roundsOfBoard, type Alliance, type Board, type Category, type Theme } from '../lib/constants';
import { fmtTime } from '../lib/format';
import { BoardTabs } from '../components/BoardTabs';
import { Leaderboard } from '../components/Leaderboard';
import { StatusBadge } from '../components/StatusBadge';
import { Toggle } from '../components/Toggle';

/* ------------------------------ login ------------------------------ */
function Login({ onDone }: { onDone: (t: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { const t = await adminApi.login(email, password); auth.set(t); onDone(t); }
    catch (x) { setErr(x instanceof Error ? x.message : 'Sign in failed'); }
    finally { setBusy(false); }
  }
  return (
    <div className="theme-light flex min-h-screen items-center justify-center bg-bg p-4 text-fg">
      <motion.form onSubmit={submit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-4 rounded-2xl bg-surface p-6 shadow-lg">
        <h1 className="font-display text-4xl font-bold">ITU 2026 admin</h1>
        <label className="block text-sm font-medium">Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-line/20 bg-surface2 px-3 py-2" autoComplete="username" />
        </label>
        <label className="block text-sm font-medium">Password
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-line/20 bg-surface2 px-3 py-2" autoComplete="current-password" />
        </label>
        {err && <p role="alert" className="text-sm text-live">{err}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-fg py-2.5 font-semibold text-bg disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in'}</button>
      </motion.form>
    </div>
  );
}

/* ------------------------------ match row ------------------------------ */
interface RowProps {
  m: Match; teams: TeamRef[]; rankOf: Map<string, number>; knockout: boolean; label: string;
  onPatch: (m: Match, body: Record<string, unknown>) => void;
}
function MatchRow({ m, teams, rankOf, knockout, label, onPatch }: RowProps) {
  const [sa, setSa] = useState(m.scoreA?.toString() ?? '');
  const [sb, setSb] = useState(m.scoreB?.toString() ?? '');
  useEffect(() => { setSa(m.scoreA?.toString() ?? ''); setSb(m.scoreB?.toString() ?? ''); }, [m.version, m.scoreA, m.scoreB]);
  const commit = (field: 'scoreA' | 'scoreB', raw: string) => {
    const n = raw.trim() === '' ? null : Number(raw);
    if (n !== null && Number.isNaN(n)) return;
    if (n !== m[field]) onPatch(m, { [field]: n });
  };
  const opt = (t: TeamRef) => { const r = rankOf.get(t.id); return `${r ? `#${r} ` : ''}${t.code}${knockout && r && r > 16 ? ' (out)' : ''}`; };
  const sel = 'w-full min-w-0 rounded-md border border-line/20 bg-surface2 px-2 py-1.5 text-sm';
  const num = 'num w-16 rounded-md border border-line/20 bg-surface2 px-2 py-1.5 text-right text-sm';
  const teamSelect = (side: 'teamAId' | 'teamBId', cur: TeamRef | null) => (
    <select aria-label={`${label} ${side === 'teamAId' ? 'team A' : 'team B'}`} className={sel} value={cur?.id ?? ''} onChange={(e) => onPatch(m, { [side]: e.target.value || null })}>
      <option value="">{knockout ? 'Assign team…' : '—'}</option>
      {teams.map((t) => <option key={t.id} value={t.id}>{opt(t)}</option>)}
    </select>
  );
  return (
    <motion.div layout className={`grid items-center gap-2 border-t border-line/10 px-3 py-2.5 md:grid-cols-[3.5rem_5rem_1fr_4.5rem_1fr_4.5rem_7rem_auto] ${m.status === 'LIVE' ? 'bg-live/5' : ''}`}>
      <span className="font-semibold">{label}</span>
      <span className="num text-sm text-muted">{fmtTime(m.scheduledAt)}</span>
      {teamSelect('teamAId', m.teamA)}
      <input aria-label="Score A" className={num} inputMode="decimal" value={sa} onChange={(e) => setSa(e.target.value)} onBlur={() => commit('scoreA', sa)} />
      {teamSelect('teamBId', m.teamB)}
      <input aria-label="Score B" className={num} inputMode="decimal" value={sb} onChange={(e) => setSb(e.target.value)} onBlur={() => commit('scoreB', sb)} />
      <select aria-label="Status" className={sel} value={m.status} onChange={(e) => onPatch(m, { status: e.target.value })}>
        {MATCH_STATUSES.map((s) => <option key={s}>{s}</option>)}
      </select>
      <div className="flex flex-wrap items-center gap-2">
        {m.status !== 'LIVE' ? <button onClick={() => onPatch(m, { status: 'LIVE' })} className="rounded-md bg-live px-2.5 py-1.5 text-xs font-semibold text-white">Go live</button>
          : <button onClick={() => onPatch(m, { status: 'COMPLETED' })} className="rounded-md bg-mint px-2.5 py-1.5 text-xs font-semibold text-white">Complete</button>}
        {knockout && (
          <select aria-label="Winner" className={`${sel} !w-28`} value={m.winnerId ?? ''} onChange={(e) => onPatch(m, { winnerId: e.target.value || null })}>
            <option value="">Winner…</option>
            {m.teamA && <option value={m.teamA.id}>{m.teamA.code}</option>}
            {m.teamB && <option value={m.teamB.id}>{m.teamB.code}</option>}
          </select>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------ shell ------------------------------ */
function Shell({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [category, setCategory] = useState<Category>('SENIOR');
  const [board, setBoard] = useState<Board>('QUALIFICATION');
  const [teams, setTeams] = useState<TeamRef[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [settings, setSettings] = useState<Settings[]>([]);
  const [live, setLive] = useState<Board>('QUALIFICATION');
  const [qual, setQual] = useState<BoardData | null>(null);
  const [view, setView] = useState<BoardData | null>(null);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');
  const [modal, setModal] = useState<{ open: boolean; team: TeamRef | null }>({ open: false, team: null });
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<TeamRef | null>(null);

  const say = useCallback((text: string, bad = false) => { setToast({ text, bad }); setTimeout(() => setToast(null), 2600); }, []);
  const fail = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) { auth.set(null); onLogout(); return; }
    say(e instanceof Error ? e.message : 'Something went wrong', true);
  }, [onLogout, say]);

  const loadBoards = useCallback(async () => {
    try {
      const q = await adminApi.board(token, category, 'QUALIFICATION'); setQual(q);
      setView(board === 'QUALIFICATION' || !isQualBoard(board) ? null : await adminApi.board(token, category, board));
    } catch (e) { fail(e); }
  }, [token, category, board, fail]);

  const loadAll = useCallback(async () => {
    try {
      const [t, m, s] = await Promise.all([adminApi.teams(token, category), adminApi.matches(token, category), adminApi.settings(token, category)]);
      setTeams(t); setMatches(m); setSettings(s.settings); setLive(s.live); setTheme(s.theme);
    } catch (e) { fail(e); }
  }, [token, category, fail]);

  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => { void loadBoards(); }, [loadBoards]);

  const rankOf = useMemo(() => {
    const m = new Map<string, number>();
    if (qual?.type === 'LEADERBOARD') qual.rows.forEach((r) => r.rank && m.set(r.teamId, r.rank));
    return m;
  }, [qual]);
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => (rankOf.get(a.id) ?? 999) - (rankOf.get(b.id) ?? 999) || a.code.localeCompare(b.code)), [teams, rankOf]);

  async function patch(m: Match, body: Record<string, unknown>) {
    try {
      const upd = await adminApi.patchMatch(token, category, m.id, { ...body, version: m.version });
      setMatches((ms) => ms.map((x) => (x.id === upd.id ? upd : x)));
      say('Saved'); void loadBoards();
    } catch (e) { fail(e); void loadAll(); }
  }
  async function setVis(b: Board, body: Partial<Omit<Settings, 'board'>>) {
    try { const s = await adminApi.putSettings(token, category, b, body); setSettings((all) => all.map((x) => (x.board === b ? s : x))); say('Visibility updated'); } catch (e) { fail(e); }
  }
  async function sendLive(b: Board) {
    try { await adminApi.putLive(token, category, b); setLive(b); say(`${boardMeta(b).title} is on the public screen`); } catch (e) { fail(e); }
  }
  async function saveTeam(form: TeamForm) {
    if (!form.code.trim()) { setModalError('Team code is required'); return; }
    setModalBusy(true); setModalError('');
    const body = {
      code: form.code.trim(),
      name: form.name.trim() || null,
      schoolName: form.schoolName.trim() || null,
      alliance: (form.alliance || null) as Alliance | null,
    };
    try {
      if (modal.team) {
        const upd = await adminApi.updateTeam(token, category, modal.team.id, body);
        setTeams((xs) => xs.map((x) => (x.id === upd.id ? upd : x)));
        say(`Saved ${upd.code}`);
      } else {
        const t = await adminApi.createTeam(token, category, body);
        setTeams((xs) => [...xs, t]);
        say(`Added ${t.code}`);
      }
      setModal({ open: false, team: null });
      void loadBoards();
    } catch (x) { setModalError(x instanceof Error ? x.message : 'Save failed'); }
    finally { setModalBusy(false); }
  }
  async function delTeam(t: TeamRef) {
    try {
      await adminApi.deleteTeam(token, category, t.id);
      setTeams((xs) => xs.filter((x) => x.id !== t.id));
      setConfirmDelete(null);
      say(`Deleted ${t.code}`);
      void loadBoards();
    } catch (x) { fail(x); setConfirmDelete(null); }
  }
  async function setScreenTheme(th: Theme) {
    try { await adminApi.putTheme(token, category, th); setTheme(th); say(`Public screen theme: ${th}`); } catch (e) { fail(e); }
  }
  const [importBusy, setImportBusy] = useState(false);
  async function importExcel(file: File | undefined) {
    if (!file) return;
    setImportBusy(true);
    try {
      const r = await adminApi.importTeamsExcel(token, file);
      say(`Imported ${r.total} teams (J ${r.junior} · S ${r.senior}, red ${r.red} / blue ${r.blue})${r.skipped.length ? `, ${r.skipped.length} skipped` : ''}`);
      void loadAll(); void loadBoards();
    } catch (x) { fail(x); } finally { setImportBusy(false); }
  }
  async function shuffleColors() {
    setImportBusy(true);
    try {
      const r = await adminApi.shuffleAlliance(token);
      const j = r.JUNIOR ? `J red ${r.JUNIOR.red}/blue ${r.JUNIOR.blue}` : '';
      const s = r.SENIOR ? `S red ${r.SENIOR.red}/blue ${r.SENIOR.blue}` : '';
      say(`Re-shuffled colors: ${j} · ${s}`);
      void loadAll(); void loadBoards();
    } catch (x) { fail(x); } finally { setImportBusy(false); }
  }

  const meta = boardMeta(board);
  const vis = settings.find((s) => s.board === board);
  const rounds = roundsOfBoard(board);
  const knockout = !isQualBoard(board);
  const boardMatches = matches.filter((m) => rounds.includes(m.round));
  const lbData = board === 'QUALIFICATION' ? qual : view;

  return (
    <MotionConfig reducedMotion="user">
      <div className="theme-light min-h-screen bg-bg text-fg">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line/10 bg-surface px-4 py-3 lg:px-6">
          <div className="flex items-center gap-4">
            <span className="font-display text-3xl font-bold">ITU 2026 admin</span>
            <div className="flex rounded-lg bg-surface2 p-1">
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(c)} className={`relative rounded-md px-3.5 py-1 text-sm font-semibold ${c === category ? 'text-white' : 'text-muted'}`}>
                  {c === category && <motion.span layoutId="admin-cat" className="absolute inset-0 rounded-md bg-fg" transition={{ type: 'spring', stiffness: 520, damping: 42 }} />}
                  <span className="relative">{c[0] + c.slice(1).toLowerCase()}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/screen/${category.toLowerCase()}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-lg bg-surface2 px-3 py-1.5 text-sm font-semibold"><MonitorPlay size={16} />Public screen<ExternalLink size={13} className="text-muted" /></Link>
            <button onClick={() => { auth.set(null); onLogout(); }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:text-fg"><LogOut size={16} />Sign out</button>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
          <BoardTabs id="admin" value={board} liveBoard={live} onChange={setBoard} />

          <section className="rounded-2xl border border-line/10 bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold leading-none">{meta.title}</h1>
                <p className="mt-1 text-sm text-muted">{category[0] + category.slice(1).toLowerCase()} · {meta.subtitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-5">
                <Toggle label="Show scores" checked={vis?.showScores ?? true} onChange={(v) => setVis(board, { showScores: v })} />
                <Toggle label="Show winner" checked={vis?.showWinner ?? true} onChange={(v) => setVis(board, { showWinner: v })} />
                <Toggle label="Show leaderboard" checked={vis?.showLeaderboard ?? true} onChange={(v) => setVis(board, { showLeaderboard: v })} />
                {live === board
                  ? <span className="inline-flex items-center gap-2 rounded-lg bg-live/10 px-3 py-2 text-sm font-semibold text-live"><span className="h-2 w-2 rounded-full bg-live" />On the public screen</span>
                  : <button onClick={() => sendLive(board)} className="rounded-lg bg-fg px-4 py-2 text-sm font-semibold text-bg">Show on public screen</button>}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-line/10 bg-surface">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="font-display text-2xl font-semibold">Matches</h2>
              <span className="text-sm text-muted">{knockout ? 'Pairings and winners are set by hand. Teams are listed by qualification rank.' : 'Scores save when you leave the field.'}</span>
            </div>
            {rounds.map((r) => {
              const list = boardMatches.filter((m) => m.round === r);
              return (
                <div key={r}>
                  {rounds.length > 1 && <div className="bg-surface2 px-4 py-1.5 text-sm font-semibold">{ROUND_LABEL[r]}</div>}
                  {list.map((m, i) => <MatchRow key={m.id} m={m} teams={sortedTeams} rankOf={rankOf} knockout={knockout} label={knockout ? (r === 'PRE_QUARTER_FINAL' ? `PQ${i + 1}` : r === 'QUARTER_FINAL' ? `Q${i + 1}` : r === 'SEMI_FINAL' ? `SF${i + 1}` : r === 'THIRD_POSITION' ? '3rd' : 'Final') : `#${m.matchNumber}`} onPatch={patch} />)}
                  {list.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">No matches in this round.</p>}
                </div>
              );
            })}
          </section>

          {lbData && lbData.type === 'LEADERBOARD' && (
            <section>
              <h2 className="mb-2 font-display text-2xl font-semibold">Leaderboard preview <span className="text-base font-normal text-muted">(admin sees every score)</span></h2>
              <Leaderboard board={lbData.board} rows={lbData.rows} showScores />
            </section>
          )}

          <section className="space-y-2 rounded-2xl border border-line/10 bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold">Public screen theme</h2>
                <p className="text-sm text-muted">{category[0] + category.slice(1).toLowerCase()} screen · changes appear on the projector instantly</p>
              </div>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Public screen theme">
                {THEMES.map((th) => (
                  <button key={th.id} role="radio" aria-checked={theme === th.id} onClick={() => void setScreenTheme(th.id)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ring-1 ${theme === th.id ? 'bg-fg text-bg ring-fg' : 'ring-line/20 hover:bg-surface2'}`}>
                    <span className="h-4 w-4 rounded-full ring-1 ring-black/30" style={{ background: th.swatch }} />{th.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {board === 'QUALIFICATION' && (
            <section className="space-y-3 rounded-2xl border border-line/10 bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-fg px-3 py-2 text-sm font-semibold text-bg">
                  <Upload size={16} />{importBusy ? 'Working…' : 'Import teams Excel'}
                  <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importBusy}
                    onChange={(e) => { void importExcel(e.target.files?.[0]); e.target.value = ''; }} aria-label="Import teams Excel" />
                </label>
                <button onClick={() => void shuffleColors()} disabled={importBusy} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-line/20">
                  <Shuffle size={16} />Re-shuffle red/blue
                </button>
                <button onClick={() => { setModalError(''); setModal({ open: true, team: null }); }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-line/20">
                  <Plus size={16} />Add team
                </button>
                <span className="text-sm text-muted">{teams.length} teams in {category.toLowerCase()}
                  {teams.length > 0 && (
                    <> · <span className="text-red-600">{teams.filter((t) => t.alliance === 'RED').length} red</span> / <span className="text-blue-600">{teams.filter((t) => t.alliance === 'BLUE').length} blue</span></>
                  )}
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-line/10">
                <div className="grid grid-cols-[1fr_auto] items-center gap-2 bg-surface2 px-3 py-2 text-sm font-semibold text-muted sm:grid-cols-[7rem_1fr_1fr_6rem_7rem]">
                  <span>Code</span><span className="hidden sm:block">Team name</span><span className="hidden sm:block">School</span><span className="hidden sm:block">Side</span><span className="text-right">Actions</span>
                </div>
                {[...teams].sort((a, b) => a.code.localeCompare(b.code)).map((t) => (
                  <div key={t.id} className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-line/10 px-3 py-2 sm:grid-cols-[7rem_1fr_1fr_6rem_7rem]">
                    <span className="flex items-center gap-1.5 font-display text-xl font-bold"><AllianceDot alliance={t.alliance} size={9} />{t.code}</span>
                    <span className="hidden truncate text-sm font-bold sm:block">{t.name ?? <span className="font-normal text-muted">—</span>}</span>
                    <span className="hidden truncate text-sm text-muted sm:block">{t.schoolName ?? '—'}</span>
                    <span className="hidden sm:block">{t.alliance ? <span className={`text-xs font-bold ${t.alliance === 'RED' ? 'text-red-600' : 'text-blue-600'}`}>{t.alliance === 'RED' ? 'Red' : 'Blue'}</span> : <span className="text-xs text-muted">—</span>}</span>
                    <span className="flex justify-end gap-1">
                      <button onClick={() => { setModalError(''); setModal({ open: true, team: t }); }} aria-label={`Edit ${t.code}`} className="rounded-md p-1.5 text-muted hover:bg-surface2 hover:text-fg"><Pencil size={15} /></button>
                      <button onClick={() => setConfirmDelete(t)} aria-label={`Delete ${t.code}`} className="rounded-md p-1.5 text-muted hover:bg-live/10 hover:text-live"><Trash2 size={15} /></button>
                    </span>
                    <span className="col-span-2 truncate text-xs text-muted sm:hidden">{[t.name, t.schoolName].filter(Boolean).join(' · ') || '—'}</span>
                  </div>
                ))}
                {teams.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">No teams yet. Add one or import the Excel sheet.</p>}
              </div>
            </section>
          )}
        </main>

        <AnimatePresence>
          {modal.open && (
            <TeamModal team={modal.team} busy={modalBusy} error={modalError}
              onClose={() => setModal({ open: false, team: null })} onSave={(f) => void saveTeam(f)} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {confirmDelete && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDelete(null)} role="presentation">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={`Delete ${confirmDelete.code}`}>
                <h2 className="font-display text-2xl font-bold">Delete {confirmDelete.code}?</h2>
                <p className="mt-1 text-sm text-muted">{confirmDelete.name ?? 'This team'} will be removed permanently. Teams used in matches cannot be deleted.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setConfirmDelete(null)} className="rounded-lg px-4 py-2 text-sm font-semibold ring-1 ring-line/20">Cancel</button>
                  <button onClick={() => void delTeam(confirmDelete)} className="rounded-lg bg-live px-4 py-2 text-sm font-semibold text-white">Delete</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {toast && (
            <motion.div key={toast.text} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} role="status"
              className={`fixed bottom-5 left-1/2 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg ${toast.bad ? 'bg-live' : 'bg-fg !text-bg'}`}>
              {toast.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(auth.get());
  return token ? <Shell token={token} onLogout={() => setToken(null)} /> : <Login onDone={setToken} />;
}
