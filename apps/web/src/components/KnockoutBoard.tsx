import { motion } from 'motion/react';
import { Trophy } from 'lucide-react';
import type { Match, TeamRef } from '../lib/api';
import { fmtScore, fmtTime, slotLabel } from '../lib/format';
import { StatusBadge } from './StatusBadge';
import { AnimatedNumber } from './AnimatedNumber';
import { AllianceDot } from './AllianceBadge';

function Line({ team, score, won, showScores, showWinner }: { team: TeamRef | null; score: number | null; won: boolean; showScores: boolean; showWinner: boolean }) {
  const win = won && showWinner;
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${win ? 'bg-gold/15 ring-1 ring-gold/50' : 'bg-surface2'}`}>
      <span className={`min-w-0 flex-1 ${team ? '' : 'text-muted'}`}>
        <span className="flex items-center gap-2 truncate font-display text-2xl font-bold">
          {win && <Trophy size={16} className="shrink-0 text-gold" aria-label="Winner" />}
          <AllianceDot alliance={team?.alliance} size={10} />
          {team ? team.code : 'To be assigned'}
        </span>
        {team?.name && <span className="block truncate text-base font-bold leading-tight">{team.name}</span>}
        {team?.schoolName && <span className="block truncate text-xs font-normal text-muted">{team.schoolName}</span>}
      </span>
      {showScores && <span className="num font-display text-3xl font-bold">{score === null ? <span className="text-muted">{fmtScore(null)}</span> : <AnimatedNumber value={score} />}</span>}
    </div>
  );
}

/** Result cards for a knockout round (pairings and winners are set manually by the administrator). */
export function KnockoutBoard({ matches, showScores, showWinner }: { matches: Match[]; showScores: boolean; showWinner: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {matches.map((m, i) => (
        <motion.div key={m.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 30 }}
          className={`rounded-2xl border bg-surface p-4 ${m.status === 'LIVE' ? 'border-live/60' : 'border-line/10'}`}>
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold">{slotLabel(m.round, i)} <span className="font-normal text-muted">· Match {m.matchNumber}</span></span>
            <StatusBadge status={m.status} />
          </div>
          <div className="space-y-2">
            <Line team={m.teamA} score={m.scoreA} won={!!m.winnerId && m.winnerId === m.teamA?.id} showScores={showScores} showWinner={showWinner} />
            <Line team={m.teamB} score={m.scoreB} won={!!m.winnerId && m.winnerId === m.teamB?.id} showScores={showScores} showWinner={showWinner} />
          </div>
          <div className="mt-3 text-xs text-muted">{fmtTime(m.scheduledAt)}</div>
        </motion.div>
      ))}
      {matches.length === 0 && <p className="rounded-2xl border border-dashed border-line/20 p-8 text-center text-muted sm:col-span-2">No matches in this round yet.</p>}
    </div>
  );
}
