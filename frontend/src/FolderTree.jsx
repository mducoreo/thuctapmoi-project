import { useEffect, useState } from 'react';
import { api } from './api.js';
import FolderTreeNode from './FolderTreeNode.jsx';
import FolderCreateForm from './FolderCreateForm.jsx';

export default function FolderTree({
                                       interaction,
                                       reload = 0,
                                   }) {
    const [roots, setRoots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreate, setShowCreate] = useState(false);

    const createRequest = interaction.createRequest;

    useEffect(() => {
        let active = true;

        async function loadRoots() {
            setLoading(true);
            setError('');

            try {
                const data = await api.folders();

                if (active) {
                    setRoots(data);
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

        loadRoots();

        return () => {
            active = false;
        };
    }, [reload]);

    // Nút bên phải yêu cầu tạo thư mục gốc.
    useEffect(() => {
        if (!createRequest) return;

        setShowCreate(createRequest.folderId === null);
    }, [createRequest]);

    function startCreate() {
        if (interaction.disabled) return;

        interaction.onClearCreateRequest();
        setShowCreate(true);
    }

    function closeCreate() {
        setShowCreate(false);
        interaction.onClearCreateRequest();
    }

    async function createRoot(name) {
        await interaction.onCreateFolder(name, null);
    }

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                }}
            >
                <h2>Cây thư mục</h2>

                <button
                    type="button"
                    title="Tạo thư mục gốc"
                    aria-label="Tạo thư mục gốc"
                    disabled={interaction.disabled}
                    onClick={startCreate}
                >
                    +
                </button>
            </div>

            {showCreate && (
                <FolderCreateForm
                    disabled={interaction.disabled}
                    onCreate={createRoot}
                    onCancel={closeCreate}
                />
            )}

            {loading && (
                <p role="status">Đang tải...</p>
            )}

            {error && (
                <p role="alert">{error}</p>
            )}

            {!loading && !error && roots.length === 0 && (
                <p>Chưa có thư mục.</p>
            )}

            {!error && roots.map((folder) => (
                <FolderTreeNode
                    key={folder.id}
                    folder={folder}
                    interaction={interaction}
                    foldersReload={reload}
                />
            ))}
        </div>
    );
}