import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PushSubscription } from 'web-push';
import type { ProductId } from './ctj.js';
import { PRODUCT_IDS } from './ctj.js';

export type StoredSubscription = {
  endpoint: string;
  subscription: PushSubscription;
  productIds: ProductId[];
  updatedAt: string;
};

function dataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data');
}

function storePath(): string {
  return path.join(dataDir(), 'subscriptions.json');
}

let cache: StoredSubscription[] | null = null;

async function ensureDir(): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
}

async function load(): Promise<StoredSubscription[]> {
  if (cache) return cache;
  await ensureDir();
  try {
    const raw = await readFile(storePath(), 'utf8');
    const parsed = JSON.parse(raw) as StoredSubscription[];
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function persist(list: StoredSubscription[]): Promise<void> {
  cache = list;
  await ensureDir();
  await writeFile(storePath(), JSON.stringify(list, null, 2), 'utf8');
}

function normalizeProductIds(ids: unknown): ProductId[] {
  if (!Array.isArray(ids) || ids.length === 0) return [...PRODUCT_IDS];
  const allowed = new Set<string>(PRODUCT_IDS);
  const filtered = ids.filter((id): id is ProductId => allowed.has(String(id)));
  return filtered.length > 0 ? filtered : [...PRODUCT_IDS];
}

export async function upsertSubscription(
  subscription: PushSubscription,
  productIds?: unknown,
): Promise<StoredSubscription> {
  const list = await load();
  const entry: StoredSubscription = {
    endpoint: subscription.endpoint,
    subscription,
    productIds: normalizeProductIds(productIds),
    updatedAt: new Date().toISOString(),
  };
  const idx = list.findIndex((s) => s.endpoint === entry.endpoint);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  await persist(list);
  return entry;
}

export async function removeSubscription(endpoint: string): Promise<boolean> {
  const list = await load();
  const next = list.filter((s) => s.endpoint !== endpoint);
  if (next.length === list.length) return false;
  await persist(next);
  return true;
}

export async function listSubscriptionsForProduct(
  productId: ProductId,
): Promise<StoredSubscription[]> {
  const list = await load();
  return list.filter((s) => s.productIds.includes(productId));
}

export async function subscriptionCount(): Promise<number> {
  return (await load()).length;
}
