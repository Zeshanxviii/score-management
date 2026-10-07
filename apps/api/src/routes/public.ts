import { Router } from 'express';
import { BoardSchema } from '@itu/shared';
import { getScope } from '../middleware/scope';
import { filterBoard, getBoard, getSettings, publicDisplay } from '../services/boards';
import { subscribe } from '../services/events';

/** Unauthenticated read-only endpoints for the spectator screen. All hidden data is stripped server-side. */
const r = Router({ mergeParams: true });

r.get('/display', async (req, res) => {
  const board = req.query.board ? BoardSchema.parse(String(req.query.board).toUpperCase()) : undefined;
  res.set('Cache-Control', 'public, max-age=2');
  res.json({ data: await publicDisplay(getScope(res), board) });
});

r.get('/boards/:board', async (req, res) => {
  const scope = getScope(res);
  const board = BoardSchema.parse(String(req.params.board).toUpperCase());
  const settings = await getSettings(scope.competitionId, scope.category);
  res.set('Cache-Control', 'public, max-age=2');
  res.json({ data: filterBoard(await getBoard(scope, board), settings[board]) });
});

/** Server-Sent Events: emits `refresh` whenever the admin changes data/visibility/active board. Clients then re-fetch /display. */
r.get('/stream', (req, res) => {
  const { competitionId, category } = getScope(res);
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  const off = subscribe(competitionId, category, () => res.write('event: refresh\ndata: {}\n\n'));
  const beat = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => { clearInterval(beat); off(); });
});

export default r;
