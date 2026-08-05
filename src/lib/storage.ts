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
};

const POSITIONS_KEY = 'bacpq:positions';
const SETTINGS_KEY = 'bacpq:settings';

const DEFAULT_SETTINGS: Settings = {
  productId: 'BPQ1L',
  pollMs: 10_000,
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
  return JSON.stringify(positions, null, 2);
}

export function importPositionsJson(raw: string): Position[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('JSON phải là mảng positions');
  const positions: Position[] = parsed.map((item, i) => {
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
  savePositions(positions);
  return positions;
}
