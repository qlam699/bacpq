import { useMemo } from 'react';
import { latestTick } from './lib/ctj';
import { useGithubAuth } from './hooks/useGithubAuth';
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
  const github = useGithubAuth();
  const {
    visiblePositions,
    add,
    remove,
    exportAll,
    importFile,
    storage,
    syncing,
    syncError,
  } = usePositions(settings.productId, github);
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
          githubUser={github.user}
          githubStorage={storage}
          githubSyncing={syncing}
          onGithubLogin={github.login}
          onGithubLogout={github.logout}
        />

        <PriceChart
          ticks={ticks}
          positions={visiblePositions}
          currentBuy={currentBuy}
        />
      </div>

      <div className="app__secondary">
        {syncError ? (
          <p className="inline-error sync-banner">{syncError}</p>
        ) : null}
        <div className="grid-2">
          <PositionForm
            productId={settings.productId}
            onAdd={(input) => void add(input)}
          />
          <PositionTable
            positions={visiblePositions}
            currentBuy={currentBuy}
            onRemove={(id) => void remove(id)}
            onExport={exportAll}
            onImport={(f) => void importFile(f)}
            storageLabel={storage === 'gist' ? 'GitHub Gist' : 'Máy này'}
          />
        </div>
        <footer className="footer">Bạc Phú Quý Tracker - QLam</footer>
      </div>
    </div>
  );
}
