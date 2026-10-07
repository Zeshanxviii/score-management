import { motion } from 'motion/react';
import type { Board } from '../lib/constants';
import type { LbRow, RankStatus } from '../lib/api';
import { AnimatedNumber } from './AnimatedNumber';
import { AllianceDot } from './AllianceBadge';

const STATUS: Record<RankStatus, { label: string; cls: string }> = {
  TOP_16: { label: 'Top 16', cls: 'bg-mint/15 text-mint' },
  OUT: { label: 'Out', cls: 'bg-fg/10 text-muted' },
  TIE_TBD: { label: 'Tie · TBD', cls: 'bg-gold/15 text-gold' },
  UNRANKED: { label: 'Waiting', cls: 'text-muted' },
};
const spring = { type: 'spring' as const, stiffness: 420, damping: 38 };

/** Ranked table. Rows glide to their new position (motion `layout`) whenever scores change the order. */
export function Leaderboard({ board, rows, showScores }: { board: Board; rows: LbRow[]; showScores: boolean }) {
  const overall = board === 'QUALIFICATION';
  const grid = overall
    ? 'grid-cols-[2.75rem_1fr_3.5rem_3.5rem_4rem_6rem] sm:grid-cols-[4rem_1fr_6rem_6rem_6rem_8rem]'
    : 'grid-cols-[2.75rem_1fr_5rem] sm:grid-cols-[4rem_1fr_8rem]';
  const value = (r: LbRow) => (board === 'SECOND_QUALIFICATION' ? r.round2 : r.round1);
  return (
    <div className="overflow-hidden rounded-2xl border border-line/10 bg-surface">
      <div className={`grid ${grid} items-center gap-2 border-b border-line/10 px-3 py-2.5 text-sm font-medium text-muted sm:px-5`}>
        <span>Rank</span><span>Team</span>
        {overall ? (<><span className="text-right">R1</span><span className="text-right">R2</span><span className="text-right">Best</span><span className="text-right">Status</span></>) : <span className="text-right">Score</span>}
      </div>
      <div className="max-h-[68vh] overflow-y-auto">
        {rows.map((r, i) => (
          <motion.div key={r.teamId} layout="position"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ layout: spring, opacity: { delay: Math.min(i, 14) * 0.025 }, y: { delay: Math.min(i, 14) * 0.025 } }}>
            <div className={`grid ${grid} items-center gap-2 px-3 py-2.5 sm:px-5 ${r.rank !== null && r.rank <= 3 ? 'bg-fg/[0.04]' : ''}`}>
              <span className={`num font-display text-2xl font-bold ${r.rank !== null && r.rank <= 3 ? 'text-gold' : 'text-muted'}`}>{r.rank ?? '–'}</span>
              <span className="flex min-w-0 items-center gap-2">
                <AllianceDot alliance={r.alliance} size={12} />
                <span className="min-w-0">
                  <span className="block truncate font-display text-2xl font-bold leading-tight">{r.code}</span>
                  {r.name && <span className="block truncate text-lg font-bold leading-tight text-fg">{r.name}</span>}
                  {r.schoolName && <span className="block truncate text-xs font-normal text-muted">{r.schoolName}</span>}
                </span>
              </span>
              {overall ? (
                <>
                  <span className="num text-right text-lg text-muted">{showScores ? <AnimatedNumber value={r.round1} /> : '·'}</span>
                  <span className="num text-right text-lg text-muted">{showScores ? <AnimatedNumber value={r.round2} /> : '·'}</span>
                  <span className="num text-right font-display text-3xl font-bold">{showScores ? <AnimatedNumber value={r.best} /> : '·'}</span>
                  <span className="text-right">{r.status && <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>}</span>
                </>
              ) : (
                <span className="num text-right font-display text-3xl font-bold">{showScores ? <AnimatedNumber value={value(r)} /> : '·'}</span>
              )}
            </div>
            {overall && i === 15 && rows.length > 16 && (
              <div className="flex items-center gap-3 px-3 py-1 text-xs font-semibold text-mint sm:px-5">
                <span className="h-px flex-1 bg-mint/40" />Top 16 cutoff<span className="h-px flex-1 bg-mint/40" />
              </div>
            )}
          </motion.div>
        ))}
        {rows.length === 0 && <p className="p-8 text-center text-muted">No teams in this category yet.</p>}
      </div>
    </div>
  );
}
