export type ProductId = 'BPQ1L' | 'BPQ1KG' | 'BPQ10L';

export type CtjTick = {
  id: ProductId;
  name: string;
  buyprice: number;
  sellprice: number;
  change_buy: number;
  change_sell: number;
  UnitName: string;
  last_update: string;
};

export const PRODUCT_IDS: ProductId[] = ['BPQ1L', 'BPQ10L', 'BPQ1KG'];

const BASE = 'https://prices.ctj.com.vn/today';

export async function fetchTodayPrices(productId: ProductId): Promise<CtjTick[]> {
  const url = `${BASE}?id=${productId}&_t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CTJ API ${res.status}`);
  }
  const data = (await res.json()) as CtjTick[];
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('CTJ API returned empty data');
  }
  return data;
}

export function latestTick(ticks: CtjTick[]): CtjTick | null {
  if (ticks.length === 0) return null;
  return ticks.reduce((best, t) =>
    new Date(t.last_update) > new Date(best.last_update) ? t : best,
  );
}

export function ticksFingerprint(ticks: CtjTick[]): string {
  const latest = latestTick(ticks);
  if (!latest) return '';
  return `${ticks.length}|${latest.id}|${latest.buyprice}|${latest.sellprice}|${latest.last_update}`;
}

export function priceFingerprint(tick: CtjTick | null): string {
  if (!tick) return '';
  return `${tick.id}|${tick.buyprice}|${tick.sellprice}`;
}
