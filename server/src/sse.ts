import type { Response } from 'express';
import type { CtjTick, ProductId } from './ctj.js';

type Client = {
  id: number;
  productId: ProductId;
  res: Response;
};

let nextId = 1;
const clients = new Map<number, Client>();

const HEARTBEAT_MS = 25_000;

export function addSseClient(productId: ProductId, res: Response): number {
  const id = nextId++;
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.write(': connected\n\n');
  clients.set(id, { id, productId, res });

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      removeSseClient(id);
    }
  }, HEARTBEAT_MS);

  res.on('close', () => {
    clearInterval(heartbeat);
    removeSseClient(id);
  });

  return id;
}

export function removeSseClient(id: number): void {
  clients.delete(id);
}

export function sendSnapshot(res: Response, ticks: CtjTick[]): void {
  res.write(`event: snapshot\ndata: ${JSON.stringify(ticks)}\n\n`);
}

export function broadcastSnapshot(productId: ProductId, ticks: CtjTick[]): void {
  const payload = `event: snapshot\ndata: ${JSON.stringify(ticks)}\n\n`;
  for (const client of clients.values()) {
    if (client.productId !== productId) continue;
    try {
      client.res.write(payload);
    } catch {
      removeSseClient(client.id);
    }
  }
}

export function sseClientCount(): number {
  return clients.size;
}
