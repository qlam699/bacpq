import {
  fetchTodayPrices,
  latestTick,
  priceFingerprint,
  ticksFingerprint,
  type CtjTick,
  type ProductId,
  PRODUCT_IDS,
} from './ctj.js';
import { notifyPriceChangePush } from './push.js';
import { broadcastSnapshot } from './sse.js';
import {
  isVnPollWindow,
  msUntilVnMinutes,
  POLL_END_MIN,
  POLL_START_MIN,
} from './vnTime.js';

const cache = new Map<ProductId, CtjTick[]>();
const lastPriceFp = new Map<ProductId, string>();
const lastSeriesFp = new Map<ProductId, string>();

export function getCachedPrices(productId: ProductId): CtjTick[] | null {
  return cache.get(productId) ?? null;
}

async function pollOne(productId: ProductId): Promise<void> {
  try {
    const ticks = await fetchTodayPrices(productId);
    const seriesFp = ticksFingerprint(ticks);
    const prevTicks = cache.get(productId) ?? null;
    const prevLatest = prevTicks ? latestTick(prevTicks) : null;
    const nextLatest = latestTick(ticks);
    const nextPriceFp = priceFingerprint(nextLatest);

    cache.set(productId, ticks);

    if (lastSeriesFp.get(productId) !== seriesFp) {
      lastSeriesFp.set(productId, seriesFp);
      broadcastSnapshot(productId, ticks);
    }

    const prevPriceFp = lastPriceFp.get(productId);
    if (
      prevPriceFp !== undefined &&
      prevLatest &&
      nextLatest &&
      prevPriceFp !== nextPriceFp
    ) {
      await notifyPriceChangePush(prevLatest, nextLatest);
    }
    if (nextPriceFp) lastPriceFp.set(productId, nextPriceFp);
  } catch (err) {
    console.warn(`[poller] ${productId}`, err);
  }
}

export async function pollAll(): Promise<void> {
  await Promise.all(PRODUCT_IDS.map((id) => pollOne(id)));
}

export function startPoller(): void {
  const pollMs = Number(process.env.POLL_MS) || 2_000;
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  function clearTimers() {
    if (intervalId !== undefined) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  }

  function arm() {
    clearTimers();
    if (isVnPollWindow()) {
      void pollAll();
      intervalId = setInterval(() => {
        if (!isVnPollWindow()) {
          arm();
          return;
        }
        void pollAll();
      }, pollMs);
      timeoutId = setTimeout(arm, msUntilVnMinutes(POLL_END_MIN));
      console.log(`[poller] active every ${pollMs}ms until 18:30 VN`);
    } else {
      const wait = msUntilVnMinutes(POLL_START_MIN);
      console.log(`[poller] sleeping ${Math.round(wait / 1000)}s until 08:30 VN`);
      timeoutId = setTimeout(() => {
        void pollAll();
        arm();
      }, wait);
      // Outside window: still fetch once so SSE/REST have data
      void pollAll();
    }
  }

  arm();
}
