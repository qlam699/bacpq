import { useState, type FormEvent } from 'react';
import {
  GITHUB_TOKEN_CREATE_URL,
  type GithubUser,
} from '../lib/githubAuth';
import {
  notifyTest,
  PushServiceUnavailableError,
  subscribeWebPush,
  supportsWebPush,
  unsubscribeWebPush,
  updatePushThresholds,
} from '../lib/notify';
import type { Settings } from '../lib/storage';

type Props = {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  githubUser: GithubUser | null;
  githubStorage?: 'local' | 'gist';
  githubSyncing?: boolean;
  onGithubLogin: (token: string) => Promise<void>;
  onGithubLogout: () => void;
  notifyPermission?: string;
  onNotifyPermissionChange?: () => void;
};

export function SettingsPopup({
  open,
  onClose,
  settings,
  updateSettings,
  githubUser,
  githubStorage,
  githubSyncing,
  onGithubLogin,
  onGithubLogout,
  notifyPermission,
  onNotifyPermissionChange,
}: Props) {
  const [token, setToken] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  async function handleGithubSubmit(e: FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError(null);
    try {
      await onGithubLogin(token);
      setToken('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoginBusy(false);
    }
  }

  async function toggleNotify() {
    if (settings.notifyOnChange) {
      await unsubscribeWebPush();
      updateSettings({ notifyOnChange: false });
      onNotifyPermissionChange?.();
      return;
    }
    if (!supportsWebPush()) {
      alert('Trình duyệt không hỗ trợ Web Push.');
      return;
    }
    try {
      await subscribeWebPush(['BPQ1L'], {
        thresholdEnabled: settings.thresholdEnabled,
        minBuy: settings.minBuy,
        maxSell: settings.maxSell,
      });
      onNotifyPermissionChange?.();
      updateSettings({ notifyOnChange: true });
      await notifyTest(false);
    } catch (e) {
      onNotifyPermissionChange?.();
      const msg = e instanceof Error ? e.message : 'Không bật được thông báo';
      if (msg.includes('Chưa được phép') || notifyPermission === 'denied') {
        alert(
          'Hãy cho phép thông báo trong trình duyệt (ổ khóa URL → Thông báo) rồi bấm lại.',
        );
        return;
      }
      if (e instanceof PushServiceUnavailableError) {
        updateSettings({ notifyOnChange: true });
        await notifyTest(true);
        alert(`${msg}\n\nĐã bật thông báo local khi tab đang mở.`);
        return;
      }
      alert(msg);
    }
  }

  function handleThresholdToggle() {
    const next = !settings.thresholdEnabled;
    updateSettings({ thresholdEnabled: next });
    void updatePushThresholds({
      thresholdEnabled: next,
      minBuy: settings.minBuy,
      maxSell: settings.maxSell,
    });
  }

  function handleMinBuyChange(val: string) {
    const n = val === '' ? null : Number(val);
    const minBuy = n != null && Number.isFinite(n) && n > 0 ? n : null;
    updateSettings({ minBuy });
    void updatePushThresholds({
      thresholdEnabled: settings.thresholdEnabled,
      minBuy,
      maxSell: settings.maxSell,
    });
  }

  function handleMaxSellChange(val: string) {
    const n = val === '' ? null : Number(val);
    const maxSell = n != null && Number.isFinite(n) && n > 0 ? n : null;
    updateSettings({ maxSell });
    void updatePushThresholds({
      thresholdEnabled: settings.thresholdEnabled,
      minBuy: settings.minBuy,
      maxSell,
    });
  }

  const notifyOn = settings.notifyOnChange && notifyPermission === 'granted';
  const canNotify =
    notifyPermission !== 'unsupported' &&
    notifyPermission !== 'denied' &&
    supportsWebPush();

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={() => onClose()}
    >
      <div
        className="modal settings-modal"
        role="dialog"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-modal__head">
          <h2 id="settings-title">Cài đặt</h2>
          <button
            type="button"
            className="btn ghost settings-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* GitHub section */}
        <section className="settings-section">
          <h3 className="settings-section__title label">GitHub</h3>
          {githubUser ? (
            <div className="gh-auth">
              <span
                className="gh-auth__user"
                title={
                  githubStorage === 'gist'
                    ? 'Đang lưu trên GitHub Gist'
                    : 'Đang dùng localStorage'
                }
              >
                <img
                  src={githubUser.avatarUrl}
                  alt=""
                  className="gh-auth__avatar"
                />
                <span className="gh-auth__login">
                  @{githubUser.login}
                  {githubSyncing
                    ? ' …'
                    : githubStorage === 'gist'
                      ? ' · gist'
                      : ''}
                </span>
              </span>
              <button
                type="button"
                className="btn ghost"
                onClick={onGithubLogout}
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <>
              <p className="muted">
                Dùng Personal Access Token (classic) với quyền{' '}
                <code>gist</code> để lưu dữ liệu lên Gist.
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
              <form
                className="gh-login-form"
                onSubmit={(e) => void handleGithubSubmit(e)}
              >
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
                {loginError ? (
                  <p className="inline-error">{loginError}</p>
                ) : null}
                <button
                  type="submit"
                  className="btn primary"
                  disabled={loginBusy}
                >
                  {loginBusy ? 'Đang kết nối…' : 'Kết nối'}
                </button>
              </form>
            </>
          )}
        </section>

        {/* Notification section */}
        <section className="settings-section">
          <h3 className="settings-section__title label">Thông báo</h3>
          <div className="settings-row">
            <span>Web Push khi giá đổi</span>
            <button
              type="button"
              className={`btn ghost${notifyOn ? ' notify-btn--on' : ''}`}
              onClick={() => void toggleNotify()}
              disabled={!canNotify}
            >
              {notifyOn ? 'Đang bật' : 'Bật'}
            </button>
          </div>

          {notifyOn ? (
            <div className="threshold-config">
              <label className="settings-row">
                <input
                  type="checkbox"
                  checked={settings.thresholdEnabled}
                  onChange={handleThresholdToggle}
                />
                <span>Giới hạn thông báo (ít làm phiền bạn)</span>
              </label>
              {settings.thresholdEnabled ? (
                <div className="threshold-inputs">
                  <label className="threshold-field">
                    <span className="label">
                      Giá shop mua vào tối thiểu (Buy ≥) (Bạn muốn bán bạc khi giá nhiêu)
                    </span>
                    <input
                      type="number"
                      placeholder="VD: 2300000"
                      value={settings.minBuy ?? ''}
                      onBlur={(e) => handleMinBuyChange(e.target.value)}
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = v === '' ? null : Number(v);
                        updateSettings({
                          minBuy:
                            n != null && Number.isFinite(n) && n > 0 ? n : null,
                        });
                      }}
                    />
                  </label>
                  <label className="threshold-field">
                    <span className="label">
                      Giá shop bán ra tối đa (Sell ≤) (Bạn muốn mua bạc khi giá nhiêu)
                    </span>
                    <input
                      type="number"
                      placeholder="VD: 2400000"
                      value={settings.maxSell ?? ''}
                      onBlur={(e) => handleMaxSellChange(e.target.value)}
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = v === '' ? null : Number(v);
                        updateSettings({
                          maxSell:
                            n != null && Number.isFinite(n) && n > 0 ? n : null,
                        });
                      }}
                    />
                  </label>
                  <p className="muted">
                    Chỉ thông báo khi ít nhất 1 điều kiện đạt (OR).
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
