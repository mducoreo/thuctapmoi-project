import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Dùng portal để menu không bị cắt bởi bảng hoặc thanh cuộn của cây.
export default function WorkspaceMenu({ label, disabled, items }) {
    const [position, setPosition] = useState(null);
    const trigger = useRef(null);
    const menu = useRef(null);
    const id = useId();
    useEffect(() => {
        if (!position) {
            return;
        }
        menu.current?.style.setProperty('--menu-left', `${position.left}px`);
        menu.current?.style.setProperty('--menu-top', `${position.top}px`);
        menu.current?.querySelector('button:not(:disabled)')?.focus();
        function close(event) {
            if (
                !menu.current?.contains(event.target) &&
                !trigger.current?.contains(event.target)
            ) {
                setPosition(null);
            }
        }
        function escape(event) {
            if (event.key === 'Escape') {
                event.stopPropagation();
                setPosition(null);
                trigger.current?.focus();
            }
        }
        const hide = () => setPosition(null);
        document.addEventListener('pointerdown', close);
        document.addEventListener('keydown', escape);
        window.addEventListener('resize', hide);
        window.addEventListener('scroll', hide, true);
        return () => {
            document.removeEventListener('pointerdown', close);
            document.removeEventListener('keydown', escape);
            window.removeEventListener('resize', hide);
            window.removeEventListener('scroll', hide, true);
        };
    }, [position]);
    useEffect(() => {
        if (disabled) {
            setPosition(null);
        }
    }, [disabled]);
    function toggle(event) {
        event.stopPropagation();
        if (position) {
            setPosition(null);
            return;
        }
        const rect = trigger.current.getBoundingClientRect();
        const height = Math.min(items.length * 38 + 12, window.innerHeight - 24);
        setPosition({
            left: Math.max(12, Math.min(rect.right - 220, window.innerWidth - 232)),
            top:
                rect.bottom + height < window.innerHeight - 12
                    ? rect.bottom + 4
                    : Math.max(12, rect.top - height - 4),
        });
    }
    return (
        <>
            <button
                ref={trigger}
                type="button"
                className="icon-button"
                disabled={disabled}
                aria-label={label}
                aria-expanded={Boolean(position)}
                aria-controls={position ? id : undefined}
                onClick={toggle}
            >
                ⋯
            </button>
            {position &&
                createPortal(
                    <div
                        ref={menu}
                        id={id}
                        className="workspace-menu"
                        aria-label={label}
                        onKeyDown={(event) => {
                            if (
                                !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(
                                    event.key
                                )
                            ) {
                                return;
                            }
                            event.preventDefault();
                            const buttons = [
                                ...menu.current.querySelectorAll('button:not(:disabled)'),
                            ];
                            const index = buttons.indexOf(document.activeElement);
                            const next =
                                event.key === 'Home'
                                    ? 0
                                    : event.key === 'End'
                                        ? buttons.length - 1
                                        : (index +
                                            (event.key === 'ArrowDown' ? 1 : -1) +
                                            buttons.length) %
                                        buttons.length;
                            buttons[next]?.focus();
                        }}
                    >
                        {items.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                disabled={item.disabled}
                                className={item.danger ? 'menu-danger' : ''}
                                onClick={() => {
                                    setPosition(null);
                                    trigger.current?.focus();
                                    item.onClick();
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </>
    );
}
