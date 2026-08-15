import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCT_IDS, type ProductId } from './ctj.js';
import {
  fetchPhuquyHistory,
  isHistoryDate,
  isHistoryDuration,
  parseHistoryUnitType,
} from './phuquyHistory.js';
import { getCachedPrices, pollAll, startPoller } from './poller.js';
import {
  configureWebPush,
  getVapidPublicKey,
  setPushEnabled,
} from './push.js';
import { addSseClient, sendSnapshot, sseClientCount } from './sse.js';
import {
  removeSubscription,
  subscriptionCount,
  upsertSubscription,
} from './subscriptions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DIST = path.join(ROOT, 'dist');

function isProductId(value: unknown): value is ProductId {
  return typeof value === 'string' && (PRODUCT_IDS as string[]).includes(value);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', async (_req, res) => {
  res.json({
    ok: true,
    sseClients: sseClientCount(),
    subscriptions: await subscriptionCount(),
    push: Boolean(getVapidPublicKey()),
    window: '08:30-18:30 Asia/Ho_Chi_Minh',
  });
});

app.get('/api/vapid-public-key', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const key = getVapidPublicKey();
  if (!key) {
    res.status(503).json({ error: 'VAPID not configured' });
    return;
  }
  res.json({ publicKey: key });
});

app.get('/api/prices', (req, res) => {
  const productId = req.query.productId;
  if (!isProductId(productId)) {
    res.status(400).json({ error: 'productId required (BPQ1L|BPQ10L|BPQ1KG)' });
    return;
  }
  const ticks = getCachedPrices(productId);
  if (!ticks) {
    res.status(503).json({ error: 'No cached prices yet' });
    return;
  }
  res.json(ticks);
});

app.get('/api/history', async (req, res) => {
  const type = parseHistoryUnitType(req.query.type);
  if (type == null) {
    res.status(400).json({ error: 'type required (1=Lượng|3=KG)' });
    return;
  }

  const durationRaw = req.query.duration;
  const fromRaw = req.query.fromDate;
  const toRaw = req.query.toDate;
  const hasDuration =
    typeof durationRaw === 'string' && durationRaw.length > 0;
  const hasRange =
    typeof fromRaw === 'string' &&
    fromRaw.length > 0 &&
    typeof toRaw === 'string' &&
    toRaw.length > 0;

  if (hasDuration === hasRange) {
    res.status(400).json({
      error:
        'provide either duration (1D|7D|1M|3M|1Y) or fromDate+toDate (dd/MM/yyyy)',
    });
    return;
  }

  try {
    if (hasDuration) {
      if (!isHistoryDuration(durationRaw)) {
        res.status(400).json({ error: 'invalid duration' });
        return;
      }
      const data = await fetchPhuquyHistory({ type, duration: durationRaw });
      res.set('Cache-Control', 'no-store');
      res.json(data);
      return;
    }
    if (!isHistoryDate(fromRaw) || !isHistoryDate(toRaw)) {
      res.status(400).json({ error: 'fromDate/toDate must be dd/MM/yyyy' });
      return;
    }
    const data = await fetchPhuquyHistory({
      type,
      fromDate: fromRaw,
      toDate: toRaw,
    });
    res.set('Cache-Control', 'no-store');
    res.json(data);
  } catch (err) {
    console.error('[history]', err);
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to fetch history',
    });
  }
});

app.get('/api/prices/stream', (req, res) => {
  const productId = req.query.productId;
  if (!isProductId(productId)) {
    res.status(400).json({ error: 'productId required (BPQ1L|BPQ10L|BPQ1KG)' });
    return;
  }

  addSseClient(productId, res);
  const ticks = getCachedPrices(productId);
  if (ticks) {
    sendSnapshot(res, ticks);
  } else {
    void pollAll().then(() => {
      const fresh = getCachedPrices(productId);
      if (fresh) sendSnapshot(res, fresh);
    });
  }
});

app.post('/api/push/subscribe', async (req, res) => {
  const subscription = req.body?.subscription;
  if (!subscription?.endpoint || !subscription?.keys) {
    res.status(400).json({ error: 'subscription required' });
    return;
  }
  try {
    const stored = await upsertSubscription(subscription, req.body?.productIds);
    res.json({ ok: true, endpoint: stored.endpoint, productIds: stored.productIds });
  } catch (err) {
    console.error('[subscribe]', err);
    res.status(500).json({ error: 'Failed to store subscription' });
  }
});

app.post('/api/push/unsubscribe', async (req, res) => {
  const endpoint = req.body?.endpoint ?? req.body?.subscription?.endpoint;
  if (typeof endpoint !== 'string' || !endpoint) {
    res.status(400).json({ error: 'endpoint required' });
    return;
  }
  const removed = await removeSubscription(endpoint);
  res.json({ ok: true, removed });
});

app.use(express.static(DIST, { index: false }));
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }
  if (req.path.startsWith('/api')) {
    next();
    return;
  }
  res.sendFile(path.join(DIST, 'index.html'), (err) => {
    if (err) next(err);
  });
});

const port = Number(process.env.PORT) || 8787;
setPushEnabled(configureWebPush());
startPoller();

app.listen(port, () => {
  console.log(`[server] listening on :${port}`);
});
