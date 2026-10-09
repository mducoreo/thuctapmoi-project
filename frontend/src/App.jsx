import { useState } from 'react';
import { api } from './api.js';
import FoldersPage from './FoldersPage.jsx';
import './index.css';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(
      () => Boolean(localStorage.getItem('accessToken'))
  );

  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function switchMode() {
    setRegister(!register);
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  }

  async function submit(event) {
    event.preventDefault();
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
        setPassword('');
        setConfirmPassword('');
        setSuccess('Đăng ký thành công. Hãy đăng nhập.');
      } else {
        const tokens = await api.login(name, password);

        if (!tokens?.accessToken) {
          throw new Error('Backend chưa trả về accessToken.');
        }

        localStorage.setItem('accessToken', tokens.accessToken);

        if (tokens.refreshToken) {
          localStorage.setItem('refreshToken', tokens.refreshToken);
        } else {
          localStorage.removeItem('refreshToken');
        }

        setPassword('');
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
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    setLoggedIn(false);
    setRegister(false);
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  }

  if (loggedIn) {
    return <FoldersPage onLogout={logout} />;
  }

  return (
      <main className="auth-page">
        <div className="auth-card">
          <p className="brand">QUẢN LÝ HỒ SƠ, VĂN BẢN</p>

          <h1>{register ? 'Đăng ký tài khoản' : 'Đăng nhập'}</h1>

          <p className="subtitle">
            {register
                ? 'Tạo tài khoản để sử dụng hệ thống.'
                : 'Đăng nhập để quản lý tài liệu của bạn.'}
          </p>

          {error && (
              <p className="message error" role="alert">
                {error}
              </p>
          )}

          {success && (
              <p className="message success" role="status">
                {success}
              </p>
          )}

          <form onSubmit={submit}>
            <label htmlFor="username">Tên đăng nhập</label>
            <input
                id="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Nhập tên đăng nhập"
                autoComplete="username"
                disabled={busy}
                required
            />

            <label htmlFor="password">Mật khẩu</label>
            <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nhập mật khẩu"
                autoComplete={
                  register ? 'new-password' : 'current-password'
                }
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
                      type="password"
                      value={confirmPassword}
                      onChange={(event) =>
                          setConfirmPassword(event.target.value)
                      }
                      placeholder="Nhập lại mật khẩu"
                      autoComplete="new-password"
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
                        {register ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
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