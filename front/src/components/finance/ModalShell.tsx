import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

type Props = {
    open: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    id?: string;
};

export function ModalShell({ open, title, onClose, children, id }: Props) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div id={id} className="modal-container" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
            <button type="button" className="modal-overlay" aria-label="Fechar" onClick={onClose}></button>
            <div className="modal">
                <header className="modal-header">
                    <h3 id={`${id}-title`}>{title}</h3>
                    <button type="button" className="modal-close" aria-label="Fechar" onClick={onClose}>
                        ×
                    </button>
                </header>
                {children}
            </div>
        </div>,
        document.body
    );
}