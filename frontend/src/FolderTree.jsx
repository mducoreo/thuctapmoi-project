import { useEffect, useState } from 'react';
import { api } from './api.js';
import FolderTreeNode from './FolderTreeNode.jsx';

export default function FolderTree({ interaction }) {
    const [roots, setRoots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;

        async function loadRoots() {
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
    }, []);

    return (
        <div>
            <h2>Cây thư mục</h2>

            <div
                onDragOver={(event) =>
                    interaction.onDragOver(event, null)
                }
                onDragLeave={interaction.onDragLeave}
                onDrop={(event) =>
                    interaction.onDrop(event, null)
                }
                style={{
                    padding: '12px',
                    marginBottom: '12px',
                    border: '2px dashed #94a3b8',
                    borderRadius: '8px',
                    background:
                        interaction.dropTarget === 'root'
                            ? '#dbeafe'
                            : 'transparent',
                }}
            >
                📂 Thư mục gốc
                <small style={{ display: 'block', marginTop: '4px' }}>
                    Thả folder vào đây để chuyển ra gốc
                </small>
            </div>

            {loading && <p>Đang tải...</p>}
            {error && <p role="alert">{error}</p>}

            {!loading && !error && roots.length === 0 && (
                <p>Chưa có thư mục.</p>
            )}

            {!loading && !error && roots.map((folder) => (
                <FolderTreeNode
                    key={folder.id}
                    folder={folder}
                    interaction={interaction}
                />
            ))}
        </div>
    );
}