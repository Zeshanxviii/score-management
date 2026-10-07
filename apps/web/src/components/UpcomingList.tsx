import { AnimatePresence, motion } from 'motion/react';
import type { Match } from '../lib/api';
import { fmtTime, teamCode } from '../lib/format';
import { AllianceDot } from './AllianceBadge';

/** Next three matches in the queue, in running order. */
export function UpcomingList({ matches }: { matches: Match[] }) {
  return (
    <ol className="space-y-2">
      <AnimatePresence initial={false} mode="popLayout">
        {matches.map((m, i) => (
          <motion.li key={m.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34, delay: i * 0.05 }}
            className="flex items-center gap-3 rounded-xl border border-line/10 bg-surface p-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-xl font-bold ${i === 0 ? 'bg-fg text-bg' : 'bg-surface2 text-muted'}`}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-2xl font-bold leading-tight">
                <span className="inline-flex items-center gap-1.5"><AllianceDot alliance={m.teamA?.alliance} size={10} />{teamCode(m.teamA)}</span>
                {m.teamA?.name && <span className="ml-2 text-lg font-bold">{m.teamA.name}</span>}
                <span className="text-muted"> vs </span>
                {m.teamB ? <><span className="inline-flex items-center gap-1.5">{m.teamB.code}<AllianceDot alliance={m.teamB?.alliance} size={10} /></span>{m.teamB.name && <span className="ml-2 text-lg font-bold">{m.teamB.name}</span>}</> : (m.round.endsWith('QUALIFICATION') ? '—' : 'TBD')}
              </div>
              <div className="text-xs text-muted">Match {m.matchNumber}{m.status === 'READY' ? ' · Ready' : ''}</div>
            </div>
            <span className="num shrink-0 text-sm font-semibold text-muted">{fmtTime(m.scheduledAt)}</span>
          </motion.li>
        ))}
      </AnimatePresence>
      {matches.length === 0 && <li className="rounded-xl border border-dashed border-line/20 p-4 text-center text-sm text-muted">No more matches queued in this round.</li>}
    </ol>
  );
}
