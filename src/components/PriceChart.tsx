import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import type { CtjTick } from '../lib/ctj';
import type { Position } from '../lib/storage';
import { calcPositionPnl } from '../lib/pnl';
import { formatSignedVnd, formatVnd } from '../lib/format';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin,
);

const LINE_COLORS = ['#c45c26', '#b45309', '#9a3412', '#a16207', '#c2410c'];
const Y_STEP = 50_000;

function yScaleBounds(
  ticks: CtjTick[],
  positions: Position[],
): { min: number; max: number } | undefined {
  if (ticks.length === 0) return undefined;
  const values = [
    ...ticks.flatMap((t) => [t.buyprice, t.sellprice]),
    ...positions.map((p) => p.buyPrice),
  ];
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  let min = Math.floor(dataMin / Y_STEP) * Y_STEP;
  let max = Math.ceil(dataMax / Y_STEP) * Y_STEP;
  if (min === max) {
    min -= Y_STEP;
    max += Y_STEP;
  }
  return { min, max };
}

/** `null` = cả ngày; số = số giờ gần nhất tính từ tick mới nhất */
export type ChartRangeHours = null | 1 | 2 | 3 | 5;

const RANGE_OPTIONS: { value: ChartRangeHours; label: string }[] = [
  { value: null, label: 'Cả ngày' },
  { value: 1, label: '1 giờ' },
  { value: 2, label: '2 giờ' },
  { value: 3, label: '3 giờ' },
  { value: 5, label: '5 giờ' },
];

function filterTicksByRange(ticks: CtjTick[], rangeHours: ChartRangeHours): CtjTick[] {
  if (rangeHours == null || ticks.length === 0) return ticks;
  const latestMs = Math.max(...ticks.map((t) => new Date(t.last_update).getTime()));
  const cutoff = latestMs - rangeHours * 60 * 60 * 1000;
  return ticks.filter((t) => new Date(t.last_update).getTime() >= cutoff);
}

type Props = {
  ticks: CtjTick[];
  positions: Position[];
  currentBuy: number | null;
};

export function PriceChart({ ticks, positions, currentBuy }: Props) {
  const [rangeHours, setRangeHours] = useState<ChartRangeHours>(null);

  const visibleTicks = useMemo(
    () => filterTicksByRange(ticks, rangeHours),
    [ticks, rangeHours],
  );

  const yBounds = useMemo(
    () => yScaleBounds(visibleTicks, positions),
    [visibleTicks, positions],
  );

  const buyLine = visibleTicks.map((t) => ({
    x: new Date(t.last_update).getTime(),
    y: t.buyprice,
  }));
  const sellLine = visibleTicks.map((t) => ({
    x: new Date(t.last_update).getTime(),
    y: t.sellprice,
  }));

  const pricePointRadius =
    visibleTicks.length > 80 ? 2 : visibleTicks.length > 40 ? 3 : 4;
  const priceHoverRadius = pricePointRadius + 3;

  const annotations = Object.fromEntries(
    positions.map((p, i) => {
      const color = LINE_COLORS[i % LINE_COLORS.length];
      const pnl =
        currentBuy == null
          ? null
          : calcPositionPnl(p.buyPrice, p.quantity, currentBuy);
      const status =
        currentBuy == null
          ? ''
          : currentBuy >= p.buyPrice
            ? 'đã tới/qua'
            : 'chưa tới';
      const labelText = [
        formatVnd(p.buyPrice),
        `SL ${p.quantity}`,
        status,
        pnl ? formatSignedVnd(pnl.pnl) : null,
      ]
        .filter(Boolean)
        .join(' · ');

      return [
        `pos-${p.id}`,
        {
          type: 'line' as const,
          yMin: p.buyPrice,
          yMax: p.buyPrice,
          borderColor: color,
          borderWidth: 2,
          borderDash: [6, 4],
          label: {
            display: true,
            content: labelText,
            position: 'end' as const,
            backgroundColor: color,
            color: '#fff',
            font: { size: 11, family: 'IBM Plex Sans' },
            padding: { x: 6, y: 3 },
            borderRadius: 4,
          },
        },
      ];
    }),
  );

  const data = {
    datasets: [
      {
        type: 'line' as const,
        label: 'Mua vào (shop)',
        data: buyLine,
        borderColor: '#1a6b4a',
        backgroundColor: 'rgba(26, 107, 74, 0.08)',
        fill: true,
        tension: 0.15,
        borderWidth: 2,
        pointStyle: 'circle' as const,
        pointRadius: pricePointRadius,
        pointHoverRadius: priceHoverRadius,
        pointBackgroundColor: 'rgba(26, 107, 74, 0.45)',
        pointBorderColor: '#1a6b4a',
        pointBorderWidth: 1.5,
        pointHitRadius: 8,
      },
      {
        type: 'line' as const,
        label: 'Bán ra (shop)',
        data: sellLine,
        borderColor: '#8a4b2a',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.15,
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointStyle: 'circle' as const,
        pointRadius: pricePointRadius,
        pointHoverRadius: priceHoverRadius,
        pointBackgroundColor: 'rgba(138, 75, 42, 0.4)',
        pointBorderColor: '#8a4b2a',
        pointBorderWidth: 1.5,
        pointHitRadius: 8,
      },
    ],
  };

  return (
    <section className="panel chart-panel">
      <div className="panel__head row">
        <div>
          <h2>Biểu đồ trong ngày</h2>
          <p className="muted">
            Đường ngang cam = giá vốn mua · xem giá thị trường tới / qua mức đó
          </p>
        </div>
        <label className="chart-range">
          Khoảng thời gian
          <select
            value={rangeHours == null ? 'day' : String(rangeHours)}
            onChange={(e) => {
              const v = e.target.value;
              setRangeHours(v === 'day' ? null : (Number(v) as 1 | 2 | 3 | 5));
            }}
          >
            {RANGE_OPTIONS.map((opt) => (
              <option
                key={opt.label}
                value={opt.value == null ? 'day' : String(opt.value)}
              >
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="chart-wrap">
        {visibleTicks.length === 0 ? (
          <p className="muted center">
            {ticks.length === 0
              ? 'Chưa có dữ liệu chart'
              : 'Không có tick trong khoảng đã chọn'}
          </p>
        ) : (
          <Chart
            type="line"
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'nearest', intersect: true, axis: 'xy' },
              plugins: {
                legend: {
                  position: 'top',
                  labels: { boxWidth: 12, font: { family: 'IBM Plex Sans' } },
                },
                annotation: {
                  annotations,
                },
                tooltip: {
                  callbacks: {
                    label(ctx) {
                      const y = ctx.parsed.y;
                      if (y == null) return '';
                      return `${ctx.dataset.label}: ${formatVnd(y)}`;
                    },
                  },
                },
              },
              scales: {
                x: {
                  type: 'time',
                  time: {
                    unit: 'minute',
                    displayFormats: { minute: 'HH:mm', hour: 'HH:mm' },
                  },
                  grid: { color: 'rgba(0,0,0,0.05)' },
                  ticks: { font: { family: 'IBM Plex Sans', size: 11 } },
                },
                y: {
                  min: yBounds?.min,
                  max: yBounds?.max,
                  grid: { color: 'rgba(0,0,0,0.06)' },
                  ticks: {
                    stepSize: Y_STEP,
                    font: { family: 'IBM Plex Sans', size: 11 },
                    callback: (v) =>
                      typeof v === 'number'
                        ? new Intl.NumberFormat('vi-VN').format(v)
                        : v,
                  },
                },
              },
            }}
          />
        )}
      </div>
    </section>
  );
}
