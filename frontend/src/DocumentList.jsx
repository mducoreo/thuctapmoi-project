import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import DocumentMetadataForm, {
    emptyMetadata,
} from './DocumentMetadataForm.jsx';

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
                                         onPermanentDeleteDocument,
                                         onDownloadDocument,
                                         onRunDocumentOcr,
                                         onShowDocumentText,
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

    // Lấy danh sách khi đổi thư mục hoặc reload thay đổi.
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

    // Kiểm tra tài liệu có phải ảnh hoặc PDF để hiện nút OCR.
    function canRunOcr(document) {
        return (
            document.mimeType?.startsWith('image/') ||
            document.mimeType === 'application/pdf' ||
            /\.(pdf|png|jpe?g|bmp|tiff?|webp)$/i.test(
                document.originalName ?? ''
            )
        );
    }

    // Mở form sửa metadata.
    function startEdit(document) {
        if (disabled || saving || saveLock.current) {
            return;
        }

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

            {/* Metadata chỉ hiện trong form khi bấm Sửa thông tin. */}
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
                                style={{
                                    padding: '10px 12px',
                                    gap: '12px',
                                    flexWrap: 'wrap',
                                    background:
                                        selectedDocumentId === document.id
                                            ? '#eff6ff'
                                            : undefined,
                                    outline:
                                        selectedDocumentId === document.id
                                            ? '1px solid #93c5fd'
                                            : undefined,
                                }}
                            >
                                {/* Chỉ hiện tên và loại file. */}
                                <div
                                    className="folders-info"
                                    style={{
                                        flex: '1 1 180px',
                                        minWidth: 0,
                                    }}
                                >
                                    <span
                                        className="folders-icon"
                                        aria-hidden="true"
                                    >
                                        📄
                                    </span>

                                    <div style={{ minWidth: 0 }}>
                                        <strong
                                            title={
                                                document.originalName ||
                                                document.title
                                            }
                                            style={{
                                                display: 'block',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {document.originalName ||
                                                document.title}
                                        </strong>

                                        <small style={{ color: '#64748b' }}>
                                            {document.originalName
                                                ?.split('.')
                                                .pop()
                                                ?.toUpperCase() || 'FILE'}
                                        </small>
                                    </div>
                                </div>

                                <div
                                    className="folders-actions"
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '6px',
                                    }}
                                >
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

                                    {canRunOcr(document) && (
                                        <button
                                            type="button"
                                            disabled={
                                                disabled ||
                                                saving ||
                                                !onRunDocumentOcr
                                            }
                                            onClick={() =>
                                                onRunDocumentOcr(
                                                    folderId,
                                                    document
                                                )
                                            }
                                        >
                                            Nhận dạng chữ
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        disabled={
                                            disabled ||
                                            saving ||
                                            !onShowDocumentText
                                        }
                                        onClick={() =>
                                            onShowDocumentText(
                                                folderId,
                                                document
                                            )
                                        }
                                    >
                                        Xem chữ
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
                                        Xóa mềm
                                    </button>

                                    <button
                                        type="button"
                                        className="folders-danger"
                                        disabled={
                                            disabled ||
                                            saving ||
                                            !onPermanentDeleteDocument
                                        }
                                        onClick={() =>
                                            onPermanentDeleteDocument(
                                                folderId,
                                                document
                                            )
                                        }
                                    >
                                        Xóa vĩnh viễn
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