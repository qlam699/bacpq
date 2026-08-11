import type { CtjTick, ProductId } from './ctj';

export async function fetchPricesOnce(productId: ProductId): Promise<CtjTick[]> {
  const res = await fetch(`/api/prices?productId=${encodeURIComponent(productId)}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body.slice(0, 120) || `API ${res.status}`);
  }
  const data = (await res.json()) as CtjTick[];
  if (!Array.isArray(data)) throw new Error('Invalid prices response');
  return data;
}
