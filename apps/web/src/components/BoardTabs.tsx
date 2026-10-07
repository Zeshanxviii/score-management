import { motion } from 'motion/react';
import { BOARDS, type Board } from '../lib/constants';

/** One tab per round; each round has its own leaderboard. The red dot marks the board currently on the public screen. */
export function BoardTabs({ value, onChange, liveBoard, id }: { value: Board; onChange: (b: Board) => void; liveBoard?: Board; id: string }) {
  return (
    <div role="tablist" aria-label="Rounds" className="flex gap-1 overflow-x-auto rounded-xl bg-surface p-1 [scrollbar-width:none]">
      {BOARDS.map((b) => {
        const on = b.id === value;
        return (
          <button key={b.id} role="tab" aria-selected={on} onClick={() => onChange(b.id)}
            className={`relative shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${on ? 'text-bg' : 'text-muted hover:text-fg'}`}>
            {on && <motion.span layoutId={`tab-${id}`} className="absolute inset-0 rounded-lg bg-fg" transition={{ type: 'spring', stiffness: 520, damping: 42 }} />}
            <span className="relative flex items-center gap-1.5">
              {b.short}
              {b.id === liveBoard && <span title="On the public screen" className="h-1.5 w-1.5 rounded-full bg-live" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
