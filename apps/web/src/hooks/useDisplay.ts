import { useCallback, useEffect, useRef, useState } from 'react';
import { publicApi, type Display } from '../lib/api';
import type { Board, Category } from '../lib/constants';

/** Loads the public screen payload and re-fetches instantly when the server pushes a `refresh` event (SSE). Falls back to polling. */
export function useDisplay(category: Category, board: Board | null) {
  const [data, setData] = useState<Display | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const id = ++seq.current;
    try {
      const d = await publicApi.display(category, board);
      if (id === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [category, board]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const es = new EventSource(publicApi.streamUrl(category));
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener('refresh', () => void load());
    const poll = setInterval(() => void load(), 15_000);
    return () => { es.close(); clearInterval(poll); };
  }, [category, load]);

  // Never show the other category's data while switching.
  return { data: data && data.category === category ? data : null, error, connected, reload: load };
}
