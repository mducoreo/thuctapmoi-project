import { useEffect, useState } from 'react';
import { api } from './api.js';
import FolderCreateForm from './FolderCreateForm.jsx';

export default function FolderTreeNode({
                                           folder,
                                           interaction,
                                           foldersReload = 0,
                                       }) {
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const [showCreate, setShowCreate] = useState(false);

    const documentsReload = interaction.documentsReload;
    const createRequest = interaction.createRequest;

    const documentDisabled = Boolean(
        interaction.documentDisabled ?? interaction.disabled
    );

    // Mở các nhánh dẫn đến thư mục mà nút bên phải yêu cầu tạo.
    useEffect(() => {
        if (!createRequest) return;

        const isTarget = createRequest.folderId === folder.id;

        const isAncestor = createRequest.ancestorIds.includes(
            folder.id
        );

        if (isTarget || isAncestor) {
            setExpanded(true);
        }

        setShowCreate(isTarget);
    }, [createRequest, folder.id]);

    useEffect(() => {
        if (!expanded) {
            return;
        }

        let active = true;

        async function loadContents() {
            setLoading(true);
            setError('');

            try {
                const [folderData, documentData] = await Promise.all([
                    api.folders(folder.id),
                    api.documents(folder.id),
                ]);

                if (active) {
                    setChildren(folderData);
                    setDocuments(documentData);
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

        loadContents();

        return () => {
            active = false;
        };
    }, [
        expanded,
        folder.id,
        documentsReload,
        foldersReload,
        retry,
    ]);

    function toggle() {
        if (interaction.disabled) {
            return;
        }

        setExpanded((previous) => !previous);
    }

    function openFolder() {
        if (interaction.disabled) {
            return;
        }

        setExpanded(true);
        interaction.onOpen(folder);
    }

    function startCreateChild(event) {
        event.stopPropagation();

        if (interaction.disabled) {
            return;
        }

        interaction.onClearCreateRequest();
        setExpanded(true);
        setShowCreate(true);
    }

    function closeCreate() {
        setShowCreate(false);
        interaction.onClearCreateRequest();
    }

    async function createChild(name) {
        await interaction.onCreateFolder(name, folder.id);
    }

    function selectDocument(event, document) {
        event.stopPropagation();

        if (documentDisabled) {
            return;
        }

        interaction.onSelectDocument(folder.id, document);
    }

    function openDocument(event, document) {
        event.stopPropagation();

        if (documentDisabled) {
            return;
        }

        interaction.onOpenDocument(folder.id, document);
    }

    const isDragging = interaction.draggedFolderId === folder.id;
    const isDropTarget = interaction.dropTarget === String(folder.id);
    const isSelected = interaction.selectedFolderId === folder.id;

    return (
        <div>
            <div
                draggable={
                    !interaction.disabled &&
                    !loading &&
                    !showCreate
                }
                onDragStart={(event) =>
                    interaction.onDragStart(event, folder)
                }
                onDragEnd={interaction.onDragEnd}
                onDragOver={(event) =>
                    interaction.onDragOver(event, folder)
                }
                onDragLeave={interaction.onDragLeave}
                onDrop={(event) =>
                    interaction.onDrop(event, folder)
                }
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px',
                    marginBottom: '4px',
                    borderRadius: '6px',
                    background: isDropTarget
                        ? '#dbeafe'
                        : isSelected
                            ? '#eff6ff'
                            : 'transparent',
                    opacity: isDragging ? 0.45 : 1,
                    cursor: interaction.disabled ? 'default' : 'grab',
                }}
            >
                <button
                    type="button"
                    onClick={toggle}
                    disabled={interaction.disabled}
                    aria-expanded={expanded}
                    aria-label={
                        expanded
                            ? `Thu gọn ${folder.name}`
                            : `Mở rộng ${folder.name}`
                    }
                >
                    {expanded ? '▼' : '▶'}
                </button>

                <button
                    type="button"
                    onClick={openFolder}
                    disabled={interaction.disabled}
                    aria-current={isSelected ? 'true' : undefined}
                    style={{
                        textAlign: 'left',
                        overflowWrap: 'anywhere',
                        fontWeight: isSelected ? 'bold' : 'normal',
                    }}
                >
                    📁 {folder.name}
                </button>

                <button
                    type="button"
                    title={`Tạo thư mục con trong ${folder.name}`}
                    aria-label={`Tạo thư mục con trong ${folder.name}`}
                    disabled={interaction.disabled}
                    onClick={startCreateChild}
                    onMouseDown={(event) => event.stopPropagation()}
                    onDragStart={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    style={{
                        marginLeft: 'auto',
                        flexShrink: 0,
                    }}
                >
                    +
                </button>
            </div>

            {expanded && (
                <div style={{ marginLeft: 24 }}>
                    {showCreate && (
                        <FolderCreateForm
                            disabled={interaction.disabled}
                            onCreate={createChild}
                            onCancel={closeCreate}
                        />
                    )}

                    {loading && (
                        <p role="status">Đang tải...</p>
                    )}

                    {!loading && error && (
                        <div>
                            <p role="alert">{error}</p>

                            <button
                                type="button"
                                disabled={interaction.disabled}
                                onClick={() =>
                                    setRetry((value) => value + 1)
                                }
                            >
                                Thử lại
                            </button>
                        </div>
                    )}

                    {!error && (
                        <>
                            {children.map((child) => (
                                <FolderTreeNode
                                    key={child.id}
                                    folder={child}
                                    interaction={interaction}
                                    foldersReload={foldersReload}
                                />
                            ))}

                            {documents.map((document) => (
                                <button
                                    key={document.id}
                                    type="button"
                                    title={document.originalName}
                                    disabled={documentDisabled}
                                    onClick={(event) =>
                                        selectDocument(event, document)
                                    }
                                    onDoubleClick={(event) =>
                                        openDocument(event, document)
                                    }
                                    aria-pressed={
                                        interaction.selectedDocumentId ===
                                        document.id
                                    }
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '6px 4px',
                                        marginBottom: '4px',
                                        textAlign: 'left',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        borderRadius: '6px',
                                        background:
                                            interaction.selectedDocumentId ===
                                            document.id
                                                ? '#dbeafe'
                                                : 'transparent',
                                        fontWeight:
                                            interaction.selectedDocumentId ===
                                            document.id
                                                ? 'bold'
                                                : 'normal',
                                    }}
                                >
                                    📄{' '}
                                    {document.title ||
                                        document.originalName}
                                </button>
                            ))}

                            {!loading &&
                                !showCreate &&
                                children.length === 0 &&
                                documents.length === 0 && (
                                    <p>Thư mục trống.</p>
                                )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}