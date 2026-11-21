import { type ReactNode } from 'react';
import { DialogFrame, type DialogSize } from '../ui/dialog';

type Props = {
    open: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    id?: string;
    size?: DialogSize;
};

/** Wrapper fino — prefira `Dialog` / `DialogFrame` em código novo. */
export function ModalShell({ open, title, onClose, children, id, size }: Props) {
    return (
        <DialogFrame open={open} title={title} onClose={onClose} id={id} size={size}>
            {children}
        </DialogFrame>
    );
}