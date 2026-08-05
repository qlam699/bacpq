const TOKEN_KEY = 'bacpq:gh_token';
const USER_KEY = 'bacpq:gh_user';

export type GithubUser = {
  login: string;
  avatarUrl: string;
  name: string | null;
};

const ghHeaders = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

export function loadStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function loadStoredUser(): GithubUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GithubUser;
  } catch {
    return null;
  }
}

export function clearGithubSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function persistGithubSession(token: string, user: GithubUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** Deep-link tạo classic PAT với scope gist */
export const GITHUB_TOKEN_CREATE_URL =
  'https://github.com/settings/tokens/new?scopes=gist&description=bacpq-tracker';

export async function fetchGithubUser(token: string): Promise<GithubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: ghHeaders(token),
  });
  if (res.status === 401) {
    throw new Error('Token không hợp lệ hoặc đã hết hạn');
  }
  if (!res.ok) {
    throw new Error(`Không lấy được thông tin GitHub (${res.status})`);
  }
  const data = (await res.json()) as {
    login: string;
    avatar_url: string;
    name: string | null;
  };
  return {
    login: data.login,
    avatarUrl: data.avatar_url,
    name: data.name,
  };
}

export async function loginWithGithubToken(token: string): Promise<GithubUser> {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('Vui lòng nhập token');
  const user = await fetchGithubUser(trimmed);
  // Kiểm tra quyền gist bằng cách list gists (403 nếu thiếu scope)
  const gistRes = await fetch('https://api.github.com/gists?per_page=1', {
    headers: ghHeaders(trimmed),
  });
  if (gistRes.status === 403 || gistRes.status === 401) {
    throw new Error('Token thiếu quyền gist — tạo token với scope “gist”');
  }
  if (!gistRes.ok) {
    throw new Error(`Không kiểm tra được quyền gist (${gistRes.status})`);
  }
  persistGithubSession(trimmed, user);
  return user;
}

export { ghHeaders };
