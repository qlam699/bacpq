import { useMemo } from 'react';
import { latestTick, PRODUCTS, type ProductId } from './lib/ctj';
import { usePricePoll } from './hooks/usePricePoll';
import { usePositions } from './hooks/usePositions';
import { useSettings } from './hooks/useSettings';
import { PriceHeader } from './components/PriceHeader';
import { PriceChart } from './components/PriceChart';
import { PositionForm } from './components/PositionForm';
import { PositionTable } from './components/PositionTable';
import './App.css';

export default function App() {
  const { settings, updateSettings } = useSettings();
  const { visiblePositions, add, remove, exportAll, importFile } = usePositions(
    settings.productId,
  );
  const { ticks, loading, error, refresh } = usePricePoll(
    settings.productId,
    settings.pollMs,
  );

  const tick = useMemo(() => latestTick(ticks), [ticks]);
  const currentBuy = tick?.buyprice ?? null;

  return (
    <div className="app">
      <div className="app__primary">
        <PriceHeader
          tick={tick}
          settings={settings}
          updateSettings={updateSettings}
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
      </div>

      <div className="app__secondary">
        <div className="grid-2">
          <PositionForm productId={settings.productId} onAdd={add} />
          <PositionTable
            positions={visiblePositions}
            currentBuy={currentBuy}
            onRemove={remove}
            onExport={exportAll}
            onImport={(f) => void importFile(f)}
          />
        </div>
        <footer className="footer">Bạc Phú Quý Tracker - QLam</footer>
      </div>
    </div>
  );
}
