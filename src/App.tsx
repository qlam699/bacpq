import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchTodayPrices,
  latestTick,
  PRODUCTS,
  type CtjTick,
  type ProductId,
} from './lib/ctj';
import {
  addPosition,
  exportPositionsJson,
  importPositionsJson,
  loadPositions,
  loadSettings,
  removePosition,
  saveSettings,
  type Position,
  type Settings,
} from './lib/storage';
import { PriceHeader } from './components/PriceHeader';
import { PriceChart } from './components/PriceChart';
import { PositionForm } from './components/PositionForm';
import { PositionTable } from './components/PositionTable';
import './App.css';

function usePricePoll(productId: ProductId, pollMs: number) {
  const [ticks, setTicks] = useState<CtjTick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTodayPrices(productId);
      setTicks(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lấy được giá');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), pollMs);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh, pollMs]);

  return { ticks, loading, error, refresh };
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [positions, setPositions] = useState<Position[]>(() => loadPositions());
  const { ticks, loading, error, refresh } = usePricePoll(
    settings.productId,
    settings.pollMs,
  );

  const tick = useMemo(() => latestTick(ticks), [ticks]);
  const currentBuy = tick?.buyprice ?? null;

  const visiblePositions = useMemo(
    () => positions.filter((p) => p.productId === settings.productId),
    [positions, settings.productId],
  );

  function updateSettings(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  }

  function handleAdd(input: Omit<Position, 'id'>) {
    setPositions(addPosition(input));
  }

  function handleRemove(id: string) {
    setPositions(removePosition(id));
  }

  function handleExport() {
    const blob = new Blob([exportPositionsJson(positions)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bacpq-positions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      setPositions(importPositionsJson(text));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Import thất bại');
    }
  }

  return (
    <div className="app">
      <div className="toolbar">
        <div className="brand">
          <span className="brand__mark">Bạc Tracker</span>
          <span className="brand__name">QLam</span>
        </div>
        <label className="product-select">
          Sản phẩm
          <select
            value={settings.productId}
            onChange={(e) =>
              updateSettings({ productId: e.target.value as ProductId })
            }
          >
            {PRODUCTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <PriceHeader
        tick={tick}
        ticks={ticks}
        loading={loading}
        error={error}
        onRefresh={() => void refresh()}
      />

      <PriceChart
        ticks={ticks}
        positions={visiblePositions}
        currentBuy={currentBuy}
      />

      <div className="grid-2">
        <PositionForm productId={settings.productId} onAdd={handleAdd} />
        <PositionTable
          positions={visiblePositions}
          currentBuy={currentBuy}
          onRemove={handleRemove}
          onExport={handleExport}
          onImport={(f) => void handleImport(f)}
        />
      </div>

      <footer className="footer">
        QLam
      </footer>
    </div>
  );
}
