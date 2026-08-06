import { dayExtremes, PRODUCTS, type CtjTick, type ProductId } from '../lib/ctj';
import { formatPct, formatSignedVnd, formatTime, formatVnd } from '../lib/format';
import type { GithubUser } from '../lib/githubAuth';
import type { Settings } from '../lib/storage';
import { GithubAuthControls } from './GithubAuthControls';

type Props = {
  tick: CtjTick | null;
  ticks: CtjTick[];
  loading: boolean;
  error: string | null;
  settings: Settings;
  onRefresh: () => void;
  updateSettings: (path: Partial<Settings>) => void;
  githubUser: GithubUser | null;
  githubStorage?: 'local' | 'gist';
  githubSyncing?: boolean;
  onGithubLogin: (token: string) => Promise<void>;
  onGithubLogout: () => void;
};

export function PriceHeader({
  tick,
  ticks,
  loading,
  error,
  settings,
  onRefresh,
  updateSettings,
  githubUser,
  githubStorage,
  githubSyncing,
  onGithubLogin,
  onGithubLogout,
}: Props) {
  const actions = (
    <div className="header-actions">
      <GithubAuthControls
        user={githubUser}
        storage={githubStorage}
        syncing={githubSyncing}
        onLogin={onGithubLogin}
        onLogout={onGithubLogout}
      />
      {tick ? (
        <button
          type="button"
          className="btn ghost"
          onClick={onRefresh}
          disabled={loading}
        >
          Làm mới
        </button>
      ) : null}
    </div>
  );

  if (error && !tick) {
    return (
      <header className="price-header error">
        <div className="price-header__top">
          <p>{error}</p>
          {actions}
        </div>
        <button type="button" className="btn" onClick={onRefresh}>
          Thử lại
        </button>
      </header>
    );
  }

  if (!tick) {
    return (
      <header className="price-header">
        <div className="price-header__top">
          <p className="muted">{loading ? 'Đang tải giá…' : 'Chưa có dữ liệu'}</p>
          {actions}
        </div>
      </header>
    );
  }

  const buyUp = tick.change_buy >= 0;
  const sellUp = tick.change_sell >= 0;
  const extremes = dayExtremes(ticks);
  const buyBase = tick.buyprice - tick.change_buy || tick.buyprice;

  return (
    <header className="price-header">
      <div className="price-header__top">
        <label className="product-select">
          <span className="sr-only">Sản phẩm</span>
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

        <p className="muted price-header__time">
          Mới nhất vào: {formatTime(tick.last_update)}
          {loading ? ' · …' : ''}
        </p>

        {actions}
      </div>

      <div className="price-cards">
        <div className="price-card">
          <span className="label">Shop Mua vào</span>
          <p>
            <strong>{formatVnd(tick.buyprice)}&nbsp;&nbsp;</strong>
            <span className={`delta ${buyUp ? 'up' : 'down'}`}>
              {formatSignedVnd(tick.change_buy)} (
              {formatPct((tick.change_buy / buyBase) * 100)})
            </span>
          </p>

          {extremes ? (
            <div className="extremes">
              <p className="extremes__row muted">
                <span className="extremes__tag">Min</span>
                <b>{formatVnd(extremes.minBuy.buyprice)}</b>
                <span className="extremes__time">
                  {formatTime(extremes.minBuy.last_update)}
                </span>
              </p>
              <p className="extremes__row muted">
                <span className="extremes__tag">Max</span>
                <b>{formatVnd(extremes.maxBuy.buyprice)}</b>
                <span className="extremes__time">
                  {formatTime(extremes.maxBuy.last_update)}
                </span>
              </p>
            </div>
          ) : null}
        </div>
        <div className="price-card">
          <span className="label">Shop Bán ra</span>
          <p>
            <strong>{formatVnd(tick.sellprice)}&nbsp;&nbsp;</strong>
            <span className={`delta ${sellUp ? 'up' : 'down'}`}>
              {formatSignedVnd(tick.change_sell)}
            </span>
          </p>
          {extremes ? (
            <div className="extremes">
              <p className="extremes__row muted">
                <span className="extremes__tag">Min</span>
                <b>{formatVnd(extremes.minSell.sellprice)}</b>
                <span className="extremes__time">
                  {formatTime(extremes.minSell.last_update)}
                </span>
              </p>
              <p className="extremes__row muted">
                <span className="extremes__tag">Max</span>
                <b>{formatVnd(extremes.maxSell.sellprice)}</b>
                <span className="extremes__time">
                  {formatTime(extremes.maxSell.last_update)}
                </span>
              </p>
            </div>
          ) : null}
        </div>
        <div className="price-card accent">
          <span className="label">Spread</span>
          <strong>{formatVnd(tick.sellprice - tick.buyprice)}</strong>
          <span className="muted delta">bán − mua</span>
        </div>
      </div>
      {error ? <p className="inline-error">{error}</p> : null}
    </header>
  );
}
