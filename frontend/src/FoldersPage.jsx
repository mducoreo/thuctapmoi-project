import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import FolderTree from './FolderTree.jsx';
import DocumentList from './DocumentList.jsx';
import './FoldersPage.css';

const FOLDER_DRAG_TYPE = 'application/x-folder';

export default function FoldersPage({ onLogout }) {
    const [folders, setFolders] = useState([]);
    const [path, setPath] = useState([]);
    const [reload, setReload] = useState(0);
    const [documentsReload, setDocumentsReload] = useState(0);

    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [showForm, setShowForm] = useState(false);
    const [editingFolder, setEditingFolder] = useState(null);
    const [name, setName] = useState('');

    const [draggedFolder, setDraggedFolder] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);

    const [file, setFile] = useState(null);
    const [uploadError, setUploadError] = useState('');
    const [uploadSuccess, setUploadSuccess] = useState('');

    const fileInputRef = useRef(null);
    const moveLock = useRef(false);
    const uploadLock = useRef(false);

    const currentFolder = path[path.length - 1];
    const parentId = currentFolder?.id ?? null;
    const actionDisabled = busy || loading || showForm;

    useEffect(() => {
        let active = true;

        async function loadFolders() {
            setLoading(true);
            setLoadError('');

            try {
                const data = await api.folders(parentId);

                if (active) {
                    setFolders(data);
                }
            } catch (err) {
                if (active) {
                    setLoadError(err.message);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadFolders();

        return () => {
            active = false;
        };
    }, [parentId, reload]);

    useEffect(() => {
        setFile(null);
        setUploadError('');
        setUploadSuccess('');

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [parentId]);

    function clearMessages() {
        setError('');
        setSuccess('');
    }

    function closeForm() {
        setShowForm(false);
        setEditingFolder(null);
        setName('');
    }

    function startCreate() {
        clearMessages();
        setEditingFolder(null);
        setName('');
        setShowForm(true);
    }

    function startEdit(folder) {
        clearMessages();
        setEditingFolder(folder);
        setName(folder.name);
        setShowForm(true);
    }

    async function saveFolder(event) {
        event.preventDefault();
        clearMessages();

        const folderName = name.trim();

        if (!folderName) {
            setError('Nhập tên thư mục.');
            return;
        }

        setBusy(true);

        try {
            if (editingFolder) {
                await api.updateFolder(
                    editingFolder.id,
                    folderName,
                    editingFolder.parentId
                );

                setSuccess('Đã sửa thư mục.');
            } else {
                await api.createFolder(folderName, parentId);
                setSuccess('Đã tạo thư mục.');
            }

            closeForm();
            setReload((value) => value + 1);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function deleteFolder(folder) {
        if (!window.confirm(`Xóa thư mục "${folder.name}"?`)) {
            return;
        }

        clearMessages();
        setBusy(true);

        try {
            await api.deleteFolder(folder.id);
            setSuccess('Đã xóa thư mục.');
            setReload((value) => value + 1);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function openFolder(folder) {
        clearMessages();
        setBusy(true);

        try {
            const data = await api.getFolder(folder.id);

            closeForm();
            setPath((previous) => [...previous, data]);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    function goBack() {
        clearMessages();
        closeForm();
        setPath((previous) => previous.slice(0, -1));
    }

    async function uploadDocument(event) {
        event.preventDefault();

        if (uploadLock.current || actionDisabled) {
            return;
        }

        setUploadError('');
        setUploadSuccess('');

        if (parentId == null) {
            setUploadError('Mở một thư mục trước khi tải tài liệu lên.');
            return;
        }

        if (!file) {
            setUploadError('Chọn file cần tải lên.');
            return;
        }

        const token = localStorage.getItem('accessToken');

        if (!token) {
            setUploadError('Bạn cần đăng nhập.');
            return;
        }

        const selectedFile = file;
        const formData = new FormData();
        formData.append('file', selectedFile);

        uploadLock.current = true;
        setBusy(true);

        try {
            const response = await fetch(
                `/api/folders/${encodeURIComponent(parentId)}/documents`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    body: formData,
                }
            );

            const text = await response.text();

            let data;

            try {
                data = text ? JSON.parse(text) : null;
            } catch {
                data = text;
            }

            if (!response.ok) {
                throw new Error(
                    typeof data === 'string'
                        ? data
                        : data?.message || 'Không tải được tài liệu lên.'
                );
            }

            setUploadSuccess(
                `Đã tải lên file "${selectedFile.name}".`
            );

            setFile(null);

            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            // Tải lại danh sách tài liệu sau khi upload.
            setDocumentsReload((value) => value + 1);
        } catch (err) {
            setUploadError(err.message);
        } finally {
            uploadLock.current = false;
            setBusy(false);
        }
    }

    function handleDragStart(event, folder) {
        event.stopPropagation();

        if (actionDisabled || moveLock.current) {
            event.preventDefault();
            return;
        }

        const payload = {
            id: folder.id,
            name: folder.name,
            parentId: folder.parentId ?? null,
        };

        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(
            FOLDER_DRAG_TYPE,
            JSON.stringify(payload)
        );

        setDraggedFolder(payload);
        setDropTarget(null);
    }

    function handleDragEnd() {
        setDraggedFolder(null);
        setDropTarget(null);
    }

    function canDrop(targetFolder) {
        if (
            actionDisabled ||
            moveLock.current ||
            !draggedFolder
        ) {
            return false;
        }

        const targetId = targetFolder?.id ?? null;

        return (
            draggedFolder.id !== targetId &&
            draggedFolder.parentId !== targetId
        );
    }

    function handleDragOver(event, targetFolder) {
        event.stopPropagation();

        if (!canDrop(targetFolder)) {
            event.dataTransfer.dropEffect = 'none';
            setDropTarget(null);
            return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        setDropTarget(
            targetFolder ? String(targetFolder.id) : 'root'
        );
    }

    function handleDragLeave(event) {
        event.stopPropagation();

        if (
            event.relatedTarget &&
            event.currentTarget.contains(event.relatedTarget)
        ) {
            return;
        }

        setDropTarget(null);
    }

    async function handleDrop(event, targetFolder) {
        event.preventDefault();
        event.stopPropagation();
        setDropTarget(null);

        if (
            actionDisabled ||
            moveLock.current ||
            !draggedFolder
        ) {
            return;
        }

        const raw = event.dataTransfer.getData(FOLDER_DRAG_TYPE);

        if (!raw) {
            return;
        }

        let source;

        try {
            source = JSON.parse(raw);
        } catch {
            return;
        }

        if (source.id !== draggedFolder.id) {
            return;
        }

        const targetId = targetFolder?.id ?? null;

        if (
            source.id === targetId ||
            (source.parentId ?? null) === targetId
        ) {
            handleDragEnd();
            return;
        }

        moveLock.current = true;
        setBusy(true);
        clearMessages();
        handleDragEnd();

        try {
            await api.moveFolder(source.id, targetId);

            const destination = targetFolder
                ? `"${targetFolder.name}"`
                : 'thư mục gốc';

            setSuccess(
                `Đã chuyển "${source.name}" vào ${destination}.`
            );

            setPath([]);
            setReload((value) => value + 1);
        } catch (err) {
            setError(err.message);
        } finally {
            moveLock.current = false;
            setBusy(false);
        }
    }

    const interaction = {
        disabled: actionDisabled,
        draggedFolderId: draggedFolder?.id ?? null,
        dropTarget,
        onDragStart: handleDragStart,
        onDragEnd: handleDragEnd,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
    };

    return (
        <main
            className="folders-page"
            style={{
                minHeight: '100vh',
                boxSizing: 'border-box',
            }}
            onDragOver={(event) => handleDragOver(event, null)}
            onDragLeave={handleDragLeave}
            onDrop={(event) => handleDrop(event, null)}
        >
            <div className="folders-workspace">
                <header className="folders-header">
                    QUẢN LÝ HỒ SƠ, VĂN BẢN
                </header>

                <div className="folders-layout">
                    <aside className="folders-sidebar">
                        <FolderTree
                            key={reload}
                            interaction={interaction}
                        />
                    </aside>

                    <section className="folders-content">
                        <div className="folders-toolbar">
                            <h1>
                                {currentFolder?.name ?? 'Thư mục gốc'}
                            </h1>

                            <div className="folders-actions">
                                {currentFolder && (
                                    <button
                                        type="button"
                                        onClick={goBack}
                                        disabled={actionDisabled}
                                    >
                                        ← Quay lại
                                    </button>
                                )}

                                <button
                                    type="button"
                                    className="folders-primary"
                                    onClick={startCreate}
                                    disabled={
                                        actionDisabled ||
                                        Boolean(loadError)
                                    }
                                >
                                    + Tạo thư mục
                                </button>

                                <button
                                    type="button"
                                    onClick={onLogout}
                                    disabled={busy}
                                >
                                    Đăng xuất
                                </button>
                            </div>
                        </div>

                        <p className="folders-location">
                            Vị trí: Gốc
                            {path.map((folder) => (
                                <span key={folder.id}>
                                    {' / '}{folder.name}
                                </span>
                            ))}
                        </p>

                        {currentFolder && (
                            <>
                                <form
                                    className="folders-form"
                                    onSubmit={uploadDocument}
                                >
                                    <h2>Tải tài liệu lên</h2>

                                    <label htmlFor="documentFile">
                                        Chọn file
                                    </label>

                                    <input
                                        ref={fileInputRef}
                                        id="documentFile"
                                        type="file"
                                        disabled={actionDisabled}
                                        onChange={(event) => {
                                            setFile(
                                                event.target.files?.[0] ?? null
                                            );
                                            setUploadError('');
                                            setUploadSuccess('');
                                        }}
                                    />

                                    <button
                                        type="submit"
                                        className="folders-primary"
                                        disabled={actionDisabled || !file}
                                    >
                                        {uploadLock.current
                                            ? 'Đang tải lên...'
                                            : 'Upload'}
                                    </button>

                                    {uploadError && (
                                        <p
                                            className="message error"
                                            role="alert"
                                        >
                                            {uploadError}
                                        </p>
                                    )}

                                    {uploadSuccess && (
                                        <p
                                            className="message success"
                                            role="status"
                                        >
                                            {uploadSuccess}
                                        </p>
                                    )}
                                </form>

                                <DocumentList
                                    folderId={parentId}
                                    reload={documentsReload}
                                />
                            </>
                        )}

                        <h2>Thư mục con</h2>

                        <p>
                            Kéo thư mục lên thư mục khác để chuyển vào.
                            {' '}
                            Thả vào khoảng trống để chuyển về thư mục gốc.
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

                        {showForm && (
                            <form
                                className="folders-form"
                                onSubmit={saveFolder}
                            >
                                <h2>
                                    {editingFolder
                                        ? 'Sửa thư mục'
                                        : 'Tạo thư mục'}
                                </h2>

                                <label htmlFor="folderName">
                                    Tên thư mục
                                </label>

                                <input
                                    id="folderName"
                                    value={name}
                                    onChange={(event) =>
                                        setName(event.target.value)
                                    }
                                    placeholder="Nhập tên thư mục"
                                    maxLength={100}
                                    disabled={busy}
                                    required
                                />

                                <div className="folders-actions">
                                    <button
                                        type="submit"
                                        className="folders-primary"
                                        disabled={busy}
                                    >
                                        {busy ? 'Đang lưu...' : 'Lưu'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={closeForm}
                                        disabled={busy}
                                    >
                                        Hủy
                                    </button>
                                </div>
                            </form>
                        )}

                        {busy && !showForm && (
                            <p role="status">Đang xử lý...</p>
                        )}

                        {loading && <p>Đang tải thư mục...</p>}

                        {!loading && loadError && (
                            <>
                                <p className="message error" role="alert">
                                    {loadError}
                                </p>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setReload((value) => value + 1)
                                    }
                                    disabled={busy || showForm}
                                >
                                    Thử lại
                                </button>
                            </>
                        )}

                        {!loading && !loadError && (
                            folders.length === 0 ? (
                                <p>Chưa có thư mục con nào.</p>
                            ) : (
                                <ul className="folders-list">
                                    {folders.map((folder) => (
                                        <li
                                            key={folder.id}
                                            className="folders-item"
                                            draggable={!actionDisabled}
                                            onDragStart={(event) =>
                                                handleDragStart(event, folder)
                                            }
                                            onDragEnd={handleDragEnd}
                                            onDragOver={(event) =>
                                                handleDragOver(event, folder)
                                            }
                                            onDragLeave={handleDragLeave}
                                            onDrop={(event) =>
                                                handleDrop(event, folder)
                                            }
                                            style={{
                                                background:
                                                    dropTarget === String(folder.id)
                                                        ? '#dbeafe'
                                                        : undefined,
                                                opacity:
                                                    draggedFolder?.id === folder.id
                                                        ? 0.45
                                                        : 1,
                                                cursor:
                                                    actionDisabled
                                                        ? 'default'
                                                        : 'grab',
                                            }}
                                        >
                                            <div className="folders-info">
                                                <span
                                                    className="folders-icon"
                                                    aria-hidden="true"
                                                >
                                                    📁
                                                </span>

                                                <div>
                                                    <strong>
                                                        {folder.name}
                                                    </strong>

                                                    <p>
                                                        Chủ sở hữu:{' '}
                                                        {folder.ownerUsername}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="folders-actions">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        openFolder(folder)
                                                    }
                                                    disabled={actionDisabled}
                                                >
                                                    Mở
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        startEdit(folder)
                                                    }
                                                    disabled={actionDisabled}
                                                >
                                                    Sửa
                                                </button>

                                                <button
                                                    type="button"
                                                    className="folders-danger"
                                                    onClick={() =>
                                                        deleteFolder(folder)
                                                    }
                                                    disabled={actionDisabled}
                                                >
                                                    Xóa
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}