import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { fmtScore } from '../lib/format';

/** Counts up/down to the new value whenever it changes. */
export function AnimatedNumber({ value, className }: { value: number | null; className?: string }) {
  const mv = useMotionValue(value ?? 0);
  const text = useTransform(mv, (v) => fmtScore(Math.round(v * 100) / 100));
  useEffect(() => {
    if (value === null) return;
    const controls = animate(mv, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, mv]);
  if (value === null) return <span className={className}>–</span>;
  return <motion.span className={className}>{text}</motion.span>;
}
