import { useCallback, useState } from 'react';
import {
  clearGithubSession,
  loadStoredToken,
  loadStoredUser,
  loginWithGithubToken,
  type GithubUser,
} from '../lib/githubAuth';
import { clearStoredGistId } from '../lib/gistPositions';

export type GithubAuthState = {
  token: string | null;
  user: GithubUser | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
};

export function useGithubAuth(): GithubAuthState {
  const [token, setToken] = useState<string | null>(() => loadStoredToken());
  const [user, setUser] = useState<GithubUser | null>(() => loadStoredUser());

  const login = useCallback(async (rawToken: string) => {
    const nextUser = await loginWithGithubToken(rawToken);
    setToken(rawToken.trim());
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    clearGithubSession();
    clearStoredGistId();
    setToken(null);
    setUser(null);
  }, []);

  return { token, user, login, logout };
}
