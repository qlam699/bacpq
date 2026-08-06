import type { CtjTick } from './ctj';
import { formatSignedVnd, formatVnd } from './format';

export type NotifyPermission = NotificationPermission | 'unsupported';

const SW_URL = '/sw.js';
let swReady: Promise<ServiceWorkerRegistration | null> | null = null;

export function getNotifyPermission(): NotifyPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/** Đăng ký SW một lần — giúp noti hiện ổn khi tab ẩn. */
export function ensureNotifyServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }
  if (!swReady) {
    swReady = navigator.serviceWorker
      .register(SW_URL)
      .then((reg) => reg)
      .catch(() => null);
  }
  return swReady;
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  await ensureNotifyServiceWorker();
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const perm = await Notification.requestPermission();
  return perm;
}

type NotifyPayload = {
  title: string;
  body: string;
};

async function showBrowserNotification({ title, body }: NotifyPayload): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const reg = await ensureNotifyServiceWorker();
  const options = {
    body,
    tag: 'bacpq-price',
    renotify: true,
    silent: false,
    requireInteraction: false,
  } as NotificationOptions;

  try {
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    // fall through to Notification constructor
  }

  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // insecure context / browser block
  }
}

export function buildPriceNotifyPayload(prev: CtjTick, next: CtjTick): NotifyPayload {
  const buyDiff = next.buyprice - prev.buyprice;
  const sellDiff = next.sellprice - prev.sellprice;
  const buyArrow = buyDiff > 0 ? '↑' : buyDiff < 0 ? '↓' : '→';

  return {
    title: `Giá bạc ${next.id} ${buyArrow}`,
    body: [
      `Mua: ${formatVnd(next.buyprice)} (${formatSignedVnd(buyDiff)})`,
      `Bán: ${formatVnd(next.sellprice)} (${formatSignedVnd(sellDiff)})`,
    ].join('\n'),
  };
}

export async function notifyPriceChange(prev: CtjTick, next: CtjTick): Promise<void> {
  await showBrowserNotification(buildPriceNotifyPayload(prev, next));
}

/** Gửi 1 noti thử ngay sau khi user bật. */
export async function notifyTest(): Promise<void> {
  await showBrowserNotification({
    title: 'Bạc Phú Quý Tracker — đã bật thông báo',
    body: 'Bạn sẽ nhận thông báo của browser khi giá mua/bán đổi.',
  });
}

export function tickFingerprint(tick: CtjTick): string {
  return `${tick.id}|${tick.buyprice}|${tick.sellprice}|${tick.last_update}`;
}
