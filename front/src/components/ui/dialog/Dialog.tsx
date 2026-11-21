import {
    createContext,
    type FormEvent,
    type ReactNode,
    useContext,
    useEffect,
    useId
} from 'react';
import { createPortal } from 'react-dom';
import { MaterialIcon } from '../../icons/MaterialIcon';

export type DialogSize = 'sm' | 'md' | 'lg';

type DialogContextValue = {
    onClose: () => void;
    titleId: string;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext() {
    const ctx = useContext(DialogContext);
    if (!ctx) throw new Error('Dialog subcomponents must be used inside <Dialog>.');
    return ctx;
}

type DialogRootProps = {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    id?: string;
};

export function Dialog({ open, onClose, children, id: idProp }: DialogRootProps) {
    const autoId = useId();
    const dialogId = idProp ?? `dialog-${autoId.replace(/:/g, '')}`;
    const titleId = `${dialogId}-title`;

    useEffect(() => {
        if (!open) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener('keydown', onKey, true);
        };
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <DialogContext.Provider value={{ onClose, titleId }}>
            <div id={dialogId} className="ui-dialog" role="presentation">
                <button type="button" className="ui-dialog__backdrop" aria-label="Fechar" onClick={onClose} />
                {children}
            </div>
        </DialogContext.Provider>,
        document.body
    );
}

type DialogPanelProps = {
    children: ReactNode;
    size?: DialogSize;
    className?: string;
};

export function DialogPanel({ children, size = 'md', className }: DialogPanelProps) {
    const { titleId } = useDialogContext();
    const panelClass = ['ui-dialog__panel', `ui-dialog__panel--${size}`, className].filter(Boolean).join(' ');

    return (
        <div
            className={panelClass}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {children}
        </div>
    );
}

export function DialogHeader({ children }: { children: ReactNode }) {
    return <header className="ui-dialog__header">{children}</header>;
}

export function DialogTitle({ children }: { children: ReactNode }) {
    const { titleId } = useDialogContext();
    return (
        <h2 id={titleId} className="ui-dialog__title">
            {children}
        </h2>
    );
}

export function DialogCloseButton() {
    const { onClose } = useDialogContext();
    return (
        <button type="button" className="ui-dialog__close" aria-label="Fechar" onClick={onClose}>
            <MaterialIcon name="close" variant="app" />
        </button>
    );
}

export function DialogBody({ children }: { children: ReactNode }) {
    return <div className="ui-dialog__body">{children}</div>;
}

export function DialogFooter({ children }: { children: ReactNode }) {
    return <footer className="ui-dialog__footer">{children}</footer>;
}

/** Atalho para modais simples (título + conteúdo). */
type DialogFrameProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    id?: string;
    size?: DialogSize;
    panelClassName?: string;
    footer?: ReactNode;
};

export function DialogFrame({
    open,
    onClose,
    title,
    children,
    id,
    size = 'md',
    panelClassName,
    footer
}: DialogFrameProps) {
    return (
        <Dialog open={open} onClose={onClose} id={id}>
            <DialogPanel size={size} className={panelClassName}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogCloseButton />
                </DialogHeader>
                <DialogBody>{children}</DialogBody>
                {footer ? <DialogFooter>{footer}</DialogFooter> : null}
            </DialogPanel>
        </Dialog>
    );
}

export function DialogForm({
    children,
    onSubmit,
    className = 'ui-form',
    id
}: {
    children: ReactNode;
    onSubmit: (e: FormEvent<HTMLFormElement>) => void;
    className?: string;
    id?: string;
}) {
    return (
        <form id={id} className={className} onSubmit={onSubmit} noValidate>
            {children}
        </form>
    );
}