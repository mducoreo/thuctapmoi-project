import { useEffect, useState } from 'react';
import { api } from './api.js';
import InlineFolderForm from './InlineFolderForm.jsx';
import WorkspaceMenu from './WorkspaceMenu.jsx';

export default function FolderTreeNode({
                                           folder,
                                           interaction,
                                           reload,
                                           ancestorIds = [],
                                       }) {
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const request = interaction.createRequest;
    const creating = request?.folderId === folder.id;
    const selected = interaction.selectedFolderId === folder.id;
    const ids = [...ancestorIds, folder.id];
    useEffect(() => {
        if (
            request &&
            (request.folderId === folder.id || request.ancestorIds?.includes(folder.id))
        ) {
            setExpanded(true);
        }
    }, [request, folder.id]);
    useEffect(() => {
        if (interaction.selectedAncestorIds?.includes(folder.id)) {
            setExpanded(true);
        }
    }, [interaction.selectedAncestorIds, folder.id]);
    useEffect(() => {
        if (!expanded) {
            return;
        }
        let active = true;
        setLoading(true);
        setError('');
        api.folders(folder.id)
            .then((data) => {
                if (!Array.isArray(data)) {
                    throw new Error('Danh sách thư mục không hợp lệ.');
                }
                if (active) {
                    setChildren(data);
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
    }, [expanded, folder.id, reload, retry]);
    return (
        <li>
            <div
                className={`tree-row ${selected ? 'selected' : ''} ${interaction.dropTarget === String(folder.id) ? 'drop-target' : ''}`}
                draggable={!interaction.disabled}
                onDragStart={(event) => interaction.onDragStart(event, folder)}
                onDragEnd={interaction.onDragEnd}
                onDragOver={(event) => interaction.onDragOver(event, folder)}
                onDragLeave={interaction.onDragLeave}
                onDrop={(event) => interaction.onDrop(event, folder)}
            >
                <button
                    type="button"
                    className="tree-toggle"
                    disabled={interaction.disabled}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Thu gọn' : 'Mở rộng'} ${folder.name}`}
                    onClick={() => setExpanded((value) => !value)}
                >
                    {expanded ? '▾' : '▸'}
                </button>
                <button
                    type="button"
                    className="tree-name"
                    disabled={interaction.disabled}
                    aria-current={selected ? 'location' : undefined}
                    title={folder.name}
                    aria-label={folder.name}
                    onClick={() => interaction.onOpen(folder)}
                >
                    <span className="folder-glyph" aria-hidden="true">
                        ▰
                    </span>
                    <span>{folder.name}</span>
                </button>
                <div className="tree-row-actions">
                    <button
                        type="button"
                        className="icon-button"
                        disabled={interaction.disabled}
                        aria-label={`Tạo thư mục con trong ${folder.name}`}
                        onClick={() => interaction.onRequestCreate(folder, ids)}
                    >
                        +
                    </button>
                    <WorkspaceMenu
                        label={`Thao tác thư mục ${folder.name}`}
                        disabled={interaction.disabled}
                        items={[
                            {
                                label: 'Đổi tên thư mục',
                                onClick: () => interaction.onRenameFolder(folder),
                            },
                            {
                                label: 'Di chuyển thư mục',
                                onClick: () => interaction.onMoveFolder(folder),
                            },
                            {
                                label: 'Xóa thư mục',
                                danger: true,
                                onClick: () => interaction.onDeleteFolder(folder),
                            },
                        ]}
                    />
                </div>
            </div>
            {expanded && (
                <div className="tree-child-content">
                    {creating && (
                        <InlineFolderForm
                            key={request.version}
                            parentId={folder.id}
                            interaction={interaction}
                            onClose={interaction.onClearCreateRequest}
                        />
                    )}
                    {loading && (
                        <p className="tree-note" role="status">
                            Đang tải…
                        </p>
                    )}
                    {error && (
                        <div className="tree-note">
                            <p role="alert">{error}</p>
                            <button
                                type="button"
                                disabled={interaction.disabled}
                                onClick={() => setRetry((value) => value + 1)}
                            >
                                Thử lại
                            </button>
                        </div>
                    )}
                    {!loading && !error && (
                        <ul className="tree-branches">
                            {children
                                .filter((child) => !ids.includes(child.id))
                                .map((child) => (
                                    <FolderTreeNode
                                        key={child.id}
                                        folder={child}
                                        reload={reload}
                                        ancestorIds={ids}
                                        interaction={interaction}
                                    />
                                ))}
                        </ul>
                    )}
                    {!loading && !error && children.length === 0 && !creating && (
                        <p className="tree-note">Không có thư mục con.</p>
                    )}
                </div>
            )}
        </li>
    );
}
