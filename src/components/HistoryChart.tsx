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
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { useHistoryPrices } from '../hooks/useHistoryPrices';
import type {
  HistoryDuration,
  HistoryPoint,
  HistoryQuery,
  HistoryUnitType,
} from '../lib/historyApi';
import {
  formatHistoryAxisTick,
  formatHistoryTooltipTime,
  formatPct,
  formatVnd,
} from '../lib/format';
import { weekdayStatsFromPoints } from '../lib/weekdayStats';

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
);

const DURATIONS: HistoryDuration[] = ['1D', '7D', '1M', '3M', '1Y'];
const MAX_POINTS = 800;
const Y_STEP_LUONG = 50_000;
const Y_STEP_KG = 1_000_000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** yyyy-MM-dd → dd/MM/yyyy */
function toApiDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/** Date → yyyy-MM-dd (local) */
function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function defaultFromDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 13);
  return toInputDate(d);
}

function downsample(points: HistoryPoint[], max: number): HistoryPoint[] {
  if (points.length <= max) return points;
  const out: HistoryPoint[] = [];
  const last = points.length - 1;
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i * last) / (max - 1));
    out.push(points[idx]);
  }
  return out;
}

function yBounds(
  points: HistoryPoint[],
  type: HistoryUnitType,
): { min: number; max: number } | undefined {
  if (points.length === 0) return undefined;
  const step = type === 3 ? Y_STEP_KG : Y_STEP_LUONG;
  const values = points.flatMap((p) => [p.buy, p.sell]);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  let min = Math.floor(dataMin / step) * step;
  let max = Math.ceil(dataMax / step) * step;
  if (min === max) {
    min -= step;
    max += step;
  }
  return { min, max };
}

function timeUnitFor(duration: HistoryDuration | null): 'hour' | 'day' {
  if (duration === '1D' || duration === '7D') return 'hour';
  return 'day';
}

export function HistoryChart() {
  const [unitType, setUnitType] = useState<HistoryUnitType>(1);
  const [duration, setDuration] = useState<HistoryDuration | null>('7D');
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(() => toInputDate(new Date()));

  const query: HistoryQuery = useMemo(() => {
    if (duration) return { type: unitType, duration };
    return {
      type: unitType,
      fromDate: toApiDate(fromDate),
      toDate: toApiDate(toDate),
    };
  }, [unitType, duration, fromDate, toDate]);

  const { data, loading, error } = useHistoryPrices(query);

  const rawPoints = data?.points;
  const points = useMemo(
    () => downsample(rawPoints ?? [], MAX_POINTS),
    [rawPoints],
  );
  const bounds = useMemo(() => yBounds(points, unitType), [points, unitType]);
  const last = points.length > 0 ? points[points.length - 1] : null;
  const changeRate = data?.changeRate ?? null;
  const weekdayStats = useMemo(
    () => weekdayStatsFromPoints(rawPoints ?? []),
    [rawPoints],
  );
  const axisWithTime = false; //timeUnitFor(duration) === 'hour';

  const chartData = useMemo(
    () => ({
      datasets: [
        {
          type: 'line' as const,
          label: 'Shop bán ra',
          data: points.map((p) => ({
            x: new Date(p.t).getTime(),
            y: p.sell,
          })),
          borderColor: '#0d9488',
          backgroundColor: 'rgba(13, 148, 136, 0.08)',
          fill: true,
          tension: 0.15,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 3,
          pointHitRadius: 6,
        },
        {
          type: 'line' as const,
          label: 'Shop mua vào',
          data: points.map((p) => ({
            x: new Date(p.t).getTime(),
            y: p.buy,
          })),
          borderColor: '#a33b2b',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.15,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 3,
          pointHitRadius: 6,
        },
      ],
    }),
    [points],
  );

  return (
    <section className="panel history-panel">
      <div className="panel__head row">
        <h2>Biểu đồ lịch sử giá bạc</h2>
        <div className="history-unit" role="group" aria-label="Đơn vị">
          <button
            type="button"
            className={`btn ghost${unitType === 1 ? ' active' : ''}`}
            onClick={() => setUnitType(1)}
          >
            Lượng
          </button>
          <button
            type="button"
            className={`btn ghost${unitType === 3 ? ' active' : ''}`}
            onClick={() => setUnitType(3)}
          >
            Kilogram
          </button>
        </div>
      </div>

      <div className="history-toolbar">
        <label className="history-date">
          <span>Từ ngày</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setDuration(null);
            }}
          />
        </label>
        <label className="history-date">
          <span>đến ngày</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setDuration(null);
            }}
          />
        </label>
        <div className="history-presets" role="group" aria-label="Khoảng thời gian">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={`btn ghost${duration === d ? ' active' : ''}`}
              onClick={() => setDuration(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="history-summary">
        {changeRate != null ? (
          <p className={changeRate >= 0 ? 'up' : 'down'}>
            {changeRate >= 0 ? '▲' : '▼'} {Math.abs(changeRate).toFixed(1)}%
            {duration ? ` · ${duration}` : ' · khoảng đã chọn'}
          </p>
        ) : (
          <p className="muted">—</p>
        )}
        <div className="history-prices">
          <div>
            <span className="label">Shop bán ra</span>
            <strong className="history-sell">
              {last ? formatVnd(last.sell) : '—'}
            </strong>
          </div>
          <div>
            <span className="label">Shop mua vào</span>
            <strong className="history-buy">
              {last ? formatVnd(last.buy) : '—'}
            </strong>
          </div>
        </div>
      </div>

      {error ? <p className="inline-error">{error}</p> : null}

      <div className="history-chart-wrap">
        {loading && points.length === 0 ? (
          <p className="muted center">Đang tải lịch sử…</p>
        ) : points.length === 0 ? (
          <p className="muted center">Chưa có dữ liệu lịch sử</p>
        ) : (
          <Chart
            type="line"
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
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
                tooltip: {
                  backgroundColor: '#fffdf8',
                  titleColor: '#1c1914',
                  bodyColor: '#1c1914',
                  borderColor: '#d9d0bf',
                  borderWidth: 1,
                  titleFont: { family: 'IBM Plex Sans', size: 11, weight: 600 },
                  bodyFont: { family: 'IBM Plex Sans', size: 11 },
                  callbacks: {
                    title(items) {
                      const x = items[0]?.parsed?.x;
                      if (x == null) return '';
                      return formatHistoryTooltipTime(x);
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
                    unit: timeUnitFor(duration),
                  },
                  grid: { color: 'rgba(0,0,0,0.05)' },
                  ticks: {
                    maxRotation: 0,
                    autoSkipPadding: 10,
                    font: { family: 'IBM Plex Sans', size: 9 },
                    callback(_val, index, ticks) {
                      const raw = ticks[index]?.value;
                      if (typeof raw !== 'number') return '';
                      return formatHistoryAxisTick(raw, axisWithTime);
                    },
                  },
                },
                y: {
                  min: bounds?.min,
                  max: bounds?.max,
                  grid: { color: 'rgba(0,0,0,0.06)' },
                  ticks: {
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

      <div className="weekday-stats">
        <p className="weekday-stats__title label">
          TB % đổi giá mua vào theo thứ (đóng cửa ngày vs ngày trước)
        </p>
        <div className="weekday-stats__grid" role="list">
          {weekdayStats.map((s) => {
            const tone =
              s.avgPct == null ? '' : s.avgPct > 0 ? ' up' : s.avgPct < 0 ? ' down' : '';
            return (
              <div
                key={s.weekday}
                className={`weekday-stat${tone}`}
                role="listitem"
                title={
                  s.samples
                    ? `${s.upDays}↑ ${s.downDays}↓ ${s.flatDays}→ / ${s.samples} ngày`
                    : 'Chưa đủ dữ liệu'
                }
              >
                <span className="weekday-stat__day">{s.label}</span>
                <strong className="weekday-stat__pct">
                  {s.avgPct == null ? '—' : formatPct(s.avgPct)}
                </strong>
                <span className="weekday-stat__meta muted">
                  {s.samples
                    ? `${s.upDays}↑ ${s.downDays}↓`
                    : 'n/a'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
