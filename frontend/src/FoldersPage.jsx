import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import FolderTree from './FolderTree.jsx';
import DocumentList from './DocumentList.jsx';
import DocumentMetadataForm, {
    emptyMetadata,
} from './DocumentMetadataForm.jsx';
import './FoldersPage.css';

const FOLDER_DRAG_TYPE = 'application/x-folder';

const OCR_STATUS_NAMES = {
    PENDING: 'Chưa chạy OCR',
    PROCESSING: 'Đang nhận dạng…',
    COMPLETED: 'Đã nhận dạng',
    FAILED: 'Nhận dạng thất bại',
};

function ocrStatusName(status) {
    return OCR_STATUS_NAMES[status] ?? 'Chưa có trạng thái';
}

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

    // Form bên phải chỉ dùng để sửa thư mục.
    const [showForm, setShowForm] = useState(false);
    const [editingFolder, setEditingFolder] = useState(null);
    const [name, setName] = useState('');

    // Yêu cầu cây mở form tạo tại thư mục được chọn.
    const [treeCreateRequest, setTreeCreateRequest] = useState(null);
    const treeCreateVersion = useRef(0);
    const folderCreateLock = useRef(false);

    const [draggedFolder, setDraggedFolder] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);

    const [file, setFile] = useState(null);
    const [metadata, setMetadata] = useState(emptyMetadata);
    const [uploadError, setUploadError] = useState('');
    const [uploadSuccess, setUploadSuccess] = useState('');

    const [preview, setPreview] = useState(null);
    const [selectedDocumentId, setSelectedDocumentId] = useState(null);
    const documentSelectionVersion = useRef(0);

    const [documentAction, setDocumentAction] = useState(null);
    const [documentName, setDocumentName] = useState('');
    const [destinationFolders, setDestinationFolders] = useState([]);
    const [targetFolderId, setTargetFolderId] = useState('');

    const [ocrText, setOcrText] = useState('');
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrError, setOcrError] = useState('');

    const documentLock = useRef(false);
    const fileInputRef = useRef(null);
    const moveLock = useRef(false);
    const uploadLock = useRef(false);

    const currentFolder = path[path.length - 1];
    const parentId = currentFolder?.id ?? null;

    const actionDisabled =
        busy ||
        loading ||
        showForm ||
        Boolean(documentAction);

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
        setMetadata(emptyMetadata());
        setUploadError('');
        setUploadSuccess('');

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [parentId]);

    useEffect(() => {
        if (!preview) return;

        return () => {
            URL.revokeObjectURL(preview.url);
        };
    }, [preview]);

    function clearMessages() {
        setError('');
        setSuccess('');
    }

    function closeForm() {
        setShowForm(false);
        setEditingFolder(null);
        setName('');
    }

    // Nút bên phải chỉ yêu cầu cây mở form tạo thư mục.
    function startCreate() {
        if (
            actionDisabled ||
            moveLock.current ||
            folderCreateLock.current
        ) {
            return;
        }

        clearDocumentSelection();
        clearMessages();

        treeCreateVersion.current += 1;

        setTreeCreateRequest({
            version: treeCreateVersion.current,
            folderId: parentId,
            ancestorIds: path.map((folder) => folder.id),
        });
    }

    function clearTreeCreateRequest() {
        setTreeCreateRequest(null);
    }

    // Form trong cây gọi hàm này để lưu thư mục mới.
    async function createFolderFromTree(folderName, targetParentId) {
        if (
            actionDisabled ||
            moveLock.current ||
            folderCreateLock.current
        ) {
            throw new Error(
                'Đang xử lý thao tác khác. Vui lòng thử lại.'
            );
        }

        folderCreateLock.current = true;
        clearDocumentSelection();
        clearMessages();
        setBusy(true);

        try {
            await api.createFolder(folderName, targetParentId);

            setTreeCreateRequest(null);
            setReload((value) => value + 1);
        } finally {
            folderCreateLock.current = false;
            setBusy(false);
        }
    }

    function startEdit(folder) {
        if (actionDisabled) return;

        clearMessages();
        setEditingFolder(folder);
        setName(folder.name);
        setShowForm(true);
    }

    // Chỉ lưu thay đổi tên thư mục.
    async function saveFolder(event) {
        event.preventDefault();

        if (!editingFolder || busy) {
            return;
        }

        clearMessages();

        const folderName = name.trim();

        if (!folderName) {
            setError('Nhập tên thư mục.');
            return;
        }

        setBusy(true);

        try {
            await api.updateFolder(
                editingFolder.id,
                folderName,
                editingFolder.parentId
            );

            setSuccess('Đã sửa thư mục.');
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
        clearDocumentSelection();
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

    async function openFolderFromTree(folder) {
        if (actionDisabled || moveLock.current) {
            return;
        }

        clearDocumentSelection();
        clearMessages();
        setBusy(true);

        try {
            const nextPath = [];
            const visited = new Set();
            let id = folder.id;

            while (id != null) {
                if (visited.has(id)) {
                    throw new Error('Cấu trúc thư mục bị vòng lặp.');
                }

                visited.add(id);

                const data = await api.getFolder(id);

                nextPath.unshift(data);
                id = data.parentId ?? null;
            }

            closeForm();
            setPath(nextPath);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function selectDocumentFromTree(folderId, document) {
        if (
            busy ||
            showForm ||
            documentAction ||
            documentLock.current ||
            moveLock.current
        ) {
            return;
        }

        const version = ++documentSelectionVersion.current;

        setSelectedDocumentId(document.id);
        clearMessages();

        if (parentId === folderId) {
            return;
        }

        try {
            const nextPath = [];
            const visited = new Set();
            let id = folderId;

            while (id != null) {
                if (visited.has(id)) {
                    throw new Error('Cấu trúc thư mục bị vòng lặp.');
                }

                visited.add(id);

                const folder = await api.getFolder(id);

                if (version !== documentSelectionVersion.current) {
                    return;
                }

                nextPath.unshift(folder);
                id = folder.parentId ?? null;
            }

            closeForm();
            setPath(nextPath);
        } catch (err) {
            if (version === documentSelectionVersion.current) {
                setError(err.message);
            }
        }
    }

    function clearDocumentSelection() {
        documentSelectionVersion.current += 1;
        setSelectedDocumentId(null);
    }

    async function openDocument(folderId, document) {
        if (
            busy ||
            showForm ||
            documentAction ||
            documentLock.current ||
            moveLock.current
        ) {
            return;
        }

        clearMessages();
        setBusy(true);

        try {
            const blob = await api.documentContent(
                folderId,
                document.id
            );

            const url = URL.createObjectURL(blob);

            setPreview({
                url,
                title: document.title || document.originalName,
                originalName: document.originalName,
                mimeType: blob.type || document.mimeType,
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    function refreshDocuments() {
        setDocumentsReload((value) => value + 1);
    }

    async function runDocumentAction(operation) {
        if (
            documentLock.current ||
            busy ||
            loading ||
            showForm ||
            moveLock.current
        ) {
            return;
        }

        documentLock.current = true;
        clearMessages();
        setBusy(true);

        try {
            await operation();
        } catch (err) {
            setError(err.message);
        } finally {
            documentLock.current = false;
            setBusy(false);
        }
    }

    async function loadDocumentText(folderId, document, run) {
        await runDocumentAction(async () => {
            setOcrText('');
            setOcrError('');
            setOcrLoading(true);

            setDocumentAction({
                type: 'ocr',
                mode: run ? 'run' : 'view',
                folderId,
                document: {
                    ...document,
                    ocrStatus: run ? null : document.ocrStatus,
                    ocrError: run ? null : document.ocrError,
                },
            });

            let errorMessage = '';

            try {
                const data = run
                    ? await api.runOcr(folderId, document.id)
                    : await api.getExtractedText(folderId, document.id);

                const text = typeof data === 'string'
                    ? data
                    : data?.text ?? '';

                setOcrText(text);

            } catch (err) {
                errorMessage = err.message || 'Không thể lấy nội dung OCR.';

            } finally {
                try {
                    // Luôn lấy lại trạng thái đã lưu, kể cả khi OCR thất bại.
                    const detail = await api.documentDetail(
                        folderId,
                        document.id
                    );

                    setDocumentAction((current) => {
                        if (
                            current?.type !== 'ocr' ||
                            current.folderId !== folderId ||
                            current.document.id !== document.id
                        ) {
                            return current;
                        }

                        return {
                            ...current,
                            document: detail,
                        };
                    });

                } catch (err) {
                    const detailError =
                        'Không tải được trạng thái OCR mới nhất. ' +
                        (err.message || '');

                    errorMessage = errorMessage
                        ? `${errorMessage}\n${detailError}`
                        : detailError;
                }

                setOcrError(errorMessage);
                setOcrLoading(false);

                if (run) {
                    refreshDocuments();
                }
            }
        });
    }

    async function runDocumentOcr(folderId, document) {
        if (actionDisabled || documentLock.current) return;

        await loadDocumentText(folderId, document, true);
    }

    async function showDocumentText(folderId, document) {
        if (actionDisabled || documentLock.current) return;

        await loadDocumentText(folderId, document, false);
    }

    async function retryDocumentText() {
        if (documentAction?.type !== 'ocr') return;

        const action = documentAction;

        await loadDocumentText(
            action.folderId,
            action.document,
            action.mode === 'run'
        );
    }

    async function rerunDocumentOcr() {
        if (documentAction?.type !== 'ocr') return;

        const action = documentAction;

        await loadDocumentText(
            action.folderId,
            action.document,
            true
        );
    }

    function canRunOcr(document) {
        return (
            document.mimeType?.startsWith('image/') ||
            document.mimeType === 'application/pdf' ||
            /\.(pdf|png|jpe?g|bmp|tiff?|webp)$/i.test(
                document.originalName ?? ''
            )
        );
    }

    async function showDocumentDetail(folderId, document) {
        if (actionDisabled) return;

        await runDocumentAction(async () => {
            const detail = await api.documentDetail(
                folderId,
                document.id
            );

            setDocumentAction({
                type: 'detail',
                folderId,
                document: detail,
            });
        });
    }

    function startRenameDocument(folderId, document) {
        if (actionDisabled || documentLock.current) {
            return;
        }

        clearMessages();
        setDocumentName(document.originalName);

        setDocumentAction({
            type: 'rename',
            folderId,
            document,
        });
    }

    async function saveDocumentName(event) {
        event.preventDefault();

        if (documentAction?.type !== 'rename') {
            return;
        }

        const originalName = documentName.trim();

        if (!originalName) {
            setError('Nhập tên file, bao gồm phần mở rộng.');
            return;
        }

        const action = documentAction;

        await runDocumentAction(async () => {
            await api.renameDocument(
                action.folderId,
                action.document.id,
                originalName
            );

            setDocumentAction(null);
            setPreview(null);
            refreshDocuments();
            setSuccess('Đã đổi tên file.');
        });
    }

    async function loadDestinationFolders() {
        const result = [];
        const visited = new Set();

        const queue = [
            { parentId: null, prefix: '' },
        ];

        for (let index = 0; index < queue.length; index += 1) {
            const item = queue[index];
            const children = await api.folders(item.parentId);

            if (!Array.isArray(children)) {
                throw new Error(
                    'API danh sách thư mục chưa trả về một mảng.'
                );
            }

            for (const folder of children) {
                if (visited.has(folder.id)) {
                    continue;
                }

                visited.add(folder.id);

                const label = item.prefix
                    ? `${item.prefix} / ${folder.name}`
                    : folder.name;

                result.push({
                    id: folder.id,
                    label,
                });

                queue.push({
                    parentId: folder.id,
                    prefix: label,
                });
            }
        }

        return result;
    }

    async function startMoveDocument(folderId, document) {
        if (actionDisabled) return;

        await runDocumentAction(async () => {
            const choices = await loadDestinationFolders();

            setDestinationFolders(
                choices.filter((folder) => folder.id !== folderId)
            );

            setTargetFolderId('');

            setDocumentAction({
                type: 'move',
                folderId,
                document,
            });
        });
    }

    async function saveDocumentMove(event) {
        event.preventDefault();

        if (documentAction?.type !== 'move') {
            return;
        }

        if (!targetFolderId) {
            setError('Chọn thư mục đích.');
            return;
        }

        const action = documentAction;

        await runDocumentAction(async () => {
            await api.moveDocument(
                action.folderId,
                action.document.id,
                Number(targetFolderId)
            );

            setDocumentAction(null);
            setPreview(null);
            refreshDocuments();

            setSelectedDocumentId((previous) =>
                previous === action.document.id ? null : previous
            );

            setSuccess('Đã chuyển tài liệu sang thư mục đích.');
        });
    }

    async function deleteDocument(folderId, document) {
        if (actionDisabled || documentLock.current) {
            return;
        }

        if (
            !window.confirm(
                `Xóa tài liệu "${document.originalName}"?`
            )
        ) {
            return;
        }

        await runDocumentAction(async () => {
            await api.deleteDocument(folderId, document.id);

            setPreview(null);
            refreshDocuments();

            setSelectedDocumentId((previous) =>
                previous === document.id ? null : previous
            );

            setSuccess('Đã xóa mềm tài liệu.');
        });
    }

    async function permanentDeleteDocument(folderId, document) {
        if (
            actionDisabled ||
            documentLock.current ||
            moveLock.current
        ) {
            return;
        }

        if (
            !window.confirm(
                `Xóa vĩnh viễn "${document.originalName}"?\n` +
                'Bản ghi và file sẽ bị xóa, không thể khôi phục bằng ứng dụng.'
            )
        ) {
            return;
        }

        await runDocumentAction(async () => {
            try {
                await api.permanentDeleteDocument(
                    folderId,
                    document.id
                );
            } finally {
                setPreview(null);

                setSelectedDocumentId((previous) =>
                    previous === document.id ? null : previous
                );

                refreshDocuments();
            }

            setSuccess('Đã xóa vĩnh viễn tài liệu.');
        });
    }

    async function downloadDocument(folderId, item) {
        if (actionDisabled) return;

        await runDocumentAction(async () => {
            const blob = await api.downloadDocument(
                folderId,
                item.id
            );

            const url = URL.createObjectURL(blob);
            const link = window.document.createElement('a');

            link.href = url;
            link.download = item.originalName;

            window.document.body.appendChild(link);

            try {
                link.click();
            } finally {
                link.remove();

                window.setTimeout(
                    () => URL.revokeObjectURL(url),
                    60000
                );
            }

            setSuccess('Đã gửi file cho trình duyệt tải xuống.');
        });
    }

    function closeDocumentAction() {
        if (busy || documentLock.current) {
            return;
        }

        setDocumentAction(null);
        setOcrText('');
        setOcrError('');
        setError('');
    }

    function goBack() {
        clearDocumentSelection();
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
            setUploadError(
                'Mở một thư mục trước khi tải tài liệu lên.'
            );
            return;
        }

        if (!file) {
            setUploadError('Chọn file cần tải lên.');
            return;
        }

        if (!metadata.title.trim()) {
            setUploadError('Nhập tên văn bản.');
            return;
        }

        const selectedFile = file;

        uploadLock.current = true;
        setBusy(true);

        try {
            await api.uploadDocument(
                parentId,
                selectedFile,
                {
                    ...metadata,
                    title: metadata.title.trim(),
                }
            );

            setUploadSuccess(
                `Đã tải lên file "${selectedFile.name}".`
            );

            setFile(null);
            setMetadata(emptyMetadata());

            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

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

        if (!raw) return;

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

            clearDocumentSelection();
            setTreeCreateRequest(null);
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

        selectedFolderId: parentId,
        selectedDocumentId,

        documentDisabled:
            busy || showForm || Boolean(documentAction),

        documentsReload,

        createRequest: treeCreateRequest,
        onClearCreateRequest: clearTreeCreateRequest,
        onCreateFolder: createFolderFromTree,

        onSelectDocument: selectDocumentFromTree,
        onOpen: openFolderFromTree,
        onOpenDocument: openDocument,

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
                            reload={reload}
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
                                                event.target.files?.[0] ??
                                                null
                                            );

                                            setUploadError('');
                                            setUploadSuccess('');
                                        }}
                                    />

                                    <DocumentMetadataForm
                                        value={metadata}
                                        onChange={setMetadata}
                                        disabled={actionDisabled}
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
                                    key={parentId}
                                    folderId={parentId}
                                    selectedDocumentId={selectedDocumentId}
                                    reload={documentsReload}
                                    disabled={actionDisabled}
                                    onBusyChange={setBusy}
                                    onOpenDocument={openDocument}
                                    onDetailDocument={showDocumentDetail}
                                    onRenameDocument={startRenameDocument}
                                    onMoveDocument={startMoveDocument}
                                    onDeleteDocument={deleteDocument}
                                    onPermanentDeleteDocument={
                                        permanentDeleteDocument
                                    }
                                    onDownloadDocument={downloadDocument}
                                    onRunDocumentOcr={runDocumentOcr}
                                    onShowDocumentText={showDocumentText}
                                    onDocumentsChanged={refreshDocuments}
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

                        {/* Bên phải chỉ giữ form sửa thư mục. */}
                        {showForm && editingFolder && (
                            <form
                                className="folders-form"
                                onSubmit={saveFolder}
                            >
                                <h2>Sửa thư mục</h2>

                                <label htmlFor="folderName">
                                    Tên thư mục
                                </label>

                                <input
                                    id="folderName"
                                    autoFocus
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
                                <p
                                    className="message error"
                                    role="alert"
                                >
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
                                                    dropTarget ===
                                                    String(folder.id)
                                                        ? '#dbeafe'
                                                        : undefined,
                                                opacity:
                                                    draggedFolder?.id ===
                                                    folder.id
                                                        ? 0.45
                                                        : 1,
                                                cursor: actionDisabled
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

            {documentAction && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1100,
                        background: 'rgba(0,0,0,0.55)',
                        padding: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            closeDocumentAction();
                        }
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="document-action-title"
                        style={{
                            background: '#fff',
                            borderRadius: '12px',
                            padding: '20px',
                            width: 'min(650px, 100%)',
                            maxHeight: '85vh',
                            overflow: 'auto',
                            overflowWrap: 'anywhere',
                        }}
                    >
                        <h2 id="document-action-title">
                            {documentAction.type === 'detail'
                                ? 'Chi tiết tài liệu'
                                : documentAction.type === 'rename'
                                    ? 'Đổi tên file'
                                    : documentAction.type === 'ocr'
                                        ? 'Nội dung chữ của tài liệu'
                                        : 'Di chuyển tài liệu'}
                        </h2>

                        {documentAction.type === 'detail' && (
                            <dl>
                                {[
                                    [
                                        'Tên văn bản',
                                        documentAction.document.title,
                                    ],
                                    [
                                        'Tên file',
                                        documentAction.document.originalName,
                                    ],
                                    [
                                        'Số hiệu',
                                        documentAction.document.documentNumber,
                                    ],
                                    [
                                        'Loại văn bản',
                                        documentAction.document.documentType,
                                    ],
                                    [
                                        'Ngày ban hành',
                                        documentAction.document.issuedDate
                                            ? new Date(
                                                documentAction.document.issuedDate
                                            ).toLocaleDateString('vi-VN')
                                            : null,
                                    ],
                                    [
                                        'Đơn vị/người ban hành',
                                        documentAction.document.issuer,
                                    ],
                                    [
                                        'Từ khóa',
                                        documentAction.document.keywords,
                                    ],
                                    [
                                        'Mô tả',
                                        documentAction.document.description,
                                    ],
                                    [
                                        'Trạng thái OCR',
                                        ocrStatusName(
                                            documentAction.document.ocrStatus
                                        ),
                                    ],
                                    [
                                        'Lỗi OCR gần nhất',
                                        documentAction.document.ocrError,
                                    ],
                                    [
                                        'Định dạng file',
                                        documentAction.document.mimeType,
                                    ],
                                    [
                                        'Dung lượng',
                                        `${
                                            (
                                                documentAction.document.size /
                                                1024
                                            ).toFixed(1)
                                        } KB`,
                                    ],
                                    [
                                        'Tải lên',
                                        documentAction.document.uploadedAt
                                            ? new Date(
                                                documentAction.document.uploadedAt
                                            ).toLocaleString('vi-VN')
                                            : null,
                                    ],
                                ].map(([label, value]) => (
                                    <div
                                        key={label}
                                        style={{ marginBottom: '12px' }}
                                    >
                                        <dt>
                                            <strong>{label}</strong>
                                        </dt>

                                        <dd
                                            style={{
                                                margin: 0,
                                                whiteSpace: 'pre-wrap',
                                            }}
                                        >
                                            {value || '—'}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        )}

                        {documentAction.type === 'ocr' && (
                            <div>
                                <p>
                                    File: {documentAction.document.originalName}
                                </p>

                                <p role="status" aria-live="polite">
                                    <strong>Trạng thái OCR: </strong>

                                    {ocrLoading && documentAction.mode === 'run'
                                        ? 'Đang nhận dạng…'
                                        : ocrStatusName(
                                            documentAction.document.ocrStatus
                                        )}
                                </p>

                                {ocrLoading && (
                                    <p role="status">
                                        {documentAction.mode === 'run'
                                            ? 'Đang nhận dạng chữ, vui lòng chờ…'
                                            : 'Đang lấy nội dung và trạng thái OCR…'}
                                    </p>
                                )}

                                {/* Lỗi OCR đã lưu trong database. */}
                                {documentAction.document.ocrStatus === 'FAILED' &&
                                    documentAction.document.ocrError && (
                                        <p
                                            className="message error"
                                            role="alert"
                                            style={{ whiteSpace: 'pre-wrap' }}
                                        >
                                            <strong>Lỗi OCR: </strong>
                                            {documentAction.document.ocrError}
                                        </p>
                                    )}

                                {/* Không hiển thị trùng với lỗi đã lưu. */}
                                {ocrError &&
                                    ocrError !== documentAction.document.ocrError && (
                                        <p
                                            className="message error"
                                            role="alert"
                                            style={{ whiteSpace: 'pre-wrap' }}
                                        >
                                            {ocrError}
                                        </p>
                                    )}

                                {!ocrLoading && ocrText.trim() && (
                                    <>
                                        <label htmlFor="document-ocr-text">
                                            Nội dung văn bản đã lưu
                                        </label>

                                        <textarea
                                            id="document-ocr-text"
                                            readOnly
                                            value={ocrText}
                                            style={{
                                                width: '100%',
                                                minHeight: '320px',
                                                boxSizing: 'border-box',
                                                margin: '12px 0',
                                                padding: '12px',
                                                resize: 'vertical',
                                                lineHeight: 1.6,
                                            }}
                                        />
                                    </>
                                )}

                                {!ocrLoading && !ocrError && !ocrText.trim() && (
                                    <p>
                                        {documentAction.document.ocrStatus === 'FAILED'
                                            ? 'Lần nhận dạng gần nhất thất bại. Bạn có thể chạy lại OCR.'
                                            : documentAction.document.ocrStatus === 'PROCESSING'
                                                ? 'Tài liệu đang được xử lý. Bấm cập nhật để xem trạng thái mới.'
                                                : 'Chưa có nội dung chữ được lưu.'}
                                    </p>
                                )}

                                {!ocrLoading && ocrError &&
                                    documentAction.document.ocrStatus !== 'PROCESSING' && (
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={retryDocumentText}
                                        >
                                            Thử lại
                                        </button>
                                    )}

                                {documentAction.document.ocrStatus === 'PROCESSING' && (
                                    <button
                                        type="button"
                                        disabled={busy || ocrLoading}
                                        onClick={() =>
                                            loadDocumentText(
                                                documentAction.folderId,
                                                documentAction.document,
                                                false
                                            )
                                        }
                                    >
                                        Cập nhật trạng thái
                                    </button>
                                )}

                                {canRunOcr(documentAction.document) && (
                                    <button
                                        type="button"
                                        className="folders-primary"
                                        disabled={
                                            busy ||
                                            ocrLoading ||
                                            documentAction.document.ocrStatus === 'PROCESSING'
                                        }
                                        onClick={rerunDocumentOcr}
                                        style={{ margin: '12px 0' }}
                                    >
                                        {ocrLoading && documentAction.mode === 'run'
                                            ? 'Đang nhận dạng…'
                                            : documentAction.document.ocrStatus === 'PROCESSING'
                                                ? 'Đang xử lý OCR'
                                                : documentAction.document.ocrStatus === 'FAILED'
                                                    ? 'Chạy lại OCR'
                                                    : documentAction.document.ocrStatus === 'COMPLETED'
                                                        ? 'Nhận dạng lại'
                                                        : 'Nhận dạng chữ'}
                                    </button>
                                )}
                            </div>
                        )}

                        {documentAction.type === 'rename' && (
                            <form
                                className="folders-form"
                                onSubmit={saveDocumentName}
                            >
                                <label htmlFor="document-new-name">
                                    Tên file mới
                                </label>

                                <input
                                    autoFocus
                                    id="document-new-name"
                                    value={documentName}
                                    maxLength={255}
                                    required
                                    disabled={busy}
                                    onChange={(event) =>
                                        setDocumentName(event.target.value)
                                    }
                                />

                                <p>
                                    Giữ nguyên đuôi file,
                                    ví dụ: BaoCaoMoi.pdf.
                                </p>

                                <button
                                    type="submit"
                                    disabled={busy}
                                    className="folders-primary"
                                >
                                    {busy
                                        ? 'Đang lưu...'
                                        : 'Lưu tên mới'}
                                </button>
                            </form>
                        )}

                        {documentAction.type === 'move' && (
                            <form
                                className="folders-form"
                                onSubmit={saveDocumentMove}
                            >
                                <p>
                                    File:{' '}
                                    {documentAction.document.originalName}
                                </p>

                                <label htmlFor="document-target-folder">
                                    Thư mục đích
                                </label>

                                <select
                                    autoFocus
                                    id="document-target-folder"
                                    value={targetFolderId}
                                    required
                                    disabled={
                                        busy ||
                                        destinationFolders.length === 0
                                    }
                                    onChange={(event) =>
                                        setTargetFolderId(event.target.value)
                                    }
                                >
                                    <option value="">
                                        Chọn thư mục
                                    </option>

                                    {destinationFolders.map((folder) => (
                                        <option
                                            key={folder.id}
                                            value={folder.id}
                                        >
                                            {folder.label}
                                        </option>
                                    ))}
                                </select>

                                {destinationFolders.length === 0 && (
                                    <p>
                                        Chưa có thư mục khác.
                                        Tạo một thư mục trước khi di chuyển.
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    className="folders-primary"
                                    disabled={busy || !targetFolderId}
                                >
                                    {busy
                                        ? 'Đang chuyển...'
                                        : 'Xác nhận di chuyển'}
                                </button>
                            </form>
                        )}

                        {error && (
                            <p className="message error" role="alert">
                                {error}
                            </p>
                        )}

                        <button
                            type="button"
                            autoFocus={
                                ['detail', 'ocr'].includes(documentAction.type)
                            }
                            disabled={busy}
                            onClick={closeDocumentAction}
                        >
                            {['detail', 'ocr'].includes(documentAction.type)
                                ? 'Đóng'
                                : 'Hủy'}
                        </button>
                    </section>
                </div>
            )}

            {preview && (
                <div
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            setPreview(null);
                        }
                    }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        background: 'rgba(0,0,0,0.55)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="document-preview-title"
                        style={{
                            width: 'min(1100px, 100%)',
                            height: '85vh',
                            background: '#fff',
                            borderRadius: '12px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            boxSizing: 'border-box',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px',
                                marginBottom: '12px',
                            }}
                        >
                            <h2
                                id="document-preview-title"
                                style={{
                                    margin: 0,
                                    overflowWrap: 'anywhere',
                                }}
                            >
                                {preview.title}
                            </h2>

                            <div
                                style={{
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <a
                                    href={preview.url}
                                    download={preview.originalName}
                                >
                                    Tải xuống
                                </a>

                                <button
                                    autoFocus
                                    type="button"
                                    onClick={() => setPreview(null)}
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>

                        <div
                            style={{
                                flex: 1,
                                minHeight: 0,
                                overflow: 'auto',
                            }}
                        >
                            {['image/jpeg', 'image/png'].includes(
                                preview.mimeType
                            ) ? (
                                <img
                                    src={preview.url}
                                    alt={preview.title}
                                    style={{
                                        display: 'block',
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        objectFit: 'contain',
                                        margin: '0 auto',
                                    }}
                                />
                            ) : preview.mimeType === 'application/pdf' ? (
                                <iframe
                                    src={preview.url}
                                    title={preview.title}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        border: 0,
                                    }}
                                />
                            ) : (
                                <p>
                                    File Word chưa hỗ trợ xem trực tiếp.
                                    Bấm “Tải xuống” để mở bằng Word.
                                </p>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
}
