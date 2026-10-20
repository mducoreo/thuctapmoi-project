import { useRef, useState } from 'react';

export default function InlineFolderForm({ parentId, interaction, onClose }) {
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const lock = useRef(false);
    async function submit(event) {
        event.preventDefault();
        if (lock.current || interaction.disabled) {
            return;
        }
        if (!name.trim()) {
            setError('Nhập tên thư mục.');
            return;
        }
        lock.current = true;
        setSaving(true);
        setError('');
        try {
            await interaction.onCreateFolder(name.trim(), parentId);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            lock.current = false;
            setSaving(false);
        }
    }
    return (
        <form
            className="tree-inline-form"
            onSubmit={submit}
            onKeyDown={(event) => {
                if (event.key === 'Escape' && !saving) {
                    event.preventDefault();
                    event.stopPropagation();
                    onClose();
                }
            }}
        >
            <input
                autoFocus
                aria-label="Tên thư mục mới"
                placeholder="Tên thư mục mới…"
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={saving || interaction.disabled}
            />
            <div className="tree-inline-actions">
                <button type="submit" disabled={saving || interaction.disabled}>
                    {saving ? 'Đang tạo…' : 'Tạo'}
                </button>
                <button type="button" disabled={saving} onClick={onClose}>
                    Hủy
                </button>
            </div>
            {error && (
                <p className="message error" role="alert">
                    {error}
                </p>
            )}
        </form>
    );
}
