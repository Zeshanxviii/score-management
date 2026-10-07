import { motion } from 'motion/react';
import type { MatchStatus } from '../lib/constants';

const STYLE: Record<MatchStatus, string> = {
  SCHEDULED: 'bg-fg/10 text-muted', READY: 'bg-accent/15 text-accent', LIVE: 'bg-live/15 text-live',
  PAUSED: 'bg-gold/15 text-gold', COMPLETED: 'bg-mint/15 text-mint', CANCELLED: 'bg-fg/10 text-muted line-through',
};
const LABEL: Record<MatchStatus, string> = { SCHEDULED: 'Scheduled', READY: 'Ready', LIVE: 'Live', PAUSED: 'Paused', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };

export function LiveDot({ className = 'bg-live' }: { className?: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <motion.span className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${className}`} animate={{ scale: [1, 2.4], opacity: [0.6, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }} />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${className}`} />
    </span>
  );
}

export function StatusBadge({ status }: { status: MatchStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLE[status]}`}>
      {status === 'LIVE' && <LiveDot />}
      {LABEL[status]}
    </span>
  );
}
