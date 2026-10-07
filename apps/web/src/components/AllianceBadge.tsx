import type { Alliance } from '../lib/constants';

export function AllianceDot({ alliance, size = 10 }: { alliance: Alliance | null | undefined; size?: number }) {
  if (!alliance) return null;
  return (
    <span
      title={alliance === 'RED' ? 'Red alliance' : 'Blue alliance'}
      aria-label={alliance === 'RED' ? 'Red alliance' : 'Blue alliance'}
      className={`inline-block shrink-0 rounded-full ring-1 ring-black/20 ${alliance === 'RED' ? 'bg-red-500' : 'bg-blue-500'}`}
      style={{ width: size, height: size }}
    />
  );
}

export function AllianceBadge({ alliance }: { alliance: Alliance | null | undefined }) {
  if (!alliance) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        alliance === 'RED' ? 'bg-red-500/15 text-red-600' : 'bg-blue-500/15 text-blue-600'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${alliance === 'RED' ? 'bg-red-500' : 'bg-blue-500'}`} />
      {alliance === 'RED' ? 'Red' : 'Blue'}
    </span>
  );
}
