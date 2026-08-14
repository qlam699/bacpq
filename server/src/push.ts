import webpush from 'web-push';
import type { CtjTick } from './ctj.js';
import {
  listSubscriptionsForProduct,
  removeSubscription,
} from './subscriptions.js';

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + '₫';
}

function formatSignedVnd(n: number): string {
  const sign = n > 0 ? '+' : '';
  return sign + formatVnd(n);
}

export function configureWebPush(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@localhost';
  if (!publicKey || !privateKey) {
    console.warn('[push] VAPID keys missing — Web Push disabled');
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export function buildPriceNotifyPayload(prev: CtjTick, next: CtjTick) {
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

let pushEnabled = false;

export function setPushEnabled(enabled: boolean): void {
  pushEnabled = enabled;
}

export async function notifyPriceChangePush(
  prev: CtjTick,
  next: CtjTick,
): Promise<void> {
  if (!pushEnabled) return;
  const payload = JSON.stringify({
    ...buildPriceNotifyPayload(prev, next),
    tag: 'bacpq-price',
  });
  const subs = await listSubscriptionsForProduct(next.id);
  await Promise.all(
    subs.map(async (stored) => {
      try {
        await webpush.sendNotification(stored.subscription, payload);
      } catch (err: unknown) {
        const status =
          err && typeof err === 'object' && 'statusCode' in err
            ? Number((err as { statusCode: number }).statusCode)
            : 0;
        if (status === 404 || status === 410) {
          await removeSubscription(stored.endpoint);
        } else {
          console.warn('[push] send failed', stored.endpoint.slice(0, 48), err);
        }
      }
    }),
  );
}
