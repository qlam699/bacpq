import type { Position } from './storage';
import { parsePositionsJson, serializePositions } from './storage';
import { ghHeaders } from './githubAuth';

const GIST_DESC = 'bacpq-positions';
const GIST_FILE = 'positions.json';
const GIST_ID_KEY = 'bacpq:gist_id';

type GistFile = { content?: string; filename?: string };
type Gist = {
  id: string;
  description: string | null;
  files: Record<string, GistFile | null>;
};

export function loadStoredGistId(): string | null {
  return localStorage.getItem(GIST_ID_KEY);
}

export function clearStoredGistId(): void {
  localStorage.removeItem(GIST_ID_KEY);
}

function persistGistId(id: string): void {
  localStorage.setItem(GIST_ID_KEY, id);
}

async function ghJson<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      ...ghHeaders(token),
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `GitHub API ${res.status}: ${body.slice(0, 180) || res.statusText}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function positionsFromGist(gist: Gist): Position[] {
  const file =
    gist.files[GIST_FILE] ??
    Object.values(gist.files).find((f) => f?.filename?.endsWith('.json'));
  const content = file?.content;
  if (!content || !content.trim()) return [];
  return parsePositionsJson(content);
}

async function findBacpqGist(token: string): Promise<Gist | null> {
  const cached = loadStoredGistId();
  if (cached) {
    try {
      return await ghJson<Gist>(token, `/gists/${cached}`);
    } catch {
      clearStoredGistId();
    }
  }

  // Quét vài trang gists gần nhất
  for (let page = 1; page <= 3; page++) {
    const list = await ghJson<Gist[]>(
      token,
      `/gists?per_page=50&page=${page}`,
    );
    const hit = list.find(
      (g) =>
        g.description === GIST_DESC ||
        Object.keys(g.files).includes(GIST_FILE),
    );
    if (hit) {
      // Lấy full gist (list không có content)
      const full = await ghJson<Gist>(token, `/gists/${hit.id}`);
      persistGistId(full.id);
      return full;
    }
    if (list.length < 50) break;
  }
  return null;
}

async function createBacpqGist(
  token: string,
  positions: Position[],
): Promise<Gist> {
  const gist = await ghJson<Gist>(token, '/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: GIST_DESC,
      public: false,
      files: {
        [GIST_FILE]: { content: serializePositions(positions) },
      },
    }),
  });
  persistGistId(gist.id);
  return gist;
}

/**
 * Load positions từ gist riêng.
 * Nếu chưa có gist → tạo mới, seed từ `seed` (thường là localStorage).
 */
export async function loadPositionsFromGist(
  token: string,
  seed: Position[] = [],
): Promise<{ gistId: string; positions: Position[] }> {
  const existing = await findBacpqGist(token);
  if (existing) {
    return { gistId: existing.id, positions: positionsFromGist(existing) };
  }
  const created = await createBacpqGist(token, seed);
  return { gistId: created.id, positions: seed };
}

export async function savePositionsToGist(
  token: string,
  gistId: string,
  positions: Position[],
): Promise<void> {
  await ghJson<Gist>(token, `/gists/${gistId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      description: GIST_DESC,
      files: {
        [GIST_FILE]: { content: serializePositions(positions) },
      },
    }),
  });
  persistGistId(gistId);
}
