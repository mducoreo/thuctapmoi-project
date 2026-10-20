import { useEffect, useMemo, useRef, useState } from 'react';

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default function OcrTextViewer({ text = '', keyword = '' }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const matchRefs = useRef([]);

    const searchText = keyword.trim();

    const { parts, total } = useMemo(() => {
        if (!searchText) {
            return {
                parts: [{ text, matchIndex: null }],
                total: 0,
            };
        }

        const pattern = new RegExp(escapeRegExp(searchText), 'giu');
        const parts = [];

        let lastIndex = 0;
        let total = 0;

        for (const match of text.matchAll(pattern)) {
            if (match.index > lastIndex) {
                parts.push({
                    text: text.slice(lastIndex, match.index),
                    matchIndex: null,
                });
            }

            parts.push({
                text: match[0],
                matchIndex: total,
            });

            total += 1;
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < text.length) {
            parts.push({
                text: text.slice(lastIndex),
                matchIndex: null,
            });
        }

        return { parts, total };
    }, [text, searchText]);

    // Khi nội dung hoặc từ khóa đổi, chọn kết quả đầu tiên.
    useEffect(() => {
        setActiveIndex(0);
    }, [text, searchText]);

    // Tự cuộn đến vị trí đang chọn trong khung nội dung.
    useEffect(() => {
        matchRefs.current[activeIndex]?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
        });
    }, [activeIndex, parts]);

    function goToMatch(direction) {
        if (total === 0) {
            return;
        }

        setActiveIndex((current) =>
            (current + direction + total) % total
        );
    }

    return (
        <section className="ocr-viewer">
            {searchText && (
                <div className="ocr-viewer-toolbar">
                    <span role="status" aria-live="polite">
                        {total > 0
                            ? `Vị trí ${activeIndex + 1} / ${total}`
                            : 'Không có cụm từ khớp trực tiếp trong nội dung OCR.'}
                    </span>

                    <div className="ocr-viewer-navigation">
                        <button
                            type="button"
                            disabled={total === 0}
                            onClick={() => goToMatch(-1)}
                            aria-label="Đến kết quả trước"
                        >
                            ← Trước
                        </button>

                        <button
                            type="button"
                            disabled={total === 0}
                            onClick={() => goToMatch(1)}
                            aria-label="Đến kết quả sau"
                        >
                            Sau →
                        </button>
                    </div>
                </div>
            )}

            <div
                className="ocr-viewer-content"
                tabIndex={0}
                role="region"
                aria-label="Nội dung OCR và các vị trí khớp từ khóa"
            >
                {!text ? (
                    <p>Chưa có nội dung OCR.</p>
                ) : (
                    parts.map((part, index) =>
                        part.matchIndex === null ? (
                            <span key={index}>{part.text}</span>
                        ) : (
                            <mark
                                key={index}
                                ref={(element) => {
                                    matchRefs.current[part.matchIndex] = element;
                                }}
                                className={
                                    part.matchIndex === activeIndex
                                        ? 'ocr-match ocr-match-active'
                                        : 'ocr-match'
                                }
                            >
                                {part.text}
                            </mark>
                        )
                    )
                )}
            </div>
        </section>
    );
}