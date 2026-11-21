import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

type Props = {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    id: string;
    contentClassName?: string;
    labelledBy?: string;
};

export function ZeroBudgetLegacyModal({
    open,
    onClose,
    children,
    id,
    contentClassName = 'modal-content--zero-budget',
    labelledBy
}: Props) {
    useEffect(() => {
        if (!open) return;
        document.body.classList.add('modal-open');
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.body.classList.remove('modal-open');
            document.removeEventListener('keydown', onKey, true);
        };
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div
            id={id}
            className="modal-container active"
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose();
                }
            }}
        >
            <div
                className={`modal-content ${contentClassName}`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>,
        document.body
    );
}