import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import DocumentMetadataForm, {
    emptyMetadata,
} from './DocumentMetadataForm.jsx';

function displayDate(value) {
    if (!value) return '—';

    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
}

export default function DocumentList({
                                         folderId,
                                         reload,
                                         disabled = false,
                                         onBusyChange,
                                         onOpenDocument,
                                         onDetailDocument,
                                         onRenameDocument,
                                         onMoveDocument,
                                         onDeleteDocument,
                                         onDownloadDocument,
                                         onDocumentsChanged,
                                     }) {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [editingDocument, setEditingDocument] = useState(null);
    const [metadata, setMetadata] = useState(emptyMetadata);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [success, setSuccess] = useState('');

    const saveLock = useRef(false);

    // Lấy lại danh sách khi đổi thư mục hoặc reload thay đổi.
    useEffect(() => {
        let active = true;

        async function loadDocuments() {
            setDocuments([]);
            setError('');
            setEditingDocument(null);
            setSaveError('');
            setSuccess('');

            if (folderId == null) {
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                const data = await api.documents(folderId);

                if (!Array.isArray(data)) {
                    throw new Error(
                        'API danh sách tài liệu chưa trả về một mảng.'
                    );
                }

                if (active) {
                    setDocuments(data);
                }
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

        loadDocuments();

        return () => {
            active = false;
        };
    }, [folderId, reload]);

    // Mở form sửa metadata.
    function startEdit(document) {
        setSaveError('');
        setSuccess('');
        setEditingDocument(document);

        const value = emptyMetadata();

        for (const field of Object.keys(value)) {
            value[field] = document[field] ?? '';
        }

        setMetadata(value);
    }

    // Lưu metadata.
    async function saveMetadata(event) {
        event.preventDefault();

        if (saveLock.current || disabled || !editingDocument) {
            return;
        }

        setSaveError('');

        if (!metadata.title.trim()) {
            setSaveError('Nhập tên văn bản.');
            return;
        }

        saveLock.current = true;
        setSaving(true);
        onBusyChange?.(true);

        try {
            const saved = await api.updateDocumentMetadata(
                folderId,
                editingDocument.id,
                {
                    ...metadata,
                    title: metadata.title.trim(),
                }
            );

            setDocuments((previous) =>
                previous.map((document) =>
                    document.id === saved.id ? saved : document
                )
            );

            setEditingDocument(null);
            setSuccess('Đã lưu thông tin văn bản.');

            // Báo FoldersPage cập nhật danh sách và cây.
            onDocumentsChanged?.();
        } catch (err) {
            setSaveError(err.message);
        } finally {
            saveLock.current = false;
            setSaving(false);
            onBusyChange?.(false);
        }
    }

    if (folderId == null) {
        return null;
    }

    return (
        <section>
            <h2>Tài liệu trong thư mục</h2>

            {loading && <p>Đang tải tài liệu...</p>}

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

            {editingDocument && (
                <form
                    className="folders-form"
                    onSubmit={saveMetadata}
                >
                    <h3>
                        Sửa thông tin: {editingDocument.originalName}
                    </h3>

                    <DocumentMetadataForm
                        value={metadata}
                        onChange={setMetadata}
                        disabled={disabled || saving}
                    />

                    {saveError && (
                        <p className="message error" role="alert">
                            {saveError}
                        </p>
                    )}

                    <div className="folders-actions">
                        <button
                            type="submit"
                            className="folders-primary"
                            disabled={disabled || saving}
                        >
                            {saving ? 'Đang lưu...' : 'Lưu thông tin'}
                        </button>

                        <button
                            type="button"
                            disabled={disabled || saving}
                            onClick={() => {
                                setEditingDocument(null);
                                setSaveError('');
                            }}
                        >
                            Hủy
                        </button>
                    </div>
                </form>
            )}

            {!loading && !error && (
                documents.length === 0 ? (
                    <p>Chưa có tài liệu nào.</p>
                ) : (
                    <ul className="folders-list">
                        {documents.map((document) => (
                            <li
                                key={document.id}
                                className="folders-item"
                            >
                                <div className="folders-info">
                                    <span
                                        className="folders-icon"
                                        aria-hidden="true"
                                    >
                                        📄
                                    </span>

                                    <div
                                        style={{
                                            minWidth: 0,
                                            overflowWrap: 'anywhere',
                                        }}
                                    >
                                        <strong>
                                            {document.title ||
                                                document.originalName}
                                        </strong>

                                        <p>
                                            File: {document.originalName}
                                        </p>

                                        <p>
                                            Số hiệu:{' '}
                                            {document.documentNumber || '—'}
                                        </p>

                                        <p>
                                            Loại văn bản:{' '}
                                            {document.documentType || '—'}
                                        </p>

                                        <p>
                                            Ngày ban hành:{' '}
                                            {displayDate(document.issuedDate)}
                                        </p>

                                        <p>
                                            Đơn vị/người ban hành:{' '}
                                            {document.issuer || '—'}
                                        </p>

                                        <p>
                                            Từ khóa:{' '}
                                            {document.keywords || '—'}
                                        </p>

                                        <p style={{ whiteSpace: 'pre-wrap' }}>
                                            Mô tả:{' '}
                                            {document.description || '—'}
                                        </p>

                                        <p>
                                            Kích thước:{' '}
                                            {(document.size / 1024).toFixed(1)}
                                            {' '}KB
                                        </p>

                                        <p>
                                            Tải lên:{' '}
                                            {document.uploadedAt
                                                ? new Date(
                                                    document.uploadedAt
                                                ).toLocaleString('vi-VN')
                                                : '—'}
                                        </p>
                                    </div>
                                </div>

                                <div className="folders-actions">
                                    <button
                                        type="button"
                                        disabled={
                                            disabled ||
                                            saving ||
                                            !onOpenDocument
                                        }
                                        onClick={() =>
                                            onOpenDocument(folderId, document)
                                        }
                                    >
                                        Xem
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            disabled ||
                                            saving ||
                                            !onDetailDocument
                                        }
                                        onClick={() =>
                                            onDetailDocument(folderId, document)
                                        }
                                    >
                                        Chi tiết
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            disabled ||
                                            saving ||
                                            !onRenameDocument
                                        }
                                        onClick={() =>
                                            onRenameDocument(folderId, document)
                                        }
                                    >
                                        Đổi tên file
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            disabled ||
                                            saving ||
                                            !onMoveDocument
                                        }
                                        onClick={() =>
                                            onMoveDocument(folderId, document)
                                        }
                                    >
                                        Di chuyển
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            disabled ||
                                            saving ||
                                            !onDownloadDocument
                                        }
                                        onClick={() =>
                                            onDownloadDocument(
                                                folderId,
                                                document
                                            )
                                        }
                                    >
                                        Tải xuống
                                    </button>

                                    <button
                                        type="button"
                                        className="folders-danger"
                                        disabled={
                                            disabled ||
                                            saving ||
                                            !onDeleteDocument
                                        }
                                        onClick={() =>
                                            onDeleteDocument(folderId, document)
                                        }
                                    >
                                        Xóa
                                    </button>

                                    <button
                                        type="button"
                                        disabled={disabled || saving}
                                        onClick={() => startEdit(document)}
                                    >
                                        Sửa thông tin
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )
            )}
        </section>
    );
}