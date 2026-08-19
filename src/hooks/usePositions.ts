import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { downloadText } from '../lib/download';
import type { ProductId } from '../lib/ctj';
import {
  loadPositionsFromGist,
  savePositionsToGist,
} from '../lib/gistPositions';
import {
  exportPositionsJson,
  loadPositions,
  parsePositionsJson,
  savePositions,
  type Position,
} from '../lib/storage';

type Auth = { token: string | null };
type SetGist = (token: string | null, gistId: string | null) => void;

export function usePositions(productId: ProductId, auth: Auth, setGist?: SetGist) {
  const [positions, setPositions] = useState<Position[]>(() => loadPositions());
  const [storage, setStorage] = useState<'local' | 'gist'>('local');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const gistIdRef = useRef<string | null>(null);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const persist = useCallback(
    async (next: Position[]) => {
      setPositions(next);
      const token = auth.token;
      const gistId = gistIdRef.current;
      if (token && gistId) {
        setSyncing(true);
        setSyncError(null);
        try {
          await savePositionsToGist(token, gistId, next);
          setStorage('gist');
        } catch (e) {
          setSyncError(e instanceof Error ? e.message : 'Lưu gist thất bại');
          // Fallback local để không mất data trên máy
          savePositions(next);
        } finally {
          setSyncing(false);
        }
      } else {
        savePositions(next);
        setStorage('local');
      }
    },
    [auth.token],
  );

  // Khi login/logout: chuyển nguồn lưu
  useEffect(() => {
    const token = auth.token;
    if (!token) {
      gistIdRef.current = null;
      setStorage('local');
      setPositions(loadPositions());
      setSyncError(null);
      setGist?.(null, null);
      return;
    }

    let cancelled = false;
    setSyncing(true);
    setSyncError(null);
    void (async () => {
      try {
        const seed = loadPositions();
        const { gistId, positions: remote } = await loadPositionsFromGist(
          token,
          seed,
        );
        if (cancelled) return;
        gistIdRef.current = gistId;
        setPositions(remote);
        setStorage('gist');
        setGist?.(token, gistId);
        // Giữ bản local mirror để khi logout vẫn còn data
        savePositions(remote);
      } catch (e) {
        if (cancelled) return;
        setSyncError(
          e instanceof Error ? e.message : 'Không tải được gist',
        );
        setStorage('local');
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.token]);

  const visiblePositions = useMemo(
    () => positions.filter((p) => p.productId === productId),
    [positions, productId],
  );

  async function add(input: Omit<Position, 'id'>) {
    const next: Position = { ...input, id: crypto.randomUUID() };
    await persist([...positionsRef.current, next]);
  }

  async function remove(id: string) {
    await persist(positionsRef.current.filter((p) => p.id !== id));
  }

  function exportAll() {
    downloadText(
      `bacpq-positions-${new Date().toISOString().slice(0, 10)}.json`,
      exportPositionsJson(positionsRef.current),
    );
  }

  async function importFile(file: File) {
    try {
      const text = await file.text();
      const next = parsePositionsJson(text);
      await persist(next);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Import thất bại');
    }
  }

  return {
    visiblePositions,
    add,
    remove,
    exportAll,
    importFile,
    storage,
    syncing,
    syncError,
    gistId: gistIdRef.current,
  };
}
