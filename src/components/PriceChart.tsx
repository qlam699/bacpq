import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
  type Plugin,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import type { CtjTick } from '../lib/ctj';
import type { Position } from '../lib/storage';
import { calcPositionPnl } from '../lib/pnl';
import { formatSignedVnd, formatTime, formatVnd } from '../lib/format';

/** Vertical guide while hovering along X (no need to hit a point). */
const crosshairPlugin: Plugin = {
  id: 'vnCrosshair',
  afterDraw(chart) {
    const active = chart.tooltip?.getActiveElements() ?? [];
    if (active.length === 0) return;
    const x = active[0].element.x;
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(28, 25, 20, 0.35)';
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();
  },
};

ChartJS.register(
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin,
  crosshairPlugin,
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
    visibleTicks.length > 80 ? 2 : visibleTicks.length > 40 ? 3 : 3.5;
  const priceHoverRadius = pricePointRadius + 2;

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
            font: { size: 9, family: 'IBM Plex Sans' },
            padding: { x: 4, y: 2 },
            borderRadius: 3,
          },
        },
      ];
    }),
  );

  const data = {
    datasets: [
      {
        type: 'line' as const,
        label: 'Shop Mua vào',
        data: buyLine,
        borderColor: '#1a6b4a',
        backgroundColor: 'rgba(26, 107, 74, 0.08)',
        fill: true,
        tension: 0.15,
        borderWidth: 1.5,
        pointStyle: 'circle' as const,
        pointRadius: pricePointRadius,
        pointHoverRadius: priceHoverRadius,
        pointBackgroundColor: 'rgba(26, 107, 74, 0.45)',
        pointBorderColor: '#1a6b4a',
        pointBorderWidth: 1,
        pointHitRadius: 6,
      },
      {
        type: 'line' as const,
        label: 'Shop Bán ra',
        data: sellLine,
        borderColor: '#8a4b2a',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.15,
        borderWidth: 1.25,
        borderDash: [4, 4],
        pointStyle: 'circle' as const,
        pointRadius: pricePointRadius,
        pointHoverRadius: priceHoverRadius,
        pointBackgroundColor: 'rgba(138, 75, 42, 0.4)',
        pointBorderColor: '#8a4b2a',
        pointBorderWidth: 1,
        pointHitRadius: 6,
      },
    ],
  };

  return (
    <section className="panel chart-panel">
      <div className="panel__head row">
        <h2>Biểu đồ</h2>
        <label className="chart-range">
          <select
            aria-label="Khoảng thời gian"
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
              layout: { padding: { left: 4, right: 4 } },
              // Hover theo trục X: trên/dưới điểm vẫn hiện cả mua + bán
              interaction: { mode: 'index', intersect: false, axis: 'x' },
              plugins: {
                legend: {
                  position: 'top',
                  labels: {
                    boxWidth: 8,
                    boxHeight: 8,
                    padding: 8,
                    font: { family: 'IBM Plex Sans', size: 10 },
                  },
                },
                annotation: {
                  annotations,
                },
                tooltip: {
                  mode: 'index',
                  intersect: false,
                  backgroundColor: '#fffdf8',
                  titleColor: '#1c1914',
                  bodyColor: '#1c1914',
                  borderColor: '#d9d0bf',
                  borderWidth: 1,
                  titleFont: { family: 'IBM Plex Sans', size: 11, weight: 600 },
                  bodyFont: { family: 'IBM Plex Sans', size: 11 },
                  padding: 10,
                  displayColors: true,
                  boxPadding: 4,
                  callbacks: {
                    title(items) {
                      const x = items[0]?.parsed?.x;
                      if (x == null) return '';
                      return formatTime(new Date(x).toISOString());
                    },
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
                  ticks: {
                    maxRotation: 0,
                    autoSkipPadding: 12,
                    font: { family: 'IBM Plex Sans', size: 9 },
                  },
                },
                y: {
                  min: yBounds?.min,
                  max: yBounds?.max,
                  grid: { color: 'rgba(0,0,0,0.06)' },
                  ticks: {
                    stepSize: Y_STEP,
                    mirror: false,
                    padding: 6,
                    font: { family: 'IBM Plex Sans', size: 9 },
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
