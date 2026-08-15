import { useEffect, useState } from 'react';
import {
  fetchHistory,
  type HistoryQuery,
  type HistoryResult,
} from '../lib/historyApi';

function queryKey(q: HistoryQuery): string {
  if ('duration' in q) return `${q.type}|d:${q.duration}`;
  return `${q.type}|r:${q.fromDate}-${q.toDate}`;
}

export function useHistoryPrices(query: HistoryQuery) {
  const [data, setData] = useState<HistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = queryKey(query);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    void fetchHistory(query, ac.signal)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Không lấy được lịch sử');
        setLoading(false);
      });

    return () => ac.abort();
    // key captures query identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading, error };
}
