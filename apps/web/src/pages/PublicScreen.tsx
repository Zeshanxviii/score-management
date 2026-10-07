import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { EyeOff, Wifi, WifiOff } from 'lucide-react';
import { useDisplay } from '../hooks/useDisplay';
import { BoardTabs } from '../components/BoardTabs';
import { LiveMatch } from '../components/LiveMatch';
import { UpcomingList } from '../components/UpcomingList';
import { Leaderboard } from '../components/Leaderboard';
import { KnockoutBoard } from '../components/KnockoutBoard';
import { CATEGORIES, boardMeta, type Board, type Category } from '../lib/constants';

export default function PublicScreen() {
  const { category: param } = useParams();
  const category: Category = param?.toUpperCase() === 'JUNIOR' ? 'JUNIOR' : 'SENIOR';
  // null = follow whichever board the admin sends to the public screen
  const [picked, setPicked] = useState<Board | null>(null);
  const { data, error, connected } = useDisplay(category, picked);
  const shown: Board = data?.shownBoard ?? picked ?? 'QUALIFICATION';
  const meta = boardMeta(shown);
  const showScores = data?.settings?.showScores ?? true;
  const showWinner = data?.settings?.showWinner ?? true;
  const following = picked === null;

  const theme = data?.theme ?? 'dark';
  return (
    <MotionConfig reducedMotion="user">
      <div className={`theme-${theme} min-h-screen bg-bg text-fg`}>
        <header className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 pt-4 lg:px-6">
          <div className="flex items-center gap-4">
            <div className="font-display text-3xl font-bold tracking-tight">ITU 2026</div>
            <nav className="relative flex rounded-xl bg-surface p-1" aria-label="Category">
              {CATEGORIES.map((c) => (
                <Link key={c} to={`/screen/${c.toLowerCase()}`} onClick={() => setPicked(null)} className={`relative rounded-lg px-4 py-1.5 text-sm font-semibold ${c === category ? 'text-bg' : 'text-muted hover:text-fg'}`}>
                  {c === category && <motion.span layoutId="cat-pill" className="absolute inset-0 rounded-lg bg-fg" transition={{ type: 'spring', stiffness: 520, damping: 42 }} />}
                  <span className="relative">{c[0] + c.slice(1).toLowerCase()}</span>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted">
            <button onClick={() => setPicked(null)} disabled={following} className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${following ? 'bg-live/15 text-live' : 'bg-surface text-fg hover:bg-surface2'}`}>
              {following ? 'Following the live screen' : 'Back to live screen'}
            </button>
            <span className="flex items-center gap-1.5" title={connected ? 'Live updates connected' : 'Reconnecting, refreshing every 15s'}>
              {connected ? <Wifi size={16} className="text-mint" /> : <WifiOff size={16} />}
            </span>
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] px-4 pt-4 lg:px-6">
          <BoardTabs id="public" value={shown} liveBoard={data?.activeBoard} onChange={(b) => setPicked(b === data?.activeBoard ? null : b)} />
        </div>

        <main className="mx-auto grid max-w-[1600px] gap-5 p-4 lg:grid-cols-[minmax(340px,440px)_1fr] lg:p-6">
          <aside className="space-y-6">
            <section aria-label="Current match">
              <LiveMatch match={data?.current ?? null} showScores={showScores} />
            </section>
            <section aria-label="Upcoming matches">
              <h2 className="mb-2 font-display text-2xl font-semibold">Up next</h2>
              <UpcomingList matches={data?.upcoming ?? []} />
            </section>
          </aside>

          <section aria-label={`${meta.title} leaderboard`}>
            <div className="mb-3">
              <h1 className="font-display text-5xl font-bold leading-none">{meta.title}</h1>
              <p className="mt-1 text-muted">{category[0] + category.slice(1).toLowerCase()} category · {meta.subtitle}</p>
            </div>
            {error && !data && <p className="rounded-xl bg-live/10 p-4 text-live">{error}. Retrying…</p>}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={`${category}-${shown}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
                {!data ? (
                  <div className="space-y-2" aria-busy>{Array.from({ length: 8 }).map((_, i) => <motion.div key={i} className="h-12 rounded-xl bg-surface" animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.08 }} />)}</div>
                ) : data.board.hidden ? (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line/20 p-12 text-center text-muted">
                    <EyeOff /> <p>The organisers have hidden this leaderboard for now.</p>
                  </div>
                ) : data.board.type === 'LEADERBOARD' ? (
                  <Leaderboard board={data.board.board} rows={data.board.rows} showScores={showScores} />
                ) : (
                  <KnockoutBoard matches={data.board.matches} showScores={showScores} showWinner={showWinner} />
                )}
              </motion.div>
            </AnimatePresence>
            {data && !showScores && !data.board.hidden && <p className="mt-3 text-sm text-muted">Scores for this round are hidden by the organisers.</p>}
          </section>
        </main>
      </div>
    </MotionConfig>
  );
}
