import { useEffect, useState } from 'react';
import { api } from './api.js';
import FolderTreeNode from './FolderTreeNode.jsx';
import InlineFolderForm from './InlineFolderForm.jsx';

export default function FolderTree({ reload, interaction }) {
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        api.folders(null)
            .then((data) => {
                if (!Array.isArray(data)) {
                    throw new Error('Danh sách thư mục không hợp lệ.');
                }
                if (active) {
                    setFolders(data);
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
    }, [reload, retry]);
    const request = interaction.createRequest;
    return (
        <nav aria-label="Cây thư mục" className="folder-tree">
            <div className="tree-heading">
                <strong>Thư mục</strong>
                <button
                    type="button"
                    className="icon-button"
                    title="Tạo thư mục gốc"
                    aria-label="Tạo thư mục gốc"
                    disabled={interaction.disabled}
                    onClick={() => interaction.onRequestCreate(null)}
                >
                    +
                </button>
            </div>
            <div
                className={`tree-root ${interaction.selectedFolderId == null ? 'selected' : ''} ${interaction.dropTarget === 'root' ? 'drop-target' : ''}`}
                onDragOver={(event) => interaction.onDragOver(event, null)}
                onDragLeave={interaction.onDragLeave}
                onDrop={(event) => interaction.onDrop(event, null)}
            >
                <button
                    type="button"
                    disabled={interaction.disabled}
                    onClick={interaction.onOpenRoot}
                >
                    ⌂ <span>Thư mục gốc</span>
                </button>
            </div>
            {request?.folderId === null && (
                <InlineFolderForm
                    key={request.version}
                    parentId={null}
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
                    {folders.map((folder) => (
                        <FolderTreeNode
                            key={folder.id}
                            folder={folder}
                            reload={reload}
                            interaction={interaction}
                        />
                    ))}
                </ul>
            )}
            {!loading && !error && folders.length === 0 && (
                <p className="tree-note">Chưa có thư mục.</p>
            )}
        </nav>
    );
}
