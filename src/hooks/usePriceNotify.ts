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
  const [permission, setPermission] = useState<NotifyPermission>(() =>
    getNotifyPermission(),
  );

  const enabled = settings.notifyOnChange;

  useEffect(() => {
    void ensureNotifyServiceWorker();
  }, []);

  useEffect(() => {
    setPermission(getNotifyPermission());
  }, [enabled]);

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
      const original = document.title;
      document.title = `${arrow} ${next.buyprice.toLocaleString('vi-VN')}₫ · CTJ`;
      const restore = () => {
        document.title = original;
        document.removeEventListener('visibilitychange', onVis);
      };
      const onVis = () => {
        if (document.visibilityState === 'visible') restore();
      };
      document.addEventListener('visibilitychange', onVis);
      window.setTimeout(restore, 8000);
    }
  }, [ticks, enabled, settings.thresholdEnabled, settings.minBuy, settings.maxSell]);

  return {
    permission,
    refreshPermission: () => setPermission(getNotifyPermission()),
  };
}
