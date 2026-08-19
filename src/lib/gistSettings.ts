import { ghHeaders } from './githubAuth';
import type { Settings } from './storage';

const SETTINGS_FILE = 'settings.json';

type GistFile = { content?: string; filename?: string };
type Gist = {
  id: string;
  files: Record<string, GistFile | null>;
};

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

export async function loadSettingsFromGist(
  token: string,
  gistId: string,
): Promise<Partial<Settings> | null> {
  try {
    const gist = await ghJson<Gist>(token, `/gists/${gistId}`);
    const file = gist.files[SETTINGS_FILE];
    const content = file?.content;
    if (!content || !content.trim()) return null;
    return JSON.parse(content) as Partial<Settings>;
  } catch {
    return null;
  }
}

export async function saveSettingsToGist(
  token: string,
  gistId: string,
  settings: Settings,
): Promise<void> {
  await ghJson<Gist>(token, `/gists/${gistId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      files: {
        [SETTINGS_FILE]: { content: JSON.stringify(settings, null, 2) },
      },
    }),
  });
}
