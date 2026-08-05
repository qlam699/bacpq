import { useState, type FormEvent } from 'react';
import type { ProductId } from '../lib/ctj';
import { formatDateTimeLocal, localInputToIso } from '../lib/format';

type Props = {
  productId: ProductId;
  onAdd: (input: {
    productId: ProductId;
    buyPrice: number;
    quantity: number;
    boughtAt: string;
    note?: string;
  }) => void;
};

function parseVndInput(raw: string): number {
  // Accept "2.264.000" or "2264000" or "2,264,000"
  const cleaned = raw.replace(/[.\s,]/g, '').trim();
  return Number(cleaned);
}

export function PositionForm({ productId, onAdd }: Props) {
  const [buyPrice, setBuyPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [boughtAt, setBoughtAt] = useState(() =>
    formatDateTimeLocal(new Date().toISOString()),
  );
  const [note, setNote] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const priceNum = parseVndInput(buyPrice);
    const qty = Number(quantity);
    if (!Number.isFinite(priceNum) || priceNum <= 0) return;
    if (!Number.isFinite(qty) || qty <= 0) return;

    onAdd({
      productId,
      buyPrice: priceNum,
      quantity: qty,
      boughtAt: localInputToIso(boughtAt),
      note: note.trim() || undefined,
    });
    setBuyPrice('');
    setQuantity('1');
    setNote('');
    setBoughtAt(formatDateTimeLocal(new Date().toISOString()));
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Thêm bạc</h2>
      </div>
      <form className="position-form" onSubmit={handleSubmit}>
        <label>
          Giá mua
          <input
            inputMode="numeric"
            placeholder="2264000"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            required
          />
        </label>
        <label>
          Số lượng
          <input
            type="number"
            min="0.01"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </label>
        <label>
          Thời điểm mua (ghi chú)
          <input
            type="datetime-local"
            value={boughtAt}
            onChange={(e) => setBoughtAt(e.target.value)}
            required
          />
        </label>
        <label>
          Ghi chú
          <input
            placeholder="tuỳ chọn"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button type="submit" className="btn primary">
          Thêm
        </button>
      </form>
    </section>
  );
}
