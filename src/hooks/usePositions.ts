import { useMemo, useState } from 'react';
import { downloadText } from '../lib/download';
import type { ProductId } from '../lib/ctj';
import {
  addPosition,
  exportPositionsJson,
  importPositionsJson,
  loadPositions,
  removePosition,
  type Position,
} from '../lib/storage';

export function usePositions(productId: ProductId) {
  const [positions, setPositions] = useState<Position[]>(() => loadPositions());

  const visiblePositions = useMemo(
    () => positions.filter((p) => p.productId === productId),
    [positions, productId],
  );

  function add(input: Omit<Position, 'id'>) {
    setPositions(addPosition(input));
  }

  function remove(id: string) {
    setPositions(removePosition(id));
  }

  function exportAll() {
    downloadText(
      `bacpq-positions-${new Date().toISOString().slice(0, 10)}.json`,
      exportPositionsJson(positions),
    );
  }

  async function importFile(file: File) {
    try {
      const text = await file.text();
      setPositions(importPositionsJson(text));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Import thất bại');
    }
  }

  return { visiblePositions, add, remove, exportAll, importFile };
}
