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

export const PRODUCTS: { id: ProductId; label: string }[] = [
  { id: 'BPQ1L', label: '1L Bạc miếng Phú Quý 999 1 lượng' },
  { id: 'BPQ10L', label: '10L Bạc thỏi Phú Quý 999 10 lượng' },
  { id: 'BPQ1KG', label: '1KG Bạc thỏi Phú Quý 999 1 kg' },
];

export function latestTick(ticks: CtjTick[]): CtjTick | null {
  if (ticks.length === 0) return null;
  return ticks.reduce((best, t) =>
    new Date(t.last_update) > new Date(best.last_update) ? t : best,
  );
}

export type DayExtremes = {
  minBuy: CtjTick;
  maxBuy: CtjTick;
  minSell: CtjTick;
  maxSell: CtjTick;
};

/** Min/max mua & bán trong ngày (theo ticks đã có tới hiện tại). */
export function dayExtremes(ticks: CtjTick[]): DayExtremes | null {
  if (ticks.length === 0) return null;
  return ticks.reduce<DayExtremes>(
    (acc, t) => ({
      minBuy: t.buyprice < acc.minBuy.buyprice ? t : acc.minBuy,
      maxBuy: t.buyprice > acc.maxBuy.buyprice ? t : acc.maxBuy,
      minSell: t.sellprice < acc.minSell.sellprice ? t : acc.minSell,
      maxSell: t.sellprice > acc.maxSell.sellprice ? t : acc.maxSell,
    }),
    { minBuy: ticks[0], maxBuy: ticks[0], minSell: ticks[0], maxSell: ticks[0] },
  );
}
