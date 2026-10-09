import { useState } from 'react';
import { api } from './api.js';

export default function FolderTreeNode({ folder, interaction }) {
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function toggle() {
        if (loading || interaction.disabled) {
            return;
        }

        if (expanded) {
            setExpanded(false);
            return;
        }

        setLoading(true);
        setError('');

        try {
            const data = await api.folders(folder.id);

            setChildren(data);
            setExpanded(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    const isDragging = interaction.draggedFolderId === folder.id;
    const isDropTarget = interaction.dropTarget === String(folder.id);

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
                    padding: '4px',
                    marginBottom: '4px',
                    borderRadius: '6px',
                    background: isDropTarget ? '#dbeafe' : 'transparent',
                    opacity: isDragging ? 0.45 : 1,
                    cursor: interaction.disabled ? 'default' : 'grab',
                }}
            >
                <button
                    type="button"
                    onClick={toggle}
                    disabled={loading || interaction.disabled}
                >
                    {loading ? '…' : expanded ? '▼' : '▶'}
                    {' '}📁 {folder.name}
                </button>
            </div>

            {error && <p role="alert">{error}</p>}

            {expanded && (
                <div style={{ marginLeft: 24 }}>
                    {children.length === 0 ? (
                        <p>Không có thư mục con.</p>
                    ) : (
                        children.map((child) => (
                            <FolderTreeNode
                                key={child.id}
                                folder={child}
                                interaction={interaction}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}