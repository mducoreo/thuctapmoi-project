import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import DocumentMetadataForm, { emptyMetadata } from './DocumentMetadataForm.jsx';
import WorkspaceMenu from './WorkspaceMenu.jsx';
import WorkspaceModal from './WorkspaceModal.jsx';

const statuses = {
    PENDING: 'Chưa xử lý',
    PROCESSING: 'Đang xử lý',
    COMPLETED: 'Hoàn thành',
    FAILED: 'Thất bại',
};
function supportsOcr(document) {
    return (
        document.mimeType?.startsWith('image/') ||
        document.mimeType === 'application/pdf' ||
        /\.(pdf|png|jpe?g|bmp|tiff?|webp)$/i.test(document.originalName ?? '')
    );
}
function fileType(document) {
    return document.originalName?.split('.').pop()?.toUpperCase() || 'FILE';
}

export default function DocumentList({
                                         folderId,
                                         reload,
                                         selectedDocumentId,
                                         disabled = false,
                                         onBusyChange,
                                         onOpenDocument,
                                         onDetailDocument,
                                         onRenameDocument,
                                         onMoveDocument,
                                         onDeleteDocument,
                                         onDownloadDocument,
                                         onRunDocumentOcr,
                                         onShowDocumentText,
                                         onDocumentsChanged,
                                     }) {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState(null);
    const [metadata, setMetadata] = useState(emptyMetadata);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [success, setSuccess] = useState('');
    const lock = useRef(false);
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        api.documents(folderId)
            .then((data) => {
                if (!Array.isArray(data)) {
                    throw new Error('API danh sách tài liệu chưa trả về một mảng.');
                }
                if (active) {
                    setDocuments(data);
                }
            })
            .catch((err) => {
                if (active) {
                    setError(err.message);
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });
        return () => {
            active = false;
        };
    }, [folderId, reload, retry]);
    function startEdit(document) {
        const value = emptyMetadata();
        Object.keys(value).forEach((key) => {
            value[key] = document[key] ?? '';
        });
        setMetadata(value);
        setSaveError('');
        setSuccess('');
        setEditing(document);
    }
    async function saveMetadata(event) {
        event.preventDefault();
        if (lock.current || disabled || !editing) {
            return;
        }
        if (!metadata.title.trim()) {
            setSaveError('Nhập tên văn bản.');
            return;
        }
        lock.current = true;
        setSaving(true);
        setSaveError('');
        onBusyChange?.(true);
        try {
            const saved = await api.updateDocumentMetadata(folderId, editing.id, {
                ...metadata,
                title: metadata.title.trim(),
            });
            setDocuments((previous) =>
                previous.map((item) =>
                    item.id === editing.id ? { ...item, ...saved } : item
                )
            );
            setEditing(null);
            setSuccess('Đã lưu thông tin văn bản.');
            onDocumentsChanged?.();
        } catch (err) {
            setSaveError(err.message);
        } finally {
            lock.current = false;
            setSaving(false);
            onBusyChange?.(false);
        }
    }
    const keyword = query.trim().toLocaleLowerCase('vi');
    const visible = documents.filter((item) =>
        [item.title, item.originalName, item.keywords].some((text) =>
            text?.toLocaleLowerCase('vi').includes(keyword)
        )
    );
    return (
        <section className="documents-section" aria-label="Tài liệu trong thư mục">
            <div className="documents-heading">
                <h2>
                    Tài liệu <span className="count-label">{documents.length}</span>
                </h2>
                <label className="document-search">
                    <span className="sr-only">Tìm tài liệu trong thư mục</span>
                    <input
                        type="search"
                        placeholder="Tìm tài liệu trong thư mục…"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </label>
            </div>
            {success && (
                <p role="status" className="message success">
                    {success}
                </p>
            )}
            {error && (
                <div className="message error" role="alert">
                    {error}{' '}
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setRetry((value) => value + 1)}
                    >
                        Thử lại
                    </button>
                </div>
            )}
            <div className="documents-table-scroll">
                <table className="documents-table">
                    <thead>
                    <tr>
                        <th>Tên tài liệu</th>
                        <th>Loại</th>
                        <th>Trạng thái OCR</th>
                        <th>
                            <span className="sr-only">Thao tác</span>
                        </th>
                    </tr>
                    </thead>
                    <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan={4} className="table-empty" role="status">
                                Đang tải tài liệu…
                            </td>
                        </tr>
                    ) : !error && visible.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="table-empty">
                                {keyword
                                    ? 'Không tìm thấy tài liệu phù hợp.'
                                    : 'Chưa có tài liệu. Bấm “Tải tài liệu” để thêm file.'}
                            </td>
                        </tr>
                    ) : (
                        visible.map((document) => {
                            const ocr = supportsOcr(document);
                            const status = document.ocrStatus ?? 'PENDING';
                            const blocked = disabled || saving || Boolean(editing);
                            return (
                                <tr
                                    key={document.id}
                                    className={
                                        selectedDocumentId === document.id
                                            ? 'selected'
                                            : ''
                                    }
                                >
                                    <td>
                                        <button
                                            type="button"
                                            className="document-name"
                                            title={document.originalName}
                                            disabled={blocked}
                                            onClick={() =>
                                                onOpenDocument(folderId, document)
                                            }
                                        >
                                                <span
                                                    aria-hidden="true"
                                                    className={`file-glyph ${fileType(document) === 'PDF' ? 'pdf' : ''}`}
                                                >
                                                    ▤
                                                </span>
                                            <span>
                                                    <strong>
                                                        {document.title ||
                                                            document.originalName}
                                                    </strong>
                                                {document.title &&
                                                    document.title !==
                                                    document.originalName && (
                                                        <small>
                                                            {document.originalName}
                                                        </small>
                                                    )}
                                                </span>
                                        </button>
                                    </td>
                                    <td className="file-type">
                                        {fileType(document)}
                                    </td>
                                    <td>
                                        {ocr ? (
                                            <button
                                                type="button"
                                                className={`ocr-badge ${status.toLowerCase()}`}
                                                disabled={blocked}
                                                title={
                                                    status === 'FAILED'
                                                        ? 'Bấm để xem lỗi OCR'
                                                        : 'Bấm để xem nội dung chữ và trạng thái OCR'
                                                }
                                                onClick={() =>
                                                    onShowDocumentText(
                                                        folderId,
                                                        document
                                                    )
                                                }
                                            >
                                                {statuses[status] ?? status}
                                            </button>
                                        ) : (
                                            <span className="muted">—</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="document-row-actions">
                                            <button
                                                type="button"
                                                className="view-button"
                                                disabled={blocked}
                                                onClick={() =>
                                                    onOpenDocument(folderId, document)
                                                }
                                            >
                                                Xem
                                            </button>
                                            <WorkspaceMenu
                                                label={`Thao tác tài liệu ${document.originalName}`}
                                                disabled={blocked}
                                                items={[
                                                    {
                                                        label: 'Chi tiết',
                                                        onClick: () =>
                                                            onDetailDocument(
                                                                folderId,
                                                                document
                                                            ),
                                                    },
                                                    ...(ocr
                                                        ? [
                                                            {
                                                                label: 'Nhận dạng chữ',
                                                                disabled:
                                                                    status ===
                                                                    'PROCESSING',
                                                                onClick: () =>
                                                                    onRunDocumentOcr(
                                                                        folderId,
                                                                        document
                                                                    ),
                                                            },
                                                            {
                                                                label: 'Xem nội dung chữ',
                                                                onClick: () =>
                                                                    onShowDocumentText(
                                                                        folderId,
                                                                        document
                                                                    ),
                                                            },
                                                        ]
                                                        : []),
                                                    {
                                                        label: 'Sửa thông tin',
                                                        onClick: () =>
                                                            startEdit(document),
                                                    },
                                                    {
                                                        label: 'Đổi tên file',
                                                        onClick: () =>
                                                            onRenameDocument(
                                                                folderId,
                                                                document
                                                            ),
                                                    },
                                                    {
                                                        label: 'Di chuyển',
                                                        onClick: () =>
                                                            onMoveDocument(
                                                                folderId,
                                                                document
                                                            ),
                                                    },
                                                    {
                                                        label: 'Tải xuống',
                                                        onClick: () =>
                                                            onDownloadDocument(
                                                                folderId,
                                                                document
                                                            ),
                                                    },
                                                    {
                                                        label: 'Xóa mềm',
                                                        danger: true,
                                                        onClick: () =>
                                                            onDeleteDocument(
                                                                folderId,
                                                                document
                                                            ),
                                                    },
                                                ]}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                    </tbody>
                </table>
            </div>
            {editing && (
                <WorkspaceModal
                    title="Sửa thông tin văn bản"
                    busy={saving}
                    onClose={() => setEditing(null)}
                >
                    <form className="workspace-form" onSubmit={saveMetadata}>
                        <DocumentMetadataForm
                            value={metadata}
                            onChange={setMetadata}
                            disabled={saving}
                        />
                        {saveError && (
                            <p className="message error" role="alert">
                                {saveError}
                            </p>
                        )}
                        <div className="modal-footer">
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => setEditing(null)}
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                className="folders-primary"
                                disabled={saving}
                            >
                                {saving ? 'Đang lưu…' : 'Lưu thông tin'}
                            </button>
                        </div>
                    </form>
                </WorkspaceModal>
            )}
        </section>
    );
}
