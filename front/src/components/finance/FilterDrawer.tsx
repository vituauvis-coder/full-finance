import { type ReactNode } from 'react';
import { MaterialIcon } from '../icons/MaterialIcon';
import { createPortal } from 'react-dom';

type Props = {
    id: string;
    title: string;
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
};

export function FilterDrawer({ id, title, open, onClose, children, footer }: Props) {
    if (!open) return null;

    return createPortal(
        <div id={id} className="filter-drawer filter-drawer--open" aria-hidden="false" role="dialog" aria-modal="true">
            <button type="button" className="filter-drawer__backdrop" aria-label="Fechar" onClick={onClose}></button>
            <div className="filter-drawer__panel">
                <header className="filter-drawer__header">
                    <h2 className="filter-drawer__title">{title}</h2>
                    <button type="button" className="filter-drawer__close" aria-label="Fechar filtros" onClick={onClose}>
                        <MaterialIcon name="close" variant="app" />
                    </button>
                </header>
                <div className="filter-drawer__body">{children}</div>
                {footer ? <footer className="filter-drawer__footer">{footer}</footer> : null}
            </div>
        </div>,
        document.body
    );
}