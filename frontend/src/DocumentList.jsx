import { useEffect, useState } from 'react';

export default function DocumentList({ folderId, reload }) {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;

        async function loadDocuments() {
            setDocuments([]);
            setError('');

            if (folderId == null) {
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                const token = localStorage.getItem('accessToken');

                if (!token) {
                    throw new Error('Bạn cần đăng nhập.');
                }

                const response = await fetch(
                    `/api/folders/${encodeURIComponent(folderId)}/documents`,
                    {
                        method: 'GET',
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const text = await response.text();

                let data;

                try {
                    data = text ? JSON.parse(text) : null;
                } catch {
                    data = text;
                }

                if (!response.ok) {
                    throw new Error(
                        typeof data === 'string'
                            ? data
                            : data?.message || 'Không tải được tài liệu.'
                    );
                }

                if (!Array.isArray(data)) {
                    throw new Error(
                        'API danh sách tài liệu chưa trả về một mảng.'
                    );
                }

                if (active) {
                    setDocuments(data);
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

        loadDocuments();

        return () => {
            active = false;
        };
    }, [folderId, reload]);

    if (folderId == null) {
        return null;
    }

    return (
        <section>
            <h2>Tài liệu trong thư mục</h2>

            {loading && <p>Đang tải tài liệu...</p>}

            {error && (
                <p className="message error" role="alert">
                    {error}
                </p>
            )}

            {!loading && !error && (
                documents.length === 0 ? (
                    <p>Chưa có tài liệu nào.</p>
                ) : (
                    <ul className="folders-list">
                        {documents.map((document) => (
                            <li
                                key={document.id}
                                className="folders-item"
                            >
                                <div className="folders-info">
                                    <span
                                        className="folders-icon"
                                        aria-hidden="true"
                                    >
                                        📄
                                    </span>

                                    <div>
                                        <strong>
                                            {document.originalName}
                                        </strong>

                                        <p>
                                            Kích thước:{' '}
                                            {(document.size / 1024).toFixed(1)}
                                            {' '}KB
                                        </p>

                                        <p>
                                            Tải lên:{' '}
                                            {document.uploadedAt
                                                ? new Date(
                                                    document.uploadedAt
                                                ).toLocaleString('vi-VN')
                                                : '—'}
                                        </p>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )
            )}
        </section>
    );
}