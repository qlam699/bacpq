export type HistoryUnitType = 1 | 3;
export type HistoryDuration = '1D' | '7D' | '1M' | '3M' | '1Y';

export type HistoryPoint = {
  t: string;
  buy: number;
  sell: number;
};

export type HistoryResult = {
  changeRate: number;
  points: HistoryPoint[];
};

export type HistoryQuery =
  | { type: HistoryUnitType; duration: HistoryDuration }
  | { type: HistoryUnitType; fromDate: string; toDate: string };

export async function fetchHistory(
  query: HistoryQuery,
  signal?: AbortSignal,
): Promise<HistoryResult> {
  const params = new URLSearchParams();
  params.set('type', String(query.type));
  if ('duration' in query) {
    params.set('duration', query.duration);
  } else {
    params.set('fromDate', query.fromDate);
    params.set('toDate', query.toDate);
  }

  const res = await fetch(`/api/history?${params}`, { signal });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let message = body.slice(0, 160) || `API ${res.status}`;
    try {
      const parsed = JSON.parse(body) as { error?: string };
      if (typeof parsed.error === 'string' && parsed.error) message = parsed.error;
    } catch {
      /* keep raw body */
    }
    throw new Error(message);
  }
  const data = (await res.json()) as HistoryResult;
  if (!data || !Array.isArray(data.points)) {
    throw new Error('Invalid history response');
  }
  return data;
}
