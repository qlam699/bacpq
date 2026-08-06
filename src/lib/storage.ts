import type { ProductId } from './ctj';

export type Position = {
  id: string;
  productId: ProductId;
  buyPrice: number;
  quantity: number;
  boughtAt: string;
  note?: string;
};

export type Settings = {
  productId: ProductId;
  pollMs: number;
  /** Bật thông báo khi giá mua/bán thay đổi */
  notifyOnChange: boolean;
};

const POSITIONS_KEY = 'bacpq:positions';
const SETTINGS_KEY = 'bacpq:setting';

const DEFAULT_SETTINGS: Settings = {
  productId: 'BPQ1L',
  pollMs: 3_000,
  notifyOnChange: false,
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadPositions(): Position[] {
  const list = readJson<Position[]>(POSITIONS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function savePositions(positions: Position[]): void {
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
}

export function addPosition(
  input: Omit<Position, 'id'>,
): Position[] {
  const positions = loadPositions();
  const next: Position = { ...input, id: crypto.randomUUID() };
  const updated = [...positions, next];
  savePositions(updated);
  return updated;
}

export function removePosition(id: string): Position[] {
  const updated = loadPositions().filter((p) => p.id !== id);
  savePositions(updated);
  return updated;
}

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...readJson<Partial<Settings>>(SETTINGS_KEY, {}) };
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function exportPositionsJson(positions: Position[]): string {
  return serializePositions(positions);
}

export function serializePositions(positions: Position[]): string {
  return JSON.stringify(positions, null, 2);
}

/** Parse JSON positions — không ghi storage. */
export function parsePositionsJson(raw: string): Position[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('JSON phải là mảng positions');
  return parsed.map((item, i) => {
    const p = item as Partial<Position>;
    if (
      typeof p.buyPrice !== 'number' ||
      typeof p.quantity !== 'number' ||
      typeof p.boughtAt !== 'string'
    ) {
      throw new Error(`Position #${i} thiếu field bắt buộc`);
    }
    return {
      id: typeof p.id === 'string' ? p.id : crypto.randomUUID(),
      productId: (p.productId as ProductId) || 'BPQ1L',
      buyPrice: p.buyPrice,
      quantity: p.quantity,
      boughtAt: p.boughtAt,
      note: p.note,
    };
  });
}

export function importPositionsJson(raw: string): Position[] {
  const positions = parsePositionsJson(raw);
  savePositions(positions);
  return positions;
}
