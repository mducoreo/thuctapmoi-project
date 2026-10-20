import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import './AdminUsersPage.css';

export default function AdminUsersPage() {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [keyword, setKeyword] = useState('');
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [reload, setReload] = useState(0);

    const actionLock = useRef(false);

    // Tải lại danh sách khi đổi từ khóa, đổi trang hoặc cập nhật tài khoản.
    useEffect(() => {
        let active = true;

        async function loadUsers() {
            setLoading(true);
            setError('');

            try {
                const data = await api.adminUsers(keyword, page, 10);

                if (!active) {
                    return;
                }

                // Sau khi cập nhật, số trang có thể giảm.
                if (page > 0 && page >= data.totalPages) {
                    setPage(Math.max(0, data.totalPages - 1));
                    return;
                }

                setUsers(data.content);
                setTotalPages(data.totalPages);
                setTotalElements(data.totalElements);
            } catch (err) {
                if (active) {
                    setError(err.message);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadUsers();

        return () => {
            active = false;
        };
    }, [keyword, page, reload]);

    function handleSearch(event) {
        event.preventDefault();

        setNotice('');
        setPage(0);
        setKeyword(search.trim());
        setReload(value => value + 1);
    }

    // Dùng chung cho thao tác đổi quyền và khóa/mở tài khoản.
    async function updateUser(action, successMessage) {
        if (actionLock.current) {
            return;
        }

        actionLock.current = true;
        setBusy(true);
        setError('');
        setNotice('');

        try {
            await action();

            setNotice(successMessage);
            setReload(value => value + 1);
        } catch (err) {
            setError(err.message);
        } finally {
            actionLock.current = false;
            setBusy(false);
        }
    }

    function changeRole(user, role) {
        if (role === user.role) {
            return;
        }

        updateUser(
            () => api.changeUserRole(user.id, role),
            `Đã đổi quyền tài khoản ${user.username} thành ${role}.`
        );
    }

    function changeEnabled(user) {
        const enabled = !user.enabled;

        updateUser(
            () => api.changeUserEnabled(user.id, enabled),
            enabled
                ? `Đã mở khóa tài khoản ${user.username}.`
                : `Đã khóa tài khoản ${user.username}.`
        );
    }

    const disabled = loading || busy;

    return (
        <section className="admin-users">
            <div className="admin-users-heading">
                <h2>Quản lý tài khoản</h2>
                <span>Tổng: {totalElements} tài khoản</span>
            </div>

            <form
                className="admin-users-search"
                onSubmit={handleSearch}
            >
                <input
                    type="search"
                    aria-label="Tìm theo tên đăng nhập"
                    placeholder="Nhập tên đăng nhập..."
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    disabled={disabled}
                />

                <button type="submit" disabled={disabled}>
                    Tìm kiếm
                </button>
            </form>

            {error && (
                <div className="admin-users-error" role="alert">
                    <span>{error}</span>

                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setReload(value => value + 1)}
                    >
                        Tải lại danh sách
                    </button>
                </div>
            )}

            {notice && (
                <p className="admin-users-notice" role="status">
                    {notice}
                </p>
            )}

            {loading ? (
                <p>Đang tải danh sách tài khoản...</p>
            ) : (
                <>
                    <div className="admin-users-table-wrapper">
                        <table className="admin-users-table">
                            <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tên đăng nhập</th>
                                <th>Quyền</th>
                                <th>Trạng thái</th>
                                <th>Thao tác</th>
                            </tr>
                            </thead>

                            <tbody>
                            {users.map(user => (
                                <tr key={user.id}>
                                    <td>{user.id}</td>
                                    <td>{user.username}</td>

                                    <td>
                                        <select
                                            aria-label={`Quyền của ${user.username}`}
                                            value={user.role}
                                            disabled={disabled}
                                            onChange={event =>
                                                changeRole(
                                                    user,
                                                    event.target.value
                                                )
                                            }
                                        >
                                            <option value="USER">
                                                USER
                                            </option>
                                            <option value="ADMIN">
                                                ADMIN
                                            </option>
                                        </select>
                                    </td>

                                    <td>
                                            <span
                                                className={
                                                    user.enabled
                                                        ? 'admin-users-active'
                                                        : 'admin-users-locked'
                                                }
                                            >
                                                {user.enabled
                                                    ? 'Đang hoạt động'
                                                    : 'Đã khóa'}
                                            </span>
                                    </td>

                                    <td>
                                        <button
                                            type="button"
                                            disabled={disabled}
                                            onClick={() =>
                                                changeEnabled(user)
                                            }
                                        >
                                            {user.enabled
                                                ? 'Khóa'
                                                : 'Mở khóa'}
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {users.length === 0 && !error && (
                                <tr>
                                    <td colSpan={5}>
                                        Không tìm thấy tài khoản.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>

                    <div className="admin-users-pagination">
                        <button
                            type="button"
                            disabled={disabled || page === 0}
                            onClick={() => setPage(value => value - 1)}
                        >
                            Trang trước
                        </button>

                        <span>
                            Trang {totalPages === 0 ? 0 : page + 1}
                            {' / '}
                            {totalPages}
                        </span>

                        <button
                            type="button"
                            disabled={
                                disabled || page + 1 >= totalPages
                            }
                            onClick={() => setPage(value => value + 1)}
                        >
                            Trang sau
                        </button>
                    </div>
                </>
            )}
        </section>
    );
}