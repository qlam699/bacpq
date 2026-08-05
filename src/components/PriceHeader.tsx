import { dayExtremes, type CtjTick } from '../lib/ctj';
import { formatPct, formatSignedVnd, formatTime, formatVnd } from '../lib/format';

type Props = {
  tick: CtjTick | null;
  ticks: CtjTick[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

export function PriceHeader({ tick, ticks, loading, error, onRefresh }: Props) {
  if (error && !tick) {
    return (
      <header className="price-header error">
        <p>{error}</p>
        <button type="button" onClick={onRefresh}>
          Thử lại
        </button>
      </header>
    );
  }

  if (!tick) {
    return (
      <header className="price-header">
        <p className="muted">{loading ? 'Đang tải giá…' : 'Chưa có dữ liệu'}</p>
      </header>
    );
  }

  const buyUp = tick.change_buy >= 0;
  const sellUp = tick.change_sell >= 0;
  const extremes = dayExtremes(ticks);

  return (
    <header className="price-header">
      <div className="price-header__top">
        <div>
          <p className="eyebrow">CTJ · {tick.id}</p>
          <h2>{tick.name}</h2>
          <p className="muted">
            Cập nhật {formatTime(tick.last_update)} · {tick.UnitName}
            {loading ? ' · đang làm mới…' : ''}
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={onRefresh} disabled={loading}>
          Làm mới
        </button>
      </div>

      <div className="price-cards">
        <div className="price-card">
          <span className="label">Mua vào</span>
          <strong>{formatVnd(tick.buyprice)}</strong>
          <span className={buyUp ? 'up' : 'down'}>
            {formatSignedVnd(tick.change_buy)} ({formatPct((tick.change_buy / (tick.buyprice - tick.change_buy || tick.buyprice)) * 100)})
          </span>
          {extremes ? (
            <div className="extremes">
              <p className="muted">
                Min: {formatVnd(extremes.minBuy.buyprice)} -{' '}
                {formatTime(extremes.minBuy.last_update)}
              </p>
              <p className="muted">
                Max: {formatVnd(extremes.maxBuy.buyprice)} -{' '}
                {formatTime(extremes.maxBuy.last_update)}
              </p>
            </div>
          ) : null}
        </div>
        <div className="price-card">
          <span className="label">Bán ra</span>
          <strong>{formatVnd(tick.sellprice)}</strong>
          <span className={sellUp ? 'up' : 'down'}>
            {formatSignedVnd(tick.change_sell)}
          </span>
          {extremes ? (
            <div className="extremes">
              <p className="muted">
                Min: {formatVnd(extremes.minSell.sellprice)} -{' '}
                {formatTime(extremes.minSell.last_update)}
              </p>
              <p className="muted">
                Max: {formatVnd(extremes.maxSell.sellprice)} -{' '}
                {formatTime(extremes.maxSell.last_update)}
              </p>
            </div>
          ) : null}
        </div>
        <div className="price-card accent">
          <span className="label">Spread</span>
          <strong>{formatVnd(tick.sellprice - tick.buyprice)}</strong>
          <span className="muted">bán − mua</span>
        </div>
      </div>
      {error ? <p className="inline-error">{error}</p> : null}
    </header>
  );
}
