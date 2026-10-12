import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function FolderTreeNode({ folder, interaction }) {
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);

    const documentsReload = interaction.documentsReload;

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
    }, [expanded, folder.id, documentsReload, retry]);

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

    const isDragging = interaction.draggedFolderId === folder.id;
    const isDropTarget = interaction.dropTarget === String(folder.id);
    const isSelected = interaction.selectedFolderId === folder.id;

    return (
        <div>
            <div
                draggable={!interaction.disabled && !loading}
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
            </div>

            {expanded && (
                <div style={{ marginLeft: 24 }}>
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

                    {!loading && !error && (
                        <>
                            {children.map((child) => (
                                <FolderTreeNode
                                    key={child.id}
                                    folder={child}
                                    interaction={interaction}
                                />
                            ))}

                            {/* Bấm tên tài liệu để mở khung xem. */}
                            {documents.map((document) => (
                                <button
                                    key={document.id}
                                    type="button"
                                    title={document.originalName}
                                    disabled={interaction.disabled}
                                    onClick={() =>
                                        interaction.onOpenDocument(
                                            folder.id,
                                            document
                                        )
                                    }
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '6px 4px',
                                        marginBottom: '4px',
                                        textAlign: 'left',
                                        overflowWrap: 'anywhere',
                                    }}
                                >
                                    📄{' '}
                                    {document.title ||
                                        document.originalName}
                                </button>
                            ))}

                            {children.length === 0 &&
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