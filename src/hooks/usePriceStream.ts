import { useCallback, useEffect, useRef, useState } from 'react';
import type { CtjTick, ProductId } from '../lib/ctj';
import { fetchPricesOnce } from '../lib/pricesApi';

/**
 * Live ticks via Server-Sent Events from our backend (sole CTJ poller).
 */
export function usePriceStream(productId: ProductId) {
  const [ticks, setTicks] = useState<CtjTick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const applySnapshot = useCallback((data: CtjTick[]) => {
    setTicks(data);
    setError(null);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPricesOnce(productId);
      applySnapshot(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lấy được giá');
      setLoading(false);
    }
  }, [productId, applySnapshot]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;

    function connect() {
      if (cancelled) return;
      esRef.current?.close();
      setLoading(true);

      const es = new EventSource(
        `/api/prices/stream?productId=${encodeURIComponent(productId)}`,
      );
      esRef.current = es;

      es.addEventListener('snapshot', (ev) => {
        if (cancelled) return;
        try {
          const data = JSON.parse((ev as MessageEvent).data) as CtjTick[];
          if (!Array.isArray(data)) throw new Error('Bad snapshot');
          applySnapshot(data);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Lỗi SSE snapshot');
          setLoading(false);
        }
      });

      es.onerror = () => {
        if (cancelled) return;
        es.close();
        esRef.current = null;
        setError((prev) => prev ?? 'Mất kết nối SSE — đang thử lại…');
        retryTimer = window.setTimeout(connect, 3_000);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [productId, applySnapshot]);

  return { ticks, loading, error, refresh };
}
