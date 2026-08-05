import { useState, type FormEvent } from 'react';
import {
  GITHUB_TOKEN_CREATE_URL,
  type GithubUser,
} from '../lib/githubAuth';

type Props = {
  user: GithubUser | null;
  syncing?: boolean;
  storage?: 'local' | 'gist';
  onLogin: (token: string) => Promise<void>;
  onLogout: () => void;
};

export function GithubAuthControls({
  user,
  syncing,
  storage,
  onLogin,
  onLogout,
}: Props) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onLogin(token);
      setToken('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <div className="gh-auth">
        <span
          className="gh-auth__user"
          title={
            storage === 'gist'
              ? 'Đang lưu positions trên GitHub Gist'
              : 'Đang dùng localStorage'
          }
        >
          <img src={user.avatarUrl} alt="" className="gh-auth__avatar" />
          <span className="gh-auth__login">
            @{user.login}
            {syncing ? ' …' : storage === 'gist' ? ' · gist' : ''}
          </span>
        </span>
        <button type="button" className="btn ghost" onClick={onLogout}>
          Đăng xuất
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn ghost"
        onClick={() => setOpen(true)}
      >
        Login GitHub
      </button>

      {open ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-labelledby="gh-login-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="gh-login-title">Đăng nhập GitHub</h2>
            <p className="muted">
              Dùng Personal Access Token (classic) với quyền{' '}
              <code>gist</code> để lưu bạc cá nhân lên Gist riêng thay vì
              localStorage.
            </p>
            <ol className="gh-steps">
              <li>
                <a
                  href={GITHUB_TOKEN_CREATE_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Tạo token trên GitHub
                </a>{' '}
                (tick scope <code>gist</code>)
              </li>
              <li>Dán token vào ô bên dưới</li>
            </ol>
            <form className="gh-login-form" onSubmit={(e) => void handleSubmit(e)}>
              <label>
                Token
                <input
                  type="password"
                  autoComplete="off"
                  placeholder="ghp_…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />
              </label>
              {error ? <p className="inline-error">{error}</p> : null}
              <div className="modal__actions">
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Đang kết nối…' : 'Kết nối'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
