import { EventEmitter } from 'node:events';

/**
 * In-process pub/sub used by the SSE stream so public screens refresh instantly after an admin change.
 * NOTE: for multiple API instances, replace publish() with Postgres LISTEN/NOTIFY or Redis pub/sub.
 */
const bus = new EventEmitter();
bus.setMaxListeners(0);
const channel = (competitionId: string, category: string) => `${competitionId}:${category}`;

export const publishChange = (competitionId: string, category: string) => bus.emit(channel(competitionId, category));
export function subscribe(competitionId: string, category: string, fn: () => void): () => void {
  const ch = channel(competitionId, category);
  bus.on(ch, fn);
  return () => bus.off(ch, fn);
}
