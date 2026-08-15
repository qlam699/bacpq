import type { HistoryPoint } from './historyApi';
import { WEEKDAY_SHORT } from './format';

export type WeekdayStat = {
  weekday: number;
  label: string;
  /** Trung bình % đổi đóng cửa ngày vs ngày giao dịch trước */
  avgPct: number | null;
  upDays: number;
  downDays: number;
  flatDays: number;
  samples: number;
};

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Đóng cửa mỗi ngày (giá mua vào cuối ngày) + % so với ngày trước. */
export function weekdayStatsFromPoints(points: HistoryPoint[]): WeekdayStat[] {
  if (points.length === 0) {
    return WEEKDAY_SHORT.map((label, weekday) => ({
      weekday,
      label,
      avgPct: null,
      upDays: 0,
      downDays: 0,
      flatDays: 0,
      samples: 0,
    }));
  }

  const byDay = new Map<string, { weekday: number; close: number }>();
  for (const p of points) {
    const d = new Date(p.t);
    const key = dayKey(d);
    byDay.set(key, { weekday: d.getDay(), close: p.buy });
  }

  const days = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, v]) => v);

  const buckets: {
    pcts: number[];
    up: number;
    down: number;
    flat: number;
  }[] = Array.from({ length: 7 }, () => ({
    pcts: [],
    up: 0,
    down: 0,
    flat: 0,
  }));

  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1].close;
    const cur = days[i];
    if (prev <= 0) continue;
    const pct = ((cur.close - prev) / prev) * 100;
    const b = buckets[cur.weekday];
    b.pcts.push(pct);
    if (pct > 0.05) b.up += 1;
    else if (pct < -0.05) b.down += 1;
    else b.flat += 1;
  }

  return buckets.map((b, weekday) => {
    const samples = b.pcts.length;
    const avgPct =
      samples === 0
        ? null
        : b.pcts.reduce((s, n) => s + n, 0) / samples;
    return {
      weekday,
      label: WEEKDAY_SHORT[weekday],
      avgPct,
      upDays: b.up,
      downDays: b.down,
      flatDays: b.flat,
      samples,
    };
  });
}
