import { type CtjTick, type ProductId } from './ctj';
import { formatSignedVnd, formatVnd } from './format';
import type { Settings } from './storage';

export type NotifyPermission = NotificationPermission | 'unsupported';

const SW_URL = '/sw.js';
let swReady: Promise<ServiceWorkerRegistration | null> | null = null;

export class PushServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PushServiceUnavailableError';
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Chrome rejects Uint8Array views; pass a detached ArrayBuffer copy. */
function vapidKeyToBuffer(base64String: string): ArrayBuffer {
  const bytes = urlBase64ToUint8Array(base64String.trim());
  if (bytes.length !== 65 || bytes[0] !== 0x04) {
    throw new Error('VAPID public key không hợp lệ');
  }
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function wrapSubscribeError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (/push service error|Registration failed|AbortError/i.test(msg)) {
    return new PushServiceUnavailableError(
      'Web Push không đăng ký được (push service). Chromium/Brave trên Linux thường thiếu Google FCM — dùng Google Chrome hoặc Firefox. Brave: bật “Use Google services for push messaging”.',
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

export function getNotifyPermission(): NotifyPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/** Đăng ký SW và đợi active — subscribe() sẽ fail nếu SW còn installing. */
export function ensureNotifyServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }
  if (!swReady) {
    swReady = (async () => {
      try {
        await navigator.serviceWorker.register(SW_URL, {
          updateViaCache: 'none',
        });
        return await navigator.serviceWorker.ready;
      } catch {
        return null;
      }
    })();
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
    // fall through
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
  const buyArrow = buyDiff > 0 ? '↑' : buyDiff < 0 ? '↓' : '→';

  return {
    title: `Giá bạc ${next.id} ${buyArrow}`,
    body: [
      `Mua: ${formatVnd(next.buyprice)} (${formatSignedVnd(buyDiff)})`,
      `Bán: ${formatVnd(next.sellprice)} (${formatSignedVnd(next.sellprice - prev.sellprice)})`,
    ].join('\n'),
  };
}

export async function notifyPriceChange(prev: CtjTick, next: CtjTick): Promise<void> {
  await showBrowserNotification(buildPriceNotifyPayload(prev, next));
}

/** Gửi 1 noti thử ngay sau khi user bật. */
export async function notifyTest(localOnly = false): Promise<void> {
  await showBrowserNotification({
    title: 'Bạc Phú Quý Tracker — đã bật thông báo',
    body: localOnly
      ? 'Trình duyệt không đăng ký được Web Push. Sẽ báo khi tab đang mở và giá đổi.'
      : 'Server sẽ đẩy Web Push khi giá mua/bán đổi (kể cả khi đóng tab).',
  });
}

export async function hasPushSubscription(): Promise<boolean> {
  const reg = await ensureNotifyServiceWorker();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return Boolean(sub);
}

export function tickFingerprint(tick: CtjTick): string {
  return `${tick.id}|${tick.buyprice}|${tick.sellprice}|${tick.last_update}`;
}

export function supportsWebPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch('/api/vapid-public-key', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Server chưa cấu hình VAPID');
  }
  const data = (await res.json()) as { publicKey?: string };
  if (!data.publicKey) throw new Error('Thiếu VAPID public key');
  return data.publicKey;
}

/** Đăng ký PushManager + gửi subscription lên server. Web Push chỉ báo 1L. */
export async function subscribeWebPush(
  productIds: ProductId[] = ['BPQ1L'],
  thresholdOpts?: Pick<Settings, 'thresholdEnabled' | 'minBuy' | 'maxSell'>,
): Promise<PushSubscription> {
  if (!supportsWebPush()) {
    throw new Error('Trình duyệt không hỗ trợ Web Push');
  }
  const perm = await requestNotifyPermission();
  if (perm !== 'granted') {
    throw new Error('Chưa được phép thông báo');
  }

  const reg = await ensureNotifyServiceWorker();
  if (!reg) throw new Error('Không đăng ký được Service Worker');

  const vapidKey = await fetchVapidPublicKey();
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    try {
      await existing.unsubscribe();
    } catch {
      // stale / other VAPID key
    }
  }

  const applicationServerKey = vapidKeyToBuffer(vapidKey);
  let sub: PushSubscription;
  try {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  } catch (err) {
    throw wrapSubscribeError(err);
  }

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      productIds,
      thresholdEnabled: thresholdOpts?.thresholdEnabled ?? false,
      minBuy: thresholdOpts?.minBuy ?? null,
      maxSell: thresholdOpts?.maxSell ?? null,
    }),
  });
  if (!res.ok) {
    throw new Error('Không lưu được subscription trên server');
  }
  return sub;
}

/** Re-upsert thresholds on existing push subscription without re-subscribing. */
export async function updatePushThresholds(
  settings: Pick<Settings, 'thresholdEnabled' | 'minBuy' | 'maxSell'>,
): Promise<void> {
  const reg = await ensureNotifyServiceWorker();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      productIds: ['BPQ1L'],
      thresholdEnabled: settings.thresholdEnabled,
      minBuy: settings.minBuy,
      maxSell: settings.maxSell,
    }),
  });
}

export async function unsubscribeWebPush(): Promise<void> {
  const reg = await ensureNotifyServiceWorker();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  const endpoint = sub?.endpoint;

  if (endpoint) {
    try {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
    } catch {
      // ignore network errors on unsubscribe
    }
  }

  if (sub) {
    try {
      await sub.unsubscribe();
    } catch {
      // already gone
    }
  }
}
