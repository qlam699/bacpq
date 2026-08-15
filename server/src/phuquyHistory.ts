export type HistoryUnitType = 1 | 3; // Lượng and KG
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

type UpstreamPoint = {
  lastUpdate?: unknown;
  priceIn?: unknown;
  priceOut?: unknown;
};

type UpstreamBody = {
  errorCode?: unknown;
  message?: unknown;
  data?: Record<string, { changeRate?: unknown; pricePointInfoList?: UpstreamPoint[] }>;
};

const UPSTREAM =
  'https://be.phuquy.com.vn/jewelry/product-payment-service/api/products/statistics-price/2';
const PRODUCT_KEY = 'BAC';
const CACHE_TTL_MS = 90_000;

const cache = new Map<string, { expires: number; value: HistoryResult }>();

export function parseHistoryUnitType(v: unknown): HistoryUnitType | null {
  if (v === 1 || v === '1') return 1;
  if (v === 3 || v === '3') return 3;
  return null;
}

export function isHistoryDuration(v: unknown): v is HistoryDuration {
  return v === '1D' || v === '7D' || v === '1M' || v === '3M' || v === '1Y';
}

/** dd/MM/yyyy */
export function isHistoryDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(v);
}

function cacheKey(
  type: HistoryUnitType,
  duration: HistoryDuration | null,
  fromDate: string | null,
  toDate: string | null,
): string {
  if (duration) return `${type}|d:${duration}`;
  return `${type}|r:${fromDate}-${toDate}`;
}

function normalize(body: UpstreamBody): HistoryResult {
  if (String(body.errorCode ?? '') !== '0') {
    throw new Error(
      typeof body.message === 'string' ? body.message : 'Phú Quý history error',
    );
  }
  const block = body.data?.[PRODUCT_KEY];
  if (!block || !Array.isArray(block.pricePointInfoList)) {
    throw new Error('Invalid Phú Quý history payload');
  }
  const points: HistoryPoint[] = [];
  for (const p of block.pricePointInfoList) {
    if (typeof p.lastUpdate !== 'string') continue;
    const buy = Number(p.priceIn);
    const sell = Number(p.priceOut);
    if (!Number.isFinite(buy) || !Number.isFinite(sell)) continue;
    points.push({ t: p.lastUpdate, buy, sell });
  }
  const changeRate = Number(block.changeRate);
  return {
    changeRate: Number.isFinite(changeRate) ? changeRate : 0,
    points,
  };
}

export async function fetchPhuquyHistory(opts: {
  type: HistoryUnitType;
  duration?: HistoryDuration | null;
  fromDate?: string | null;
  toDate?: string | null;
}): Promise<HistoryResult> {
  const duration = opts.duration ?? null;
  const fromDate = opts.fromDate ?? null;
  const toDate = opts.toDate ?? null;

  if (!duration && !(fromDate && toDate)) {
    throw new Error('duration or fromDate+toDate required');
  }
  if (duration && (fromDate || toDate)) {
    throw new Error('use duration OR fromDate+toDate, not both');
  }

  const key = cacheKey(opts.type, duration, fromDate, toDate);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const params = new URLSearchParams();
  params.set('type', String(opts.type));
  if (duration) {
    params.set('duration', duration);
    params.set('fromDate', '');
    params.set('toDate', '');
  } else {
    params.set('duration', '');
    params.set('fromDate', fromDate!);
    params.set('toDate', toDate!);
  }

  const res = await fetch(`${UPSTREAM}?${params}`, {
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'vi-VN',
      origin: 'https://phuquy.com.vn',
      referer: 'https://phuquy.com.vn/',
    },
  });
  if (!res.ok) {
    throw new Error(`Phú Quý API ${res.status}`);
  }
  const body = (await res.json()) as UpstreamBody;
  const value = normalize(body);
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
  return value;
}
