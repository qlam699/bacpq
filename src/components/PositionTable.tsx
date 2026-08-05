import type { Position } from '../lib/storage';
import { calcPositionPnl, portfolioStats } from '../lib/pnl';
import { formatDateTime, formatPct, formatSignedVnd, formatVnd } from '../lib/format';

type Props = {
  positions: Position[];
  currentBuy: number | null;
  onRemove: (id: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
};

export function PositionTable({
  positions,
  currentBuy,
  onRemove,
  onExport,
  onImport,
}: Props) {
  const stats = portfolioStats(positions, currentBuy);

  return (
    <section className="panel">
      <div className="panel__head row">
        <div>
          <h2>Danh mục</h2>
          <p className="muted">PnL theo giá mua vào của shop (mark-to-market)</p>
        </div>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onExport}>
            Export JSON
          </button>
          <label className="btn ghost file-btn">
            Import
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {positions.length === 0 ? (
        <p className="muted">Chưa có dữ liệu. Thêm giá mua để theo dõi chênh lệch.</p>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mua lúc</th>
                  <th>Giá mua</th>
                  <th>SL</th>
                  <th>Giá hiện tại</th>
                  <th>Chênh / ĐV</th>
                  <th>%</th>
                  <th>PnL</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const pnl =
                    currentBuy == null
                      ? null
                      : calcPositionPnl(p.buyPrice, p.quantity, currentBuy);
                  return (
                    <tr key={p.id}>
                      <td>
                        {formatDateTime(p.boughtAt)}
                        {p.note ? (
                          <span className="note"> · {p.note}</span>
                        ) : null}
                      </td>
                      <td>{formatVnd(p.buyPrice)}</td>
                      <td>{p.quantity}</td>
                      <td>{currentBuy == null ? '—' : formatVnd(currentBuy)}</td>
                      <td className={pnl && pnl.diff >= 0 ? 'up' : 'down'}>
                        {pnl ? formatSignedVnd(pnl.diff) : '—'}
                      </td>
                      <td className={pnl && pnl.diffPct >= 0 ? 'up' : 'down'}>
                        {pnl ? formatPct(pnl.diffPct) : '—'}
                      </td>
                      <td className={pnl && pnl.pnl >= 0 ? 'up' : 'down'}>
                        {pnl ? formatSignedVnd(pnl.pnl) : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn danger ghost"
                          onClick={() => onRemove(p.id)}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="summary">
            <div>
              <span className="label">Tổng SL</span>
              <strong>{stats.totalQty}</strong>
            </div>
            <div>
              <span className="label">Giá vốn TB</span>
              <strong>{formatVnd(stats.avgCost)}</strong>
            </div>
            <div>
              <span className="label">Tổng PnL</span>
              <strong className={stats.totalPnl >= 0 ? 'up' : 'down'}>
                {formatSignedVnd(stats.totalPnl)}
              </strong>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
