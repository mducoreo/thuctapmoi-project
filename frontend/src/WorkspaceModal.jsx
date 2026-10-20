import { useEffect, useId, useRef } from 'react';

export default function WorkspaceModal({ title, busy = false, onClose, children }) {
    const ref = useRef(null);
    const titleId = useId();
    useEffect(() => {
        const dialog = ref.current;
        dialog.showModal();
        return () => dialog.close();
    }, []);
    return (
        <dialog
            ref={ref}
            className="workspace-modal"
            aria-labelledby={titleId}
            onCancel={(event) => {
                event.preventDefault();
                if (!busy) {
                    onClose();
                }
            }}
        >
            <header className="workspace-modal-header">
                <h2 id={titleId}>{title}</h2>
                <button
                    type="button"
                    className="icon-button"
                    aria-label="Đóng hộp thoại"
                    disabled={busy}
                    onClick={onClose}
                >
                    ×
                </button>
            </header>
            {children}
        </dialog>
    );
}
