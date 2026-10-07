import { AnimatePresence, motion } from 'motion/react';
import { Radio } from 'lucide-react';
import type { Match, TeamRef } from '../lib/api';
import { ROUND_LABEL } from '../lib/constants';
import { fmtTime } from '../lib/format';
import { AnimatedNumber } from './AnimatedNumber';
import { LiveDot } from './StatusBadge';
import { AllianceBadge } from './AllianceBadge';

function Side({ team, score, show, emptyHint }: { team: TeamRef | null; score: number | null; show: boolean; emptyHint: string }) {
  return (
    <div className="min-w-0 text-center">
      {team?.alliance && <div className="mb-2 flex justify-center"><AllianceBadge alliance={team.alliance} /></div>}
      <div className={`truncate font-display text-5xl font-bold leading-none sm:text-6xl ${team ? 'text-fg' : 'text-muted'}`}>{team?.code ?? '—'}</div>
      {team?.name && <div className="mt-2 truncate text-xl font-bold leading-tight text-fg">{team.name}</div>}
      <div className="mt-1 truncate text-xs text-muted">{team ? team.schoolName ?? (!team.name ? '' : '') : emptyHint}</div>
      {show && <div className="num mt-3 font-display text-7xl font-bold leading-none text-fg sm:text-8xl"><AnimatedNumber value={score} /></div>}
    </div>
  );
}

/** The ONE current match. Swaps with a slide when the admin puts another match live. */
export function LiveMatch({ match, showScores }: { match: Match | null; showScores: boolean }) {
  const paused = match?.status === 'PAUSED';
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line/10 bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className={`inline-flex items-center gap-2 text-sm font-semibold ${match ? (paused ? 'text-gold' : 'text-live') : 'text-muted'}`}>
          {match ? (paused ? <Radio size={16} /> : <LiveDot />) : <Radio size={16} />}
          {match ? (paused ? 'Paused' : 'Live now') : 'No live match'}
        </span>
        {match && <span className="text-sm text-muted">Match {match.matchNumber} · {fmtTime(match.scheduledAt)}</span>}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {match ? (
          <motion.div key={match.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
            <div className="mb-4 text-sm font-medium text-muted">{ROUND_LABEL[match.round]}</div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
              <Side team={match.teamA} score={match.scoreA} show={showScores} emptyHint="" />
              <span className="pt-3 font-display text-2xl font-semibold text-muted">VS</span>
              <Side team={match.teamB} score={match.scoreB} show={showScores} emptyHint="No opponent listed" />
            </div>
            {!showScores && <p className="mt-4 text-center text-sm text-muted">Scores are hidden by the organisers</p>}
          </motion.div>
        ) : (
          <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-8 text-center text-muted">
            The arena is clear. The next match will appear here when it goes live.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
