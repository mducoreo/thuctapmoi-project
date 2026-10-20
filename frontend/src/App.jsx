import { useEffect, useState } from 'react';
import {
  api,
  saveSession,
  clearSession,
  SESSION_EXPIRED_EVENT,
} from './api.js';
import FoldersPage from './FoldersPage.jsx';
import AdminUsersPage from './AdminUsersPage.jsx';
import './index.css';
import './App.css';

const APP_VIEW_KEY = 'appView';
const FOLDERS_VIEW_KEY = 'foldersPageView';
const SEARCH_VIEW_PREFIX = 'foldersPageSearch:';

function readAppView() {
  try {
    const saved = JSON.parse(
        sessionStorage.getItem(APP_VIEW_KEY) || 'null'
    );

    const hasToken = Boolean(
        localStorage.getItem('accessToken') ||
        localStorage.getItem('refreshToken')
    );

    return {
      loggedIn: saved?.loggedIn === true && hasToken,
      page: saved?.page === 'users' ? 'users' : 'folders',
      register: saved?.register === true,
    };
  } catch {
    return {
      loggedIn: false,
      page: 'folders',
      register: false,
    };
  }
}

function clearWorkspaceView() {
  try {
    sessionStorage.removeItem(FOLDERS_VIEW_KEY);

    const searchKeys = Object.keys(sessionStorage).filter(
        (key) => key.startsWith(SEARCH_VIEW_PREFIX)
    );

    searchKeys.forEach((key) => {
      sessionStorage.removeItem(key);
    });
  } catch {
    // Không chặn đăng xuất nếu trình duyệt không cho truy cập bộ nhớ.
  }
}

export default function App() {
  const [savedView] = useState(readAppView);

  const [loggedIn, setLoggedIn] = useState(savedView.loggedIn);
  const [page, setPage] = useState(savedView.page);
  const [register, setRegister] = useState(savedView.register);

  const [user, setUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [profileReload, setProfileReload] = useState(0);

  // Luôn khởi tạo các ô nhập rỗng, không lưu mật khẩu.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Giữ trang đang xem khi tải lại trong cùng tab.
  useEffect(() => {
    try {
      sessionStorage.setItem(
          APP_VIEW_KEY,
          JSON.stringify({
            loggedIn,
            page,
            register,
          })
      );
    } catch {
      // Trang vẫn hoạt động nếu trình duyệt không cho lưu.
    }
  }, [loggedIn, page, register]);

  // Chuyển về đăng nhập khi API báo phiên hết hiệu lực.
  useEffect(() => {
    function onSessionExpired() {
      clearWorkspaceView();

      setLoggedIn(false);
      setUser(null);
      setPage('folders');
      setRegister(false);

      setUsername('');
      setPassword('');
      setConfirmPassword('');

      setProfileError('');
      setProfileLoading(true);
      setSuccess('');
      setError(
          'Phiên đăng nhập đã hết hiệu lực. Hãy đăng nhập lại.'
      );
    }

    window.addEventListener(
        SESSION_EXPIRED_EVENT,
        onSessionExpired
    );

    return () => {
      window.removeEventListener(
          SESSION_EXPIRED_EVENT,
          onSessionExpired
      );
    };
  }, []);

  // Kiểm tra tài khoản trước khi hiển thị nội dung.
  useEffect(() => {
    if (!loggedIn) {
      return;
    }

    let active = true;

    async function loadProfile() {
      setProfileLoading(true);
      setProfileError('');

      try {
        const profile = await api.me();

        if (!profile?.username) {
          throw new Error(
              'API chưa trả về thông tin tài khoản hợp lệ.'
          );
        }

        if (active) {
          setUser(profile);
        }
      } catch (err) {
        if (active) {
          setProfileError(
              err instanceof TypeError
                  ? 'Không kết nối được backend. Kiểm tra backend rồi bấm Thử lại.'
                  : err.message
          );
        }
      } finally {
        if (active) {
          setProfileLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [loggedIn, profileReload]);

  function switchMode() {
    setRegister((value) => !value);
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  }

  async function submit(event) {
    event.preventDefault();

    if (busy) {
      return;
    }

    setError('');
    setSuccess('');

    const name = username.trim();

    if (!name || !password) {
      setError('Nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    if (register && password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    setBusy(true);

    try {
      if (register) {
        await api.register(name, password);

        setRegister(false);
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setSuccess(
            'Đăng ký thành công. Hãy đăng nhập.'
        );
      } else {
        const tokens = await api.login(name, password);

        saveSession(tokens);
        clearWorkspaceView();

        setUsername('');
        setPassword('');
        setConfirmPassword('');

        setUser(null);
        setPage('folders');
        setRegister(false);
        setProfileError('');
        setProfileLoading(true);
        setLoggedIn(true);
      }
    } catch (err) {
      setError(
          err instanceof TypeError
              ? 'Không kết nối được backend. Kiểm tra backend đã chạy chưa.'
              : err.message
      );
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearSession();
    clearWorkspaceView();

    setLoggedIn(false);
    setUser(null);
    setPage('folders');
    setRegister(false);

    setUsername('');
    setPassword('');
    setConfirmPassword('');

    setProfileError('');
    setProfileLoading(true);
    setError('');
    setSuccess('');
  }

  function retryProfile() {
    setProfileLoading(true);
    setProfileReload((value) => value + 1);
  }

  if (loggedIn) {
    if (profileLoading) {
      return (
          <main className="app-profile-state">
            <p>Đang kiểm tra phiên đăng nhập...</p>

            <button
                type="button"
                onClick={logout}
            >
              Đăng xuất
            </button>
          </main>
      );
    }

    if (profileError || !user) {
      return (
          <main className="app-profile-state">
            <p
                className="message error"
                role="alert"
            >
              {profileError ||
                  'Chưa tải được thông tin tài khoản.'}
            </p>

            <div className="app-profile-actions">
              <button
                  type="button"
                  onClick={retryProfile}
              >
                Thử lại
              </button>

              <button
                  type="button"
                  onClick={logout}
              >
                Đăng xuất
              </button>
            </div>
          </main>
      );
    }

    const isAdmin = user.role === 'ADMIN';
    const showAdminPage = isAdmin && page === 'users';

    return (
        <>
          {isAdmin && (
              <nav
                  className="app-navigation"
                  aria-label="Điều hướng chính"
              >
                <button
                    type="button"
                    className={
                      !showAdminPage ? 'is-active' : ''
                    }
                    aria-pressed={!showAdminPage}
                    onClick={() => setPage('folders')}
                >
                  Hồ sơ, văn bản
                </button>

                <button
                    type="button"
                    className={
                      showAdminPage ? 'is-active' : ''
                    }
                    aria-pressed={showAdminPage}
                    onClick={() => setPage('users')}
                >
                  Quản lý tài khoản
                </button>
              </nav>
          )}

          {showAdminPage ? (
              <main className="app-admin-content">
                <div className="app-admin-toolbar">
                            <span>
                                Đang đăng nhập: {user.username}
                            </span>

                  <button
                      type="button"
                      onClick={logout}
                  >
                    Đăng xuất
                  </button>
                </div>

                <AdminUsersPage />
              </main>
          ) : (
              <FoldersPage onLogout={logout} />
          )}
        </>
    );
  }

  return (
      <main className="auth-page">
        <div className="auth-card">
          <p className="brand">
            QUẢN LÝ HỒ SƠ, VĂN BẢN
          </p>

          <h1>
            {register
                ? 'Đăng ký tài khoản'
                : 'Đăng nhập'}
          </h1>

          <p className="subtitle">
            {register
                ? 'Tạo tài khoản để sử dụng hệ thống.'
                : 'Đăng nhập để quản lý tài liệu của bạn.'}
          </p>

          {error && (
              <p
                  className="message error"
                  role="alert"
              >
                {error}
              </p>
          )}

          {success && (
              <p
                  className="message success"
                  role="status"
              >
                {success}
              </p>
          )}

          <form
              onSubmit={submit}
              autoComplete="off"
          >
            <label htmlFor="username">
              Tên đăng nhập
            </label>

            <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(event) =>
                    setUsername(event.target.value)
                }
                autoComplete="off"
                placeholder="Nhập tên đăng nhập"
                disabled={busy}
                required
            />

            <label htmlFor="password">
              Mật khẩu
            </label>

            <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(event) =>
                    setPassword(event.target.value)
                }
                autoComplete={
                  register ? 'new-password' : 'off'
                }
                placeholder="Nhập mật khẩu"
                disabled={busy}
                required
            />

            {register && (
                <>
                  <label htmlFor="confirmPassword">
                    Nhập lại mật khẩu
                  </label>

                  <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) =>
                          setConfirmPassword(
                              event.target.value
                          )
                      }
                      autoComplete="new-password"
                      placeholder="Nhập lại mật khẩu"
                      disabled={busy}
                      required
                  />
                </>
            )}

            <button
                className="submit-button"
                type="submit"
                disabled={busy}
            >
              {busy
                  ? 'Đang xử lý...'
                  : register
                      ? 'Tạo tài khoản'
                      : 'Đăng nhập'}
            </button>
          </form>

          <div className="switch-mode">
                    <span>
                        {register
                            ? 'Đã có tài khoản?'
                            : 'Chưa có tài khoản?'}
                    </span>

            <button
                type="button"
                onClick={switchMode}
                disabled={busy}
            >
              {register ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          </div>
        </div>
      </main>
  );
}