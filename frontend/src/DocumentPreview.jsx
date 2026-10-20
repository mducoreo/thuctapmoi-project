import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import OcrTextViewer from './OcrTextViewer.jsx';
import './DocumentPreview.css';

function readOcrText(data) {
    if (typeof data === 'string') {
        return data;
    }

    return data?.extractedText ?? data?.text ?? '';
}

function createTextFileName(originalName) {
    const name = (originalName || 'tai-lieu')
        .replace(/\.[^.]+$/, '')
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');

    return `${name || 'tai-lieu'}-OCR.txt`;
}

export default function DocumentPreview({
                                            folderId,
                                            document: item,
                                            highlightKeyword = '',
                                            onClose,
                                        }) {
    const dialogRef = useRef(null);

    const [file, setFile] = useState({
        url: '',
        mimeType: '',
        loading: true,
        error: '',
    });

    const [ocr, setOcr] = useState({
        text: '',
        loading: true,
        error: '',
    });

    const [copying, setCopying] = useState(false);
    const [message, setMessage] = useState('');
    const [actionError, setActionError] = useState('');

    const documentId = item.id;
    const mimeType = item.mimeType;
    const originalName = item.originalName;

    // Mở cửa sổ preview.
    useEffect(() => {
        const dialog = dialogRef.current;

        dialog.showModal();

        return () => {
            dialog.close();
        };
    }, []);

    // Lấy file gốc và nội dung OCR độc lập.
    useEffect(() => {
        let active = true;
        let objectUrl = '';

        setFile({
            url: '',
            mimeType: '',
            loading: true,
            error: '',
        });

        setOcr({
            text: '',
            loading: true,
            error: '',
        });

        setMessage('');
        setActionError('');

        async function loadFile() {
            try {
                const blob = await api.documentContent(
                    folderId,
                    documentId
                );

                if (!active) {
                    return;
                }

                objectUrl = URL.createObjectURL(blob);

                setFile({
                    url: objectUrl,
                    mimeType: blob.type || mimeType || '',
                    loading: false,
                    error: '',
                });
            } catch (error) {
                if (!active) {
                    return;
                }

                setFile({
                    url: '',
                    mimeType: '',
                    loading: false,
                    error: error.message || 'Không thể mở file gốc.',
                });
            }
        }

        async function loadOcr() {
            try {
                const data = await api.getExtractedText(
                    folderId,
                    documentId
                );

                if (!active) {
                    return;
                }

                setOcr({
                    text: readOcrText(data),
                    loading: false,
                    error: '',
                });
            } catch (error) {
                if (!active) {
                    return;
                }

                setOcr({
                    text: '',
                    loading: false,
                    error:
                        error.message ||
                        'Không thể lấy nội dung OCR.',
                });
            }
        }

        // File và OCR tải song song; mỗi phần xử lý lỗi riêng.
        void Promise.allSettled([
            loadFile(),
            loadOcr(),
        ]);

        return () => {
            active = false;

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [folderId, documentId, mimeType]);

    const textAvailable =
        !ocr.loading &&
        !ocr.error &&
        Boolean(ocr.text.trim());

    const isPdf = file.mimeType
        .split(';')[0]
        .trim()
        .toLowerCase() === 'application/pdf';

    const isImage = file.mimeType
        .toLowerCase()
        .startsWith('image/');

    async function copyOcrText() {
        if (!textAvailable || copying) {
            return;
        }

        setCopying(true);
        setMessage('');
        setActionError('');

        try {
            if (!navigator.clipboard?.writeText) {
                throw new Error(
                    'Trình duyệt chưa hỗ trợ sao chép tự động ở trang này. ' +
                    'Bạn có thể chọn nội dung OCR và nhấn Ctrl + C.'
                );
            }

            await navigator.clipboard.writeText(ocr.text);

            setMessage('Đã sao chép nội dung OCR.');
        } catch (error) {
            setActionError(
                error.message ||
                'Không thể sao chép. Hãy chọn nội dung và nhấn Ctrl + C.'
            );
        } finally {
            setCopying(false);
        }
    }

    function exportOcrText() {
        if (!textAvailable) {
            return;
        }

        setMessage('');
        setActionError('');

        let url = '';
        let link;

        try {
            const blob = new Blob(
                ['\uFEFF', ocr.text],
                { type: 'text/plain;charset=utf-8' }
            );

            url = URL.createObjectURL(blob);

            link = window.document.createElement('a');
            link.href = url;
            link.download = createTextFileName(originalName);

            window.document.body.appendChild(link);
            link.click();

            setMessage('Đã gửi file TXT cho trình duyệt tải xuống.');
        } catch (error) {
            setActionError(
                error.message || 'Không thể xuất nội dung OCR.'
            );
        } finally {
            link?.remove();

            if (url) {
                // Cho trình duyệt thời gian bắt đầu tải trước khi thu hồi URL.
                window.setTimeout(
                    () => URL.revokeObjectURL(url),
                    60000
                );
            }
        }
    }

    return (
        <dialog
            ref={dialogRef}
            className="document-reader-dialog"
            aria-labelledby="document-reader-title"
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
        >
            <div className="document-reader">
                <header className="document-reader-header">
                    <div>
                        <h2 id="document-reader-title">
                            Xem tài liệu
                        </h2>

                        <p>{item.title || originalName}</p>

                        {item.title && (
                            <small>{originalName}</small>
                        )}
                    </div>

                    <button
                        type="button"
                        autoFocus
                        onClick={onClose}
                    >
                        Đóng
                    </button>
                </header>

                <div className="document-reader-grid">
                    <section className="document-reader-panel">
                        <div className="document-reader-panel-header">
                            <h3>File gốc</h3>

                            {file.url && (
                                <a
                                    href={file.url}
                                    download={originalName}
                                >
                                    Tải file gốc
                                </a>
                            )}
                        </div>

                        <div className="document-reader-file">
                            {file.loading ? (
                                <p role="status">
                                    Đang tải file…
                                </p>
                            ) : file.error ? (
                                <p
                                    className="document-reader-error"
                                    role="alert"
                                >
                                    {file.error}
                                </p>
                            ) : isImage ? (
                                <img
                                    src={file.url}
                                    alt={item.title || originalName}
                                    className="document-reader-image"
                                />
                            ) : isPdf ? (
                                <iframe
                                    src={file.url}
                                    title={`Xem file ${originalName}`}
                                    className="document-reader-pdf"
                                />
                            ) : (
                                <p>
                                    Định dạng này chưa hỗ trợ xem
                                    trực tiếp. Bấm “Tải file gốc”
                                    để mở trên máy.
                                </p>
                            )}
                        </div>
                    </section>

                    <section className="document-reader-panel">
                        <div className="document-reader-panel-header">
                            <h3>Nội dung OCR</h3>

                            <div className="document-reader-actions">
                                <button
                                    type="button"
                                    disabled={
                                        !textAvailable || copying
                                    }
                                    onClick={copyOcrText}
                                >
                                    {copying
                                        ? 'Đang sao chép…'
                                        : 'Sao chép'}
                                </button>

                                <button
                                    type="button"
                                    disabled={!textAvailable}
                                    onClick={exportOcrText}
                                >
                                    Xuất TXT
                                </button>
                            </div>
                        </div>

                        <div className="document-reader-text">
                            {ocr.loading ? (
                                <p role="status">
                                    Đang tải nội dung OCR…
                                </p>
                            ) : ocr.error ? (
                                <p
                                    className="document-reader-error"
                                    role="alert"
                                >
                                    {ocr.error}
                                </p>
                            ) : !ocr.text.trim() ? (
                                <p>
                                    Chưa có nội dung OCR.
                                    Hãy chạy OCR hoặc lưu nội dung
                                    trước khi xem.
                                </p>
                            ) : (
                                <OcrTextViewer
                                    key={`${documentId}:${highlightKeyword}`}
                                    text={ocr.text}
                                    keyword={highlightKeyword}
                                />
                            )}

                            {message && (
                                <p
                                    className="document-reader-success"
                                    role="status"
                                >
                                    {message}
                                </p>
                            )}

                            {actionError && (
                                <p
                                    className="document-reader-error"
                                    role="alert"
                                >
                                    {actionError}
                                </p>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </dialog>
    );
}