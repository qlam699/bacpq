import { useEffect, useRef, useState } from 'react';
import { latestTick, type CtjTick } from '../lib/ctj';
import type { Settings } from '../lib/storage';
import {
  ensureNotifyServiceWorker,
  getNotifyPermission,
  hasPushSubscription,
  notifyPriceChange,
  tickFingerprint,
  type NotifyPermission,
} from '../lib/notify';

function meetsThreshold(settings: Settings, tick: CtjTick): boolean {
  if (!settings.thresholdEnabled) return true;
  if (settings.minBuy == null && settings.maxSell == null) return true;
  const buyHit = settings.minBuy != null && tick.buyprice >= settings.minBuy;
  const sellHit = settings.maxSell != null && tick.sellprice <= settings.maxSell;
  return buyHit || sellHit;
}

/**
 * Flash title khi tab ẩn.
 * Local notification chỉ khi chưa có Web Push (tránh double với server).
 */
export function usePriceNotify(ticks: CtjTick[], settings: Settings) {
  const prevRef = useRef<CtjTick | null>(null);
  const primedProductRef = useRef<string | null>(null);
  const latestTickRef = useRef<CtjTick | null>(null);
  const titleRestoreRef = useRef<(() => void) | null>(null);
  const titleTimeoutRef = useRef<number | null>(null);
  const [permission, setPermission] = useState<NotifyPermission>(() =>
    getNotifyPermission(),
  );

  latestTickRef.current = latestTick(ticks);
  const enabled = settings.notifyOnChange;

  useEffect(() => {
    void ensureNotifyServiceWorker();
  }, []);

  useEffect(() => {
    setPermission(getNotifyPermission());
  }, [enabled]);

  useEffect(() => () => {
    if (titleRestoreRef.current) {
      document.removeEventListener('visibilitychange', titleRestoreRef.current);
    }
    if (titleTimeoutRef.current != null) {
      window.clearTimeout(titleTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const next = latestTick(ticks);
    if (!next) return;

    if (primedProductRef.current !== next.id) {
      primedProductRef.current = next.id;
      prevRef.current = next;
      return;
    }

    const prev = prevRef.current;
    prevRef.current = next;
    if (!prev) return;

    if (tickFingerprint(prev) === tickFingerprint(next)) return;
    if (prev.buyprice === next.buyprice && prev.sellprice === next.sellprice) {
      return;
    }
    if (!enabled) return;

    void (async () => {
      if (await hasPushSubscription()) return;
      if (!meetsThreshold(settings, next)) return;
      await notifyPriceChange(prev, next);
    })();

    if (document.visibilityState === 'hidden') {
      const buyDiff = next.buyprice - prev.buyprice;
      const arrow = buyDiff > 0 ? '↑' : buyDiff < 0 ? '↓' : '→';
      if (titleRestoreRef.current) {
        document.removeEventListener('visibilitychange', titleRestoreRef.current);
      }
      if (titleTimeoutRef.current != null) {
        window.clearTimeout(titleTimeoutRef.current);
      }
      document.title = `${arrow} ${next.buyprice.toLocaleString('vi-VN')}₫ · CTJ`;
      const restore = () => {
        const current = latestTickRef.current;
        if (current) {
          document.title = `${current.sellprice.toLocaleString('vi-VN')}₫ - ${current.buyprice.toLocaleString('vi-VN')}₫`;
        }
        document.removeEventListener('visibilitychange', onVis);
        titleRestoreRef.current = null;
        titleTimeoutRef.current = null;
      };
      const onVis = () => {
        if (document.visibilityState === 'visible') restore();
      };
      titleRestoreRef.current = onVis;
      document.addEventListener('visibilitychange', onVis);
      titleTimeoutRef.current = window.setTimeout(restore, 8000);
    }
  }, [ticks, enabled, settings.thresholdEnabled, settings.minBuy, settings.maxSell]);

  return {
    permission,
    refreshPermission: () => setPermission(getNotifyPermission()),
  };
}
