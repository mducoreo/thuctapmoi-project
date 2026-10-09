import { useRef, useState } from 'react';
import { api } from './api.js';

export default function DocumentUpload({ folderId, disabled = false }) {
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const inputRef = useRef(null);

    function selectFile(event) {
        setFile(event.target.files?.[0] ?? null);
        setError('');
        setSuccess('');
    }

    async function upload(event) {
        event.preventDefault();

        if (busy || disabled) {
            return;
        }

        setError('');
        setSuccess('');

        if (!file) {
            setError('Bạn cần chọn một file.');
            return;
        }

        setBusy(true);

        try {
            await api.uploadDocument(folderId, file);

            setSuccess(`Đã tải lên file "${file.name}".`);
            setFile(null);

            if (inputRef.current) {
                inputRef.current.value = '';
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <form
            onSubmit={upload}
            style={{
                padding: '16px',
                marginBottom: '20px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
            }}
        >
            <h2>Tải tài liệu lên</h2>

            <label htmlFor="documentFile">Chọn file</label>

            <input
                ref={inputRef}
                id="documentFile"
                type="file"
                onChange={selectFile}
                disabled={busy || disabled}
                style={{
                    display: 'block',
                    margin: '12px 0',
                }}
            />

            {file && <p>File đã chọn: {file.name}</p>}

            <button
                type="submit"
                disabled={busy || disabled || !file}
            >
                {busy ? 'Đang tải lên...' : 'Upload'}
            </button>

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
        </form>
    );
}