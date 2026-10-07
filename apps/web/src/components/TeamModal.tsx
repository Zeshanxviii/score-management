import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import type { Alliance } from '../lib/constants';
import type { TeamRef } from '../lib/api';

export interface TeamForm { code: string; name: string; schoolName: string; alliance: Alliance | '' }

/** Add / edit team dialog. Empty alliance = leave unset (server stores null). */
export function TeamModal({ team, busy, error, onClose, onSave }: {
  team: TeamRef | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (form: TeamForm) => void;
}) {
  const [code, setCode] = useState(team?.code ?? '');
  const [name, setName] = useState(team?.name ?? '');
  const [school, setSchool] = useState(team?.schoolName ?? '');
  const [alliance, setAlliance] = useState<Alliance | ''>(team?.alliance ?? '');

  useEffect(() => {
    setCode(team?.code ?? '');
    setName(team?.name ?? '');
    setSchool(team?.schoolName ?? '');
    setAlliance(team?.alliance ?? '');
  }, [team]);

  const input = 'mt-1 w-full rounded-lg border border-line/20 bg-surface2 px-3 py-2 text-sm';
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="presentation">
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }}
        className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={team ? 'Edit team' : 'Add team'}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-3xl font-bold">{team ? `Edit ${team.code}` : 'Add team'}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-fg"><X size={18} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ code, name, schoolName: school, alliance }); }} className="space-y-3">
          <label className="block text-sm font-medium">Team code
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ST120" maxLength={16} required className={input} aria-label="Team code" />
          </label>
          <label className="block text-sm font-medium">Team name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Robo Warriors" maxLength={200} className={input} aria-label="Team name" />
          </label>
          <label className="block text-sm font-medium">School name
            <input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="e.g. St. Paul's School" maxLength={200} className={input} aria-label="School name" />
          </label>
          <label className="block text-sm font-medium">Side
            <select value={alliance} onChange={(e) => setAlliance(e.target.value as Alliance | '')} className={input} aria-label="Alliance">
              <option value="">No side</option>
              <option value="RED">Red</option>
              <option value="BLUE">Blue</option>
            </select>
          </label>
          {error && <p role="alert" className="text-sm text-live">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold ring-1 ring-line/20">Cancel</button>
            <button disabled={busy} className="rounded-lg bg-fg px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60">{busy ? 'Saving…' : team ? 'Save changes' : 'Add team'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
