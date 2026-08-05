import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTodayPrices, type CtjTick, type ProductId } from '../lib/ctj';
import {
  isVnPollWindow,
  msUntilVnMinutes,
  POLL_END_MIN,
  POLL_START_MIN,
} from '../lib/vnTime';

export function usePricePoll(productId: ProductId, pollMs: number) {
  const [ticks, setTicks] = useState<CtjTick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (inflight.current) return;
    inflight.current = true;
    if (!opts?.silent) setLoading(true);
    try {
      const data = await fetchTodayPrices(productId);
      setTicks(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lấy được giá');
    } finally {
      inflight.current = false;
      if (!opts?.silent) setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    let intervalId: number | undefined;
    let timeoutId: number | undefined;
    let cancelled = false;

    function clearTimers() {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    }

    function arm() {
      if (cancelled) return;
      clearTimers();

      if (isVnPollWindow()) {
        intervalId = window.setInterval(() => {
          if (!isVnPollWindow()) {
            arm();
            return;
          }
          void refresh({ silent: true });
        }, pollMs);
        // Re-evaluate at 18:30 VN (interval alone can drift after sleep).
        timeoutId = window.setTimeout(arm, msUntilVnMinutes(POLL_END_MIN));
      } else {
        timeoutId = window.setTimeout(() => {
          void refresh({ silent: true });
          arm();
        }, msUntilVnMinutes(POLL_START_MIN));
      }
    }

    void refresh();
    arm();

    const onVisible = () => {
      if (document.visibilityState === 'visible' && isVnPollWindow()) {
        void refresh({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearTimers();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, pollMs]);

  return { ticks, loading, error, refresh };
}
