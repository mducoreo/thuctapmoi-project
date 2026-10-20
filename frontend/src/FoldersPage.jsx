import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import FolderTree from './FolderTree.jsx';
import DocumentList from './DocumentList.jsx';
import DocumentMetadataForm, { emptyMetadata } from './DocumentMetadataForm.jsx';
import WorkspaceModal from './WorkspaceModal.jsx';
import WorkspaceMenu from './WorkspaceMenu.jsx';
import OcrTextViewer from './OcrTextViewer.jsx';
import DocumentPreview from './DocumentPreview.jsx';
import './FoldersPage.css';

const FOLDER_DRAG_TYPE = 'application/x-folder';
const FOLDERS_VIEW_KEY = 'foldersPageView';
const SEARCH_VIEW_PREFIX = 'foldersPageSearch:';

const OCR_STATUS_NAMES = {
    PENDING: 'Chưa chạy OCR',
    PROCESSING: 'Đang nhận dạng…',
    COMPLETED: 'Đã nhận dạng',
    FAILED: 'Nhận dạng thất bại',
};

function ocrStatusName(status) {
    return OCR_STATUS_NAMES[status] ?? 'Chưa có trạng thái';
}

function readSessionValue(key) {
    try {
        return JSON.parse(sessionStorage.getItem(key) || 'null');
    } catch {
        return null;
    }
}

function writeSessionValue(key, value) {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Vẫn sử dụng được trang nếu trình duyệt không cho lưu.
    }
}

function readFoldersView() {
    const saved = readSessionValue(FOLDERS_VIEW_KEY);

    const validPath =
        Array.isArray(saved?.path) &&
        saved.path.every(
            (folder) =>
                folder &&
                Number.isInteger(folder.id) &&
                typeof folder.name === 'string'
        );

    return {
        path: validPath ? saved.path : [],
        searchOpen: saved?.searchOpen === true,
        sidebarCollapsed: saved?.sidebarCollapsed === true,
    };
}

export default function FoldersPage({ onLogout }) {
    const [savedView] = useState(readFoldersView);

    const [folders, setFolders] = useState([]);
    const [path, setPath] = useState(savedView.path);
    const [reload, setReload] = useState(0);
    const [documentsReload, setDocumentsReload] = useState(0);
    const [searchOpen, setSearchOpen] = useState(savedView.searchOpen);

    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form đổi tên thư mục.
    const [showForm, setShowForm] = useState(false);
    const [editingFolder, setEditingFolder] = useState(null);
    const [name, setName] = useState('');

    // Yêu cầu cây mở form tạo thư mục.
    const [treeCreateRequest, setTreeCreateRequest] = useState(null);
    const treeCreateVersion = useRef(0);
    const folderCreateLock = useRef(false);

    const [draggedFolder, setDraggedFolder] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);

    const [uploadOpen, setUploadOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(
        savedView.sidebarCollapsed
    );
    const [folderMove, setFolderMove] = useState(null);
    const [folderMoveTarget, setFolderMoveTarget] = useState('root');
    const [file, setFile] = useState(null);
    const [metadata, setMetadata] = useState(emptyMetadata);
    const [uploadError, setUploadError] = useState('');
    const [uploadSuccess, setUploadSuccess] = useState('');

    // Thông tin tài liệu cần mở trong DocumentPreview.
    const [preview, setPreview] = useState(null);
    const [selectedDocumentId, setSelectedDocumentId] = useState(null);
    const documentSelectionVersion = useRef(0);

    const [documentAction, setDocumentAction] = useState(null);
    const [documentName, setDocumentName] = useState('');
    const [destinationFolders, setDestinationFolders] = useState([]);
    const [targetFolderId, setTargetFolderId] = useState('');

    // Nội dung OCR đang xem và chỉnh sửa.
    const [ocrText, setOcrText] = useState('');
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrError, setOcrError] = useState('');
    const [ocrSavedText, setOcrSavedText] = useState('');
    const [ocrTextLoaded, setOcrTextLoaded] = useState(false);
    const [ocrSaving, setOcrSaving] = useState(false);
    const [ocrSaveError, setOcrSaveError] = useState('');
    const [ocrSaveSuccess, setOcrSaveSuccess] = useState('');

    const ocrDirty = ocrTextLoaded && ocrText !== ocrSavedText;

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
        Boolean(documentAction) ||
        uploadOpen ||
        Boolean(folderMove) ||
        Boolean(preview);

    // Khôi phục vị trí đang xem khi tải lại trang.
    useEffect(() => {
        writeSessionValue(FOLDERS_VIEW_KEY, {
            path,
            searchOpen,
            sidebarCollapsed,
        });
    }, [path, searchOpen, sidebarCollapsed]);

    function handleLogout() {
        try {
            sessionStorage.removeItem(FOLDERS_VIEW_KEY);

            const searchKeys = Object.keys(sessionStorage).filter(
                (key) => key.startsWith(SEARCH_VIEW_PREFIX)
            );

            searchKeys.forEach((key) => sessionStorage.removeItem(key));
        } catch {
            // Vẫn tiếp tục đăng xuất nếu không truy cập được bộ nhớ.
        }

        onLogout();
    }

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

        setUploadOpen(false);
    }, [parentId]);

    // Nhắc khi rời trang nếu nội dung OCR chưa lưu.
    useEffect(() => {
        if (!ocrDirty && !ocrSaving) {
            return;
        }

        function warnBeforeLeaving(event) {
            event.preventDefault();
            event.returnValue = '';
        }

        window.addEventListener('beforeunload', warnBeforeLeaving);

        return () => {
            window.removeEventListener('beforeunload', warnBeforeLeaving);
        };
    }, [ocrDirty, ocrSaving]);

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
        if (actionDisabled || moveLock.current || folderCreateLock.current) {
            return;
        }

        setSidebarCollapsed(false);
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

    async function createFolderFromTree(folderName, targetParentId) {
        if (actionDisabled || moveLock.current || folderCreateLock.current) {
            throw new Error('Đang xử lý thao tác khác. Vui lòng thử lại.');
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
        if (actionDisabled) {
            return;
        }

        clearMessages();
        setEditingFolder(folder);
        setName(folder.name);
        setShowForm(true);
    }

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

            setPath((previous) =>
                previous.map((item) =>
                    item.id === editingFolder.id
                        ? { ...item, name: folderName }
                        : item
                )
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
        if (actionDisabled) {
            return;
        }

        if (!window.confirm(`Xóa thư mục "${folder.name}"?`)) {
            return;
        }

        clearMessages();
        setBusy(true);

        try {
            await api.deleteFolder(folder.id);

            if (path.some((item) => item.id === folder.id)) {
                setPath([]);
                clearDocumentSelection();
            }

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

    // Component DocumentPreview tự lấy file và nội dung OCR.
    function openDocument(folderId, document, highlightKeyword = '') {
        if (actionDisabled || documentLock.current || moveLock.current) {
            return;
        }

        clearMessages();

        setPreview({
            folderId,
            document,
            highlightKeyword,
        });
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

    async function loadDocumentText(
        folderId,
        document,
        run,
        highlightKeyword = ''
    ) {
        if (documentLock.current || busy || ocrSaving) {
            return;
        }

        if (
            ocrDirty &&
            !window.confirm(
                'Nội dung OCR chưa được lưu. Bỏ thay đổi và tiếp tục?'
            )
        ) {
            return;
        }

        await runDocumentAction(async () => {
            setOcrText('');
            setOcrSavedText('');
            setOcrTextLoaded(false);
            setOcrSaveError('');
            setOcrSaveSuccess('');
            setOcrError('');
            setOcrLoading(true);

            setDocumentAction({
                type: 'ocr',
                mode: run ? 'run' : 'view',
                highlightKeyword,
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

                const text =
                    typeof data === 'string'
                        ? data
                        : (data?.extractedText ?? data?.text ?? '');

                setOcrText(text);
                setOcrSavedText(text);
                setOcrTextLoaded(true);
            } catch (err) {
                errorMessage = err.message || 'Không thể lấy nội dung OCR.';
            } finally {
                try {
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
        if (actionDisabled || documentLock.current) {
            return;
        }

        await loadDocumentText(folderId, document, true);
    }

    async function showDocumentText(
        folderId,
        document,
        highlightKeyword = ''
    ) {
        if (actionDisabled || documentLock.current) {
            return;
        }

        await loadDocumentText(
            folderId,
            document,
            false,
            highlightKeyword
        );
    }

    async function retryDocumentText() {
        if (documentAction?.type !== 'ocr') {
            return;
        }

        const action = documentAction;

        await loadDocumentText(
            action.folderId,
            action.document,
            action.mode === 'run',
            action.highlightKeyword ?? ''
        );
    }

    async function rerunDocumentOcr() {
        if (documentAction?.type !== 'ocr') {
            return;
        }

        const action = documentAction;

        await loadDocumentText(
            action.folderId,
            action.document,
            true,
            action.highlightKeyword ?? ''
        );
    }

    async function saveDocumentText() {
        if (
            documentAction?.type !== 'ocr' ||
            !ocrTextLoaded ||
            !ocrDirty ||
            ocrLoading ||
            ocrSaving ||
            documentAction.document.ocrStatus === 'PROCESSING'
        ) {
            return;
        }

        const action = documentAction;
        const editedText = ocrText;

        await runDocumentAction(async () => {
            setOcrSaving(true);
            setOcrSaveError('');
            setOcrSaveSuccess('');

            try {
                const data = await api.updateExtractedText(
                    action.folderId,
                    action.document.id,
                    editedText
                );

                const savedText =
                    typeof data === 'string'
                        ? data
                        : (data?.extractedText ?? data?.text ?? editedText);

                setOcrText(savedText);
                setOcrSavedText(savedText);
                setOcrSaveSuccess('Đã lưu nội dung OCR.');
                refreshDocuments();
            } catch (err) {
                setOcrSaveError(
                    err.message || 'Không thể lưu nội dung OCR.'
                );
            } finally {
                setOcrSaving(false);
            }
        });
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
        if (actionDisabled) {
            return;
        }

        await runDocumentAction(async () => {
            const detail = await api.documentDetail(folderId, document.id);

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
        const queue = [{ parentId: null, prefix: '' }];

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
        if (actionDisabled) {
            return;
        }

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

        if (!window.confirm(`Xóa tài liệu "${document.originalName}"?`)) {
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

    async function permanentDeleteDocument(
        folderId,
        document,
        fromDetail = false
    ) {
        if (
            (!fromDetail && actionDisabled) ||
            busy ||
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
                await api.permanentDeleteDocument(folderId, document.id);
            } finally {
                setPreview(null);

                setSelectedDocumentId((previous) =>
                    previous === document.id ? null : previous
                );

                refreshDocuments();
            }

            setDocumentAction(null);
            setSuccess('Đã xóa vĩnh viễn tài liệu.');
        });
    }

    async function downloadDocument(folderId, item) {
        if (actionDisabled) {
            return;
        }

        await runDocumentAction(async () => {
            const blob = await api.downloadDocument(folderId, item.id);
            const url = URL.createObjectURL(blob);
            const link = window.document.createElement('a');

            link.href = url;
            link.download = item.originalName;

            window.document.body.appendChild(link);

            try {
                link.click();
            } finally {
                link.remove();
                window.setTimeout(() => URL.revokeObjectURL(url), 60000);
            }

            setSuccess('Đã gửi file cho trình duyệt tải xuống.');
        });
    }

    function closeDocumentAction() {
        if (busy || documentLock.current) {
            return;
        }

        if (
            documentAction?.type === 'ocr' &&
            ocrDirty &&
            !window.confirm(
                'Nội dung OCR chưa được lưu. Bỏ thay đổi và đóng?'
            )
        ) {
            return;
        }

        setDocumentAction(null);
        setOcrText('');
        setOcrSavedText('');
        setOcrTextLoaded(false);
        setOcrSaveError('');
        setOcrSaveSuccess('');
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

        if (
            uploadLock.current ||
            busy ||
            loading ||
            showForm ||
            documentAction ||
            folderMove
        ) {
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

        if (!metadata.title.trim()) {
            setUploadError('Nhập tên văn bản.');
            return;
        }

        const selectedFile = file;
        uploadLock.current = true;
        setBusy(true);

        try {
            await api.uploadDocument(parentId, selectedFile, {
                ...metadata,
                title: metadata.title.trim(),
            });

            setSuccess(`Đã tải lên file "${selectedFile.name}".`);
            setUploadOpen(false);
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
        if (actionDisabled || moveLock.current || !draggedFolder) {
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

        setDropTarget(targetFolder ? String(targetFolder.id) : 'root');
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

        if (actionDisabled || moveLock.current || !draggedFolder) {
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

            setSuccess(`Đã chuyển "${source.name}" vào ${destination}.`);

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

    function requestCreateInTree(folder, ancestorIds = []) {
        if (actionDisabled) {
            return;
        }

        setSidebarCollapsed(false);
        clearMessages();
        treeCreateVersion.current += 1;

        setTreeCreateRequest({
            version: treeCreateVersion.current,
            folderId: folder?.id ?? null,
            ancestorIds,
        });
    }

    function openRoot() {
        if (actionDisabled) {
            return;
        }

        clearDocumentSelection();
        clearMessages();
        closeForm();
        setPath([]);
    }

    async function startMoveFolder(folder) {
        if (actionDisabled || moveLock.current) {
            return;
        }

        setBusy(true);
        clearMessages();

        try {
            const all = await loadDestinationFolders();

            const excluded = new Set([folder.id]);
            const queue = [folder.id];

            for (let i = 0; i < queue.length; i += 1) {
                const children = await api.folders(queue[i]);

                for (const child of children) {
                    if (!excluded.has(child.id)) {
                        excluded.add(child.id);
                        queue.push(child.id);
                    }
                }
            }

            setDestinationFolders(
                all.filter((item) => !excluded.has(item.id))
            );

            setFolderMoveTarget(
                folder.parentId == null ? 'root' : String(folder.parentId)
            );

            setFolderMove(folder);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function saveFolderMove(event) {
        event.preventDefault();

        if (!folderMove || busy || moveLock.current) {
            return;
        }

        const targetId =
            folderMoveTarget === 'root' ? null : Number(folderMoveTarget);

        if ((folderMove.parentId ?? null) === targetId) {
            setFolderMove(null);
            return;
        }

        moveLock.current = true;
        setBusy(true);
        clearMessages();

        try {
            await api.moveFolder(folderMove.id, targetId);

            setFolderMove(null);
            setPath([]);
            setTreeCreateRequest(null);
            clearDocumentSelection();
            setReload((value) => value + 1);
            setSuccess('Đã di chuyển thư mục.');
        } catch (err) {
            setError(err.message);
        } finally {
            moveLock.current = false;
            setBusy(false);
        }
    }

    const interaction = {
        disabled: actionDisabled,
        selectedAncestorIds: path.map((folder) => folder.id),
        onOpenRoot: openRoot,
        onRequestCreate: requestCreateInTree,
        onRenameFolder: startEdit,
        onMoveFolder: startMoveFolder,
        onDeleteFolder: deleteFolder,
        draggedFolderId: draggedFolder?.id ?? null,
        dropTarget,
        selectedFolderId: parentId,
        selectedDocumentId,
        documentDisabled: busy || showForm || Boolean(documentAction),
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
        <main className="folders-page">
            <div className="folders-workspace">
                <header className="folders-header">
                    QUẢN LÝ HỒ SƠ, VĂN BẢN
                </header>

                <div
                    className={`folders-layout ${
                        sidebarCollapsed ? 'sidebar-collapsed' : ''
                    }`}
                >
                    <aside
                        className="folders-sidebar"
                        aria-label="Thanh bên thư mục"
                        hidden={sidebarCollapsed}
                    >
                        <FolderTree
                            reload={reload}
                            interaction={interaction}
                        />
                    </aside>

                    <section className="folders-content">
                        <div className="folders-toolbar">
                            <button
                                type="button"
                                className="icon-button sidebar-toggle"
                                aria-label={
                                    sidebarCollapsed
                                        ? 'Mở cây thư mục'
                                        : 'Thu gọn cây thư mục'
                                }
                                aria-expanded={!sidebarCollapsed}
                                onClick={() =>
                                    setSidebarCollapsed((value) => !value)
                                }
                            >
                                ☰
                            </button>

                            <h1>
                                {currentFolder?.name ?? 'Thư mục gốc'}
                            </h1>

                            <div className="folders-actions">
                                <button
                                    type="button"
                                    disabled={actionDisabled}
                                    aria-pressed={searchOpen}
                                    onClick={() => {
                                        clearDocumentSelection();
                                        clearMessages();
                                        setSearchOpen((value) => !value);
                                    }}
                                >
                                    {searchOpen
                                        ? 'Đóng tìm kiếm'
                                        : 'Tìm kiếm và phân trang'}
                                </button>

                                {currentFolder && (
                                    <button
                                        type="button"
                                        className="folders-primary"
                                        disabled={actionDisabled}
                                        onClick={() => {
                                            clearMessages();
                                            setFile(null);
                                            setMetadata(emptyMetadata());
                                            setUploadError('');
                                            setUploadOpen(true);
                                        }}
                                    >
                                        ＋ Tải tài liệu
                                    </button>
                                )}

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
                                    onClick={startCreate}
                                    disabled={
                                        actionDisabled || Boolean(loadError)
                                    }
                                >
                                    + Tạo thư mục
                                </button>

                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    disabled={busy}
                                >
                                    Đăng xuất
                                </button>
                            </div>
                        </div>

                        <nav
                            className="folder-breadcrumb"
                            aria-label="Đường dẫn thư mục"
                        >
                            <button
                                type="button"
                                disabled={actionDisabled}
                                onClick={openRoot}
                            >
                                Hồ sơ
                            </button>

                            {path.map((folder, index) => (
                                <span key={folder.id}>
                                    {' / '}
                                    <button
                                        type="button"
                                        disabled={actionDisabled}
                                        aria-current={
                                            index === path.length - 1
                                                ? 'page'
                                                : undefined
                                        }
                                        onClick={() => {
                                            clearDocumentSelection();
                                            setPath(path.slice(0, index + 1));
                                        }}
                                    >
                                        {folder.name}
                                    </button>
                                </span>
                            ))}
                        </nav>

                        {searchOpen ? (
                            <DocumentSearchPanel
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
                        ) : (
                            currentFolder && (
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
                            )
                        )}

                        <h2 className="subfolders-heading">
                            {currentFolder ? 'Thư mục con' : 'Các thư mục'}
                        </h2>

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

                        {showForm && editingFolder && (
                            <WorkspaceModal
                                title="Đổi tên thư mục"
                                busy={busy}
                                onClose={closeForm}
                            >
                                <form
                                    className="folders-form"
                                    onSubmit={saveFolder}
                                >
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
                            </WorkspaceModal>
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

                        {!loading &&
                            !loadError &&
                            (folders.length === 0 ? (
                                <p>Chưa có thư mục con nào.</p>
                            ) : (
                                <ul className="folders-list">
                                    {folders.map((folder) => (
                                        <li
                                            key={folder.id}
                                            className={`folders-item ${
                                                dropTarget === String(folder.id)
                                                    ? 'is-drop-target'
                                                    : ''
                                            } ${
                                                draggedFolder?.id === folder.id
                                                    ? 'is-dragging'
                                                    : ''
                                            } ${
                                                actionDisabled
                                                    ? 'is-locked'
                                                    : ''
                                            }`}
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
                                        >
                                            <div className="folders-info">
                                                <span
                                                    className="folders-icon"
                                                    aria-hidden="true"
                                                >
                                                    📁
                                                </span>

                                                <div>
                                                    <button
                                                        type="button"
                                                        className="folder-open-name"
                                                        disabled={actionDisabled}
                                                        onClick={() =>
                                                            openFolder(folder)
                                                        }
                                                    >
                                                        {folder.name}
                                                    </button>
                                                </div>
                                            </div>

                                            <WorkspaceMenu
                                                label={`Thao tác thư mục ${folder.name}`}
                                                disabled={actionDisabled}
                                                items={[
                                                    {
                                                        label: 'Mở thư mục',
                                                        onClick: () =>
                                                            openFolder(folder),
                                                    },
                                                    {
                                                        label: 'Đổi tên thư mục',
                                                        onClick: () =>
                                                            startEdit(folder),
                                                    },
                                                    {
                                                        label: 'Di chuyển thư mục',
                                                        onClick: () =>
                                                            startMoveFolder(folder),
                                                    },
                                                    {
                                                        label: 'Xóa thư mục',
                                                        danger: true,
                                                        onClick: () =>
                                                            deleteFolder(folder),
                                                    },
                                                ]}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            ))}
                    </section>
                </div>
            </div>

            {uploadOpen && (
                <WorkspaceModal
                    title="Tải tài liệu lên"
                    busy={busy}
                    onClose={() => setUploadOpen(false)}
                >
                    <form
                        className="workspace-form upload-form"
                        onSubmit={uploadDocument}
                    >
                        <label htmlFor="documentFile">Chọn file</label>

                        <input
                            ref={fileInputRef}
                            id="documentFile"
                            type="file"
                            disabled={busy}
                            onChange={(event) => {
                                setFile(event.target.files?.[0] ?? null);

                                const chosen = event.target.files?.[0];

                                if (chosen && !metadata.title.trim()) {
                                    setMetadata((value) => ({
                                        ...value,
                                        title: chosen.name.replace(/\.[^.]+$/, ''),
                                    }));
                                }

                                setUploadError('');
                                setUploadSuccess('');
                            }}
                        />

                        <DocumentMetadataForm
                            compact
                            value={metadata}
                            onChange={setMetadata}
                            disabled={busy}
                        />

                        <div className="modal-footer">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setUploadOpen(false)}
                            >
                                Hủy
                            </button>

                            <button
                                type="submit"
                                className="folders-primary"
                                disabled={busy || !file}
                            >
                                {uploadLock.current
                                    ? 'Đang tải lên...'
                                    : 'Tải lên'}
                            </button>
                        </div>

                        {uploadError && (
                            <p className="message error" role="alert">
                                {uploadError}
                            </p>
                        )}

                        {uploadSuccess && (
                            <p className="message success" role="status">
                                {uploadSuccess}
                            </p>
                        )}
                    </form>
                </WorkspaceModal>
            )}

            {folderMove && (
                <WorkspaceModal
                    title="Di chuyển thư mục"
                    busy={busy}
                    onClose={() => setFolderMove(null)}
                >
                    <form
                        className="workspace-form"
                        onSubmit={saveFolderMove}
                    >
                        <p>
                            Thư mục: <strong>{folderMove.name}</strong>
                        </p>

                        <label>
                            Chuyển đến
                            <select
                                value={folderMoveTarget}
                                disabled={busy}
                                onChange={(event) =>
                                    setFolderMoveTarget(event.target.value)
                                }
                            >
                                <option value="root">Thư mục gốc</option>

                                {destinationFolders.map((folder) => (
                                    <option
                                        key={folder.id}
                                        value={String(folder.id)}
                                    >
                                        {folder.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {error && (
                            <p role="alert" className="message error">
                                {error}
                            </p>
                        )}

                        <div className="modal-footer">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setFolderMove(null)}
                            >
                                Hủy
                            </button>

                            <button
                                type="submit"
                                className="folders-primary"
                                disabled={busy}
                            >
                                {busy ? 'Đang chuyển…' : 'Di chuyển'}
                            </button>
                        </div>
                    </form>
                </WorkspaceModal>
            )}

            {documentAction && (
                <WorkspaceModal
                    title={
                        documentAction.type === 'detail'
                            ? 'Chi tiết tài liệu'
                            : documentAction.type === 'rename'
                                ? 'Đổi tên file'
                                : documentAction.type === 'ocr'
                                    ? 'Nội dung chữ của tài liệu'
                                    : 'Di chuyển tài liệu'
                    }
                    busy={busy}
                    onClose={closeDocumentAction}
                >
                    {documentAction.type === 'detail' && (
                        <div>
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
                                        `${(
                                            documentAction.document.size / 1024
                                        ).toFixed(1)} KB`,
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
                                        className="document-detail-field"
                                    >
                                        <dt>
                                            <strong>{label}</strong>
                                        </dt>

                                        <dd className="document-detail-value">
                                            {value || '—'}
                                        </dd>
                                    </div>
                                ))}
                            </dl>

                            <details className="advanced-actions">
                                <summary>Thao tác nâng cao</summary>
                                <p>Xóa vĩnh viễn sẽ xóa cả bản ghi và file.</p>

                                <button
                                    type="button"
                                    className="folders-danger"
                                    disabled={busy}
                                    onClick={() =>
                                        permanentDeleteDocument(
                                            documentAction.folderId,
                                            documentAction.document,
                                            true
                                        )
                                    }
                                >
                                    Xóa vĩnh viễn
                                </button>
                            </details>
                        </div>
                    )}

                    {documentAction.type === 'ocr' && (
                        <div className="document-ocr-panel">
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

                            {documentAction.document.ocrStatus === 'FAILED' &&
                                documentAction.document.ocrError && (
                                    <p className="message error" role="alert">
                                        <strong>Lỗi OCR: </strong>
                                        {documentAction.document.ocrError}
                                    </p>
                                )}

                            {ocrError &&
                                ocrError !== documentAction.document.ocrError && (
                                    <p className="message error" role="alert">
                                        {ocrError}
                                    </p>
                                )}

                            {!ocrLoading && ocrTextLoaded && (
                                <>
                                    {documentAction.highlightKeyword && (
                                        <>
                                            <p>
                                                Từ khóa:{' '}
                                                <strong>
                                                    {documentAction.highlightKeyword}
                                                </strong>
                                            </p>

                                            <OcrTextViewer
                                                key={`${documentAction.document.id}:${documentAction.highlightKeyword}`}
                                                text={ocrText}
                                                keyword={
                                                    documentAction.highlightKeyword
                                                }
                                            />
                                        </>
                                    )}

                                    <details
                                        open={
                                            documentAction.highlightKeyword
                                                ? undefined
                                                : true
                                        }
                                    >
                                        <summary>
                                            Chỉnh sửa nội dung OCR
                                        </summary>

                                        <label htmlFor="document-ocr-text">
                                            Nội dung OCR — có thể chỉnh sửa
                                        </label>

                                        <textarea
                                            id="document-ocr-text"
                                            value={ocrText}
                                            rows={16}
                                            disabled={
                                                busy ||
                                                ocrSaving ||
                                                documentAction.document
                                                    .ocrStatus === 'PROCESSING'
                                            }
                                            onChange={(event) => {
                                                setOcrText(event.target.value);
                                                setOcrSaveError('');
                                                setOcrSaveSuccess('');
                                            }}
                                            className="ocr-result-text"
                                        />
                                    </details>

                                    <p role="status" aria-live="polite">
                                        {ocrDirty
                                            ? 'Có thay đổi chưa lưu.'
                                            : 'Nội dung hiện tại đã được lưu.'}
                                    </p>

                                    {ocrSaveError && (
                                        <p
                                            className="message error"
                                            role="alert"
                                        >
                                            {ocrSaveError}
                                        </p>
                                    )}

                                    {ocrSaveSuccess && (
                                        <p
                                            className="message success"
                                            role="status"
                                        >
                                            {ocrSaveSuccess}
                                        </p>
                                    )}

                                    <button
                                        type="button"
                                        className="folders-primary"
                                        disabled={
                                            busy ||
                                            ocrSaving ||
                                            !ocrDirty ||
                                            documentAction.document
                                                .ocrStatus === 'PROCESSING'
                                        }
                                        onClick={saveDocumentText}
                                    >
                                        {ocrSaving
                                            ? 'Đang lưu…'
                                            : 'Lưu nội dung'}
                                    </button>
                                </>
                            )}

                            {!ocrLoading && !ocrError && !ocrText.trim() && (
                                <p>
                                    {documentAction.document.ocrStatus === 'FAILED'
                                        ? 'Lần nhận dạng gần nhất thất bại. Bạn có thể chạy lại OCR.'
                                        : documentAction.document.ocrStatus ===
                                        'PROCESSING'
                                            ? 'Tài liệu đang được xử lý. Bấm cập nhật để xem trạng thái mới.'
                                            : 'Nội dung chữ đang trống. Bạn có thể nhập nội dung và lưu lại.'}
                                </p>
                            )}

                            {!ocrLoading &&
                                ocrError &&
                                documentAction.document.ocrStatus !==
                                'PROCESSING' && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={retryDocumentText}
                                    >
                                        Thử lại
                                    </button>
                                )}

                            {documentAction.document.ocrStatus ===
                                'PROCESSING' && (
                                    <button
                                        type="button"
                                        disabled={busy || ocrLoading}
                                        onClick={() =>
                                            loadDocumentText(
                                                documentAction.folderId,
                                                documentAction.document,
                                                false,
                                                documentAction.highlightKeyword ?? ''
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
                                        documentAction.document.ocrStatus ===
                                        'PROCESSING'
                                    }
                                    onClick={rerunDocumentOcr}
                                >
                                    {ocrLoading && documentAction.mode === 'run'
                                        ? 'Đang nhận dạng…'
                                        : documentAction.document.ocrStatus ===
                                        'PROCESSING'
                                            ? 'Đang xử lý OCR'
                                            : documentAction.document.ocrStatus ===
                                            'FAILED'
                                                ? 'Chạy lại OCR'
                                                : documentAction.document.ocrStatus ===
                                                'COMPLETED'
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
                                Giữ nguyên đuôi file, ví dụ: BaoCaoMoi.pdf.
                            </p>

                            <button
                                type="submit"
                                disabled={busy}
                                className="folders-primary"
                            >
                                {busy ? 'Đang lưu...' : 'Lưu tên mới'}
                            </button>
                        </form>
                    )}

                    {documentAction.type === 'move' && (
                        <form
                            className="folders-form"
                            onSubmit={saveDocumentMove}
                        >
                            <p>
                                File: {documentAction.document.originalName}
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
                                    busy || destinationFolders.length === 0
                                }
                                onChange={(event) =>
                                    setTargetFolderId(event.target.value)
                                }
                            >
                                <option value="">Chọn thư mục</option>

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
                                    Chưa có thư mục khác. Tạo một thư mục
                                    trước khi di chuyển.
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
                        autoFocus={['detail', 'ocr'].includes(
                            documentAction.type
                        )}
                        disabled={busy}
                        onClick={closeDocumentAction}
                    >
                        {['detail', 'ocr'].includes(documentAction.type)
                            ? 'Đóng'
                            : 'Hủy'}
                    </button>
                </WorkspaceModal>
            )}

            {preview && (
                <DocumentPreview
                    key={`${preview.folderId}:${preview.document.id}:${preview.highlightKeyword}`}
                    folderId={preview.folderId}
                    document={preview.document}
                    highlightKeyword={preview.highlightKeyword}
                    onClose={() => setPreview(null)}
                />
            )}
        </main>
    );
}

function DocumentSearchPanel({
                                 folderId,
                                 reload,
                                 disabled,
                                 selectedDocumentId,
                                 onOpenDocument,
                                 onDetailDocument,
                                 onRenameDocument,
                                 onMoveDocument,
                                 onDeleteDocument,
                                 onPermanentDeleteDocument,
                                 onDownloadDocument,
                                 onRunDocumentOcr,
                                 onShowDocumentText,
                             }) {
    const emptyFilters = () => ({
        keyword: '',
        ocrKeyword: '',
        documentNumber: '',
        documentType: '',
        issuer: '',
        issuedDateFrom: '',
        issuedDateTo: '',
        currentFolderOnly: folderId != null,
    });

    const searchStorageKey =
        `${SEARCH_VIEW_PREFIX}${folderId ?? 'root'}`;

    const [savedSearch] = useState(() => {
        const saved = readSessionValue(searchStorageKey);
        const defaults = emptyFilters();

        function restoreFilters(value) {
            return Object.fromEntries(
                Object.entries(defaults).map(([key, fallback]) => [
                    key,
                    typeof value?.[key] === typeof fallback
                        ? value[key]
                        : fallback,
                ])
            );
        }

        return {
            filters: restoreFilters(saved?.filters),
            query: {
                ...restoreFilters(saved?.query),
                page:
                    Number.isInteger(saved?.query?.page) &&
                    saved.query.page >= 0
                        ? saved.query.page
                        : 0,
                size: [10, 20, 50, 100].includes(saved?.query?.size)
                    ? saved.query.size
                    : 10,
            },
        };
    });

    const [filters, setFilters] = useState(savedSearch.filters);
    const [query, setQuery] = useState(savedSearch.query);

    const [result, setResult] = useState({
        items: [],
        page: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
    });

    const [searchLoading, setSearchLoading] = useState(true);
    const [searchError, setSearchError] = useState('');
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        writeSessionValue(searchStorageKey, {
            filters,
            query,
        });
    }, [searchStorageKey, filters, query]);

    useEffect(() => {
        let active = true;
        setSearchLoading(true);
        setSearchError('');

        async function load() {
            try {
                const data = await api.searchDocuments({
                    ...query,
                    folderId: query.currentFolderOnly ? folderId : null,
                });

                if (!active) {
                    return;
                }

                if (!data || !Array.isArray(data.items)) {
                    throw new Error(
                        'API tìm kiếm chưa trả về danh sách tài liệu hợp lệ.'
                    );
                }

                const lastPage = Math.max(0, data.totalPages - 1);

                if (query.page > lastPage) {
                    setQuery((previous) => ({
                        ...previous,
                        page: lastPage,
                    }));
                    return;
                }

                setResult(data);
            } catch (err) {
                if (active) {
                    setSearchError(
                        err.message || 'Không thể tìm tài liệu.'
                    );
                }
            } finally {
                if (active) {
                    setSearchLoading(false);
                }
            }
        }

        load();

        return () => {
            active = false;
        };
    }, [folderId, query, reload, retry]);

    function submit(event) {
        event.preventDefault();

        if (disabled || searchLoading) {
            return;
        }

        setSearchLoading(true);

        setQuery({
            ...filters,
            page: 0,
            size: query.size,
        });
    }

    function reset() {
        if (disabled || searchLoading) {
            return;
        }

        const next = emptyFilters();

        setFilters(next);
        setSearchLoading(true);

        setQuery({
            ...next,
            page: 0,
            size: query.size,
        });
    }

    const blocked = disabled || searchLoading;

    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
    };

    const inputStyle = {
        width: '100%',
        boxSizing: 'border-box',
        padding: '8px 10px',
        marginTop: 5,
    };

    const cellStyle = {
        padding: '10px 12px',
        textAlign: 'left',
        borderBottom: '1px solid #e5e7eb',
    };

    return (
        <section
            aria-label="Tìm kiếm tài liệu"
            style={{ margin: '16px 0 24px' }}
        >
            <h2>Tài liệu</h2>

            <form onSubmit={submit}>
                <fieldset
                    disabled={blocked}
                    style={{
                        border: '1px solid #dbe1ea',
                        borderRadius: 8,
                        padding: 14,
                    }}
                >
                    <legend>Tìm kiếm và bộ lọc</legend>

                    <div style={gridStyle}>
                        <label>
                            Tên hoặc metadata
                            <input
                                style={inputStyle}
                                value={filters.keyword}
                                maxLength={255}
                                placeholder="Tên file, tiêu đề, từ khóa…"
                                onChange={(event) =>
                                    setFilters((previous) => ({
                                        ...previous,
                                        keyword: event.target.value,
                                    }))
                                }
                            />
                        </label>

                        <label>
                            Nội dung OCR
                            <input
                                style={inputStyle}
                                value={filters.ocrKeyword}
                                maxLength={255}
                                placeholder="Từ hoặc cụm từ trong nội dung"
                                onChange={(event) =>
                                    setFilters((previous) => ({
                                        ...previous,
                                        ocrKeyword: event.target.value,
                                    }))
                                }
                            />
                        </label>
                    </div>

                    <details style={{ marginTop: 12 }}>
                        <summary style={{ cursor: 'pointer' }}>
                            Bộ lọc bổ sung
                        </summary>

                        <div style={{ ...gridStyle, marginTop: 12 }}>
                            {[
                                ['documentNumber', 'Số văn bản', 'text'],
                                [
                                    'documentType',
                                    'Loại văn bản (nhập đúng loại đã lưu)',
                                    'text',
                                ],
                                ['issuer', 'Cơ quan ban hành', 'text'],
                                ['issuedDateFrom', 'Ban hành từ ngày', 'date'],
                                ['issuedDateTo', 'Đến ngày', 'date'],
                            ].map(([key, label, type]) => (
                                <label key={key}>
                                    {label}

                                    <input
                                        style={inputStyle}
                                        type={type}
                                        value={filters[key]}
                                        maxLength={255}
                                        min={
                                            key === 'issuedDateTo'
                                                ? filters.issuedDateFrom ||
                                                undefined
                                                : undefined
                                        }
                                        max={
                                            key === 'issuedDateFrom'
                                                ? filters.issuedDateTo ||
                                                undefined
                                                : undefined
                                        }
                                        onChange={(event) =>
                                            setFilters((previous) => ({
                                                ...previous,
                                                [key]: event.target.value,
                                            }))
                                        }
                                    />
                                </label>
                            ))}
                        </div>
                    </details>

                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 12,
                            marginTop: 14,
                        }}
                    >
                        {folderId != null && (
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={filters.currentFolderOnly}
                                    onChange={(event) =>
                                        setFilters((previous) => ({
                                            ...previous,
                                            currentFolderOnly:
                                            event.target.checked,
                                        }))
                                    }
                                />

                                Chỉ trong thư mục đang mở
                            </label>
                        )}

                        <button
                            type="submit"
                            className="folders-primary"
                        >
                            Tìm kiếm
                        </button>

                        <button type="button" onClick={reset}>
                            Xóa bộ lọc
                        </button>
                    </div>
                </fieldset>
            </form>

            {searchLoading && (
                <p role="status">Đang tải tài liệu…</p>
            )}

            {searchError && (
                <div className="message error" role="alert">
                    <p>{searchError}</p>

                    <button
                        type="button"
                        disabled={blocked}
                        onClick={() => setRetry((value) => value + 1)}
                    >
                        Thử lại
                    </button>
                </div>
            )}

            {!searchLoading && !searchError && (
                <>
                    <p role="status">
                        {result.totalElements} tài liệu ·{' '}
                        {query.currentFolderOnly
                            ? 'Trong thư mục đang mở'
                            : 'Trong tất cả thư mục được phép truy cập'}
                    </p>

                    {result.items.length === 0 ? (
                        <p>Không có tài liệu phù hợp.</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table
                                style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                }}
                            >
                                <thead>
                                <tr>
                                    {[
                                        'Tên tài liệu',
                                        'Số văn bản',
                                        'Loại văn bản',
                                        'Ngày ban hành',
                                        'OCR',
                                        'Thao tác',
                                    ].map((label) => (
                                        <th
                                            key={label}
                                            scope="col"
                                            style={cellStyle}
                                        >
                                            {label}
                                        </th>
                                    ))}
                                </tr>
                                </thead>

                                <tbody>
                                {result.items.map((document) => {
                                    const documentFolderId =
                                        document.folderId;

                                    const canOcr =
                                        document.mimeType?.startsWith(
                                            'image/'
                                        ) ||
                                        document.mimeType ===
                                        'application/pdf';

                                    const act = (handler) => () => {
                                        if (blocked) {
                                            return;
                                        }

                                        const keyword =
                                            query.ocrKeyword?.trim() ?? '';

                                        if (
                                            handler === onOpenDocument ||
                                            handler === onShowDocumentText
                                        ) {
                                            return handler(
                                                documentFolderId,
                                                document,
                                                keyword
                                            );
                                        }

                                        return handler(
                                            documentFolderId,
                                            document
                                        );
                                    };

                                    const menuItems = [
                                        {
                                            label: 'Xem file',
                                            onClick: act(onOpenDocument),
                                        },
                                        {
                                            label: 'Chi tiết',
                                            onClick: act(onDetailDocument),
                                        },
                                        {
                                            label: 'Đổi tên file',
                                            onClick: act(onRenameDocument),
                                        },
                                        {
                                            label: 'Di chuyển',
                                            onClick: act(onMoveDocument),
                                        },
                                        {
                                            label: 'Tải xuống',
                                            onClick: act(onDownloadDocument),
                                        },
                                        {
                                            label: 'Xem / sửa nội dung OCR',
                                            onClick: act(onShowDocumentText),
                                        },
                                        ...(canOcr &&
                                        document.ocrStatus !== 'PROCESSING'
                                            ? [
                                                {
                                                    label: 'Chạy OCR',
                                                    onClick: act(
                                                        onRunDocumentOcr
                                                    ),
                                                },
                                            ]
                                            : []),
                                        {
                                            label: 'Xóa mềm',
                                            danger: true,
                                            onClick: act(onDeleteDocument),
                                        },
                                        {
                                            label: 'Xóa vĩnh viễn',
                                            danger: true,
                                            onClick: act(
                                                onPermanentDeleteDocument
                                            ),
                                        },
                                    ];

                                    return (
                                        <tr
                                            key={document.id}
                                            style={
                                                document.id ===
                                                selectedDocumentId
                                                    ? {
                                                        background: '#eff6ff',
                                                    }
                                                    : undefined
                                            }
                                            onDoubleClick={() => {
                                                if (!blocked) {
                                                    onDetailDocument(
                                                        documentFolderId,
                                                        document
                                                    );
                                                }
                                            }}
                                        >
                                            <td style={cellStyle}>
                                                <button
                                                    type="button"
                                                    disabled={blocked}
                                                    onClick={act(
                                                        onOpenDocument
                                                    )}
                                                    style={{
                                                        textAlign: 'left',
                                                        overflowWrap: 'anywhere',
                                                    }}
                                                >
                                                    {document.title ||
                                                        document.originalName}
                                                </button>

                                                {document.title && (
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            color: '#64748b',
                                                            marginTop: 4,
                                                            overflowWrap:
                                                                'anywhere',
                                                        }}
                                                    >
                                                        {document.originalName}
                                                    </div>
                                                )}
                                            </td>

                                            <td style={cellStyle}>
                                                {document.documentNumber ||
                                                    '—'}
                                            </td>

                                            <td style={cellStyle}>
                                                {document.documentType ||
                                                    '—'}
                                            </td>

                                            <td style={cellStyle}>
                                                {document.issuedDate
                                                    ? document.issuedDate
                                                        .split('-')
                                                        .reverse()
                                                        .join('/')
                                                    : '—'}
                                            </td>

                                            <td style={cellStyle}>
                                                {ocrStatusName(
                                                    document.ocrStatus
                                                )}
                                            </td>

                                            <td style={cellStyle}>
                                                <WorkspaceMenu
                                                    label={`Thao tác tài liệu ${document.originalName}`}
                                                    disabled={blocked}
                                                    items={menuItems}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <nav
                        aria-label="Phân trang tài liệu"
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 12,
                            marginTop: 14,
                        }}
                    >
                        <button
                            type="button"
                            disabled={blocked || result.page <= 0}
                            onClick={() => {
                                setSearchLoading(true);

                                setQuery((previous) => ({
                                    ...previous,
                                    page: previous.page - 1,
                                }));
                            }}
                        >
                            ← Trang trước
                        </button>

                        <span>
                            Trang{' '}
                            {result.totalPages === 0 ? 0 : result.page + 1}
                            {' / '}
                            {result.totalPages}
                        </span>

                        <button
                            type="button"
                            disabled={
                                blocked ||
                                result.page + 1 >= result.totalPages
                            }
                            onClick={() => {
                                setSearchLoading(true);

                                setQuery((previous) => ({
                                    ...previous,
                                    page: previous.page + 1,
                                }));
                            }}
                        >
                            Trang sau →
                        </button>

                        <label>
                            Mỗi trang{' '}
                            <select
                                value={query.size}
                                disabled={blocked}
                                onChange={(event) => {
                                    const size = Number(event.target.value);

                                    setSearchLoading(true);

                                    setQuery((previous) => ({
                                        ...previous,
                                        size,
                                        page: 0,
                                    }));
                                }}
                            >
                                {[10, 20, 50, 100].map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </nav>
                </>
            )}
        </section>
    );
}