import type { Position } from './storage';

export type PositionPnl = {
  diff: number;
  diffPct: number;
  pnl: number;
};

export function calcPositionPnl(
  buyPrice: number,
  quantity: number,
  currentBuy: number,
): PositionPnl {
  const diff = currentBuy - buyPrice;
  const diffPct = buyPrice === 0 ? 0 : (diff / buyPrice) * 100;
  const pnl = diff * quantity;
  return { diff, diffPct, pnl };
}

export function portfolioStats(positions: Position[], currentBuy: number | null) {
  const totalQty = positions.reduce((s, p) => s + p.quantity, 0);
  const cost = positions.reduce((s, p) => s + p.buyPrice * p.quantity, 0);
  const avgCost = totalQty === 0 ? 0 : cost / totalQty;
  const totalPnl =
    currentBuy == null
      ? 0
      : positions.reduce(
          (s, p) => s + calcPositionPnl(p.buyPrice, p.quantity, currentBuy).pnl,
          0,
        );
  return { totalQty, avgCost, totalPnl, cost };
}
