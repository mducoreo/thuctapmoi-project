import { useRef, useState } from 'react';

export default function FolderCreateForm({
                                             disabled = false,
                                             onCreate,
                                             onCancel,
                                         }) {
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const saveLock = useRef(false);

    async function submit(event) {
        event.preventDefault();
        event.stopPropagation();

        if (disabled || saveLock.current) {
            return;
        }

        const folderName = name.trim();

        if (!folderName) {
            setError('Nhập tên thư mục.');
            return;
        }

        saveLock.current = true;
        setSaving(true);
        setError('');

        try {
            await onCreate(folderName);
            onCancel();
        } catch (err) {
            setError(err.message);
        } finally {
            saveLock.current = false;
            setSaving(false);
        }
    }

    return (
        <form
            onSubmit={submit}
            onClick={(event) => event.stopPropagation()}
            style={{
                margin: '8px 0 12px',
                padding: '10px',
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
            }}
        >
            <input
                autoFocus
                aria-label="Tên thư mục mới"
                placeholder="Tên thư mục mới"
                value={name}
                maxLength={100}
                required
                disabled={disabled || saving}
                onChange={(event) => {
                    setName(event.target.value);
                    setError('');
                }}
                style={{
                    width: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    padding: '8px',
                }}
            />

            {error && (
                <p
                    role="alert"
                    style={{
                        color: '#dc2626',
                        overflowWrap: 'anywhere',
                    }}
                >
                    {error}
                </p>
            )}

            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    marginTop: '8px',
                }}
            >
                <button
                    type="submit"
                    disabled={disabled || saving}
                >
                    {saving ? 'Đang tạo...' : 'Tạo'}
                </button>

                <button
                    type="button"
                    disabled={disabled || saving}
                    onClick={onCancel}
                >
                    Hủy
                </button>
            </div>
        </form>
    );
}