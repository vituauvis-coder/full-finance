import { MaterialIcon } from '../../icons/MaterialIcon';
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle
} from '../dialog';

export type ConfirmTone = 'default' | 'danger';

export type ConfirmDialogProps = {
    open: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: ConfirmTone;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    tone = 'default',
    busy = false,
    onConfirm,
    onCancel
}: ConfirmDialogProps) {
    const icon = tone === 'danger' ? 'delete_outline' : 'help_outline';

    return (
        <Dialog open={open} onClose={onCancel} id="ui-confirm-dialog">
            <DialogPanel size="sm" className={`ui-confirm-dialog ui-confirm-dialog--${tone}`}>
                <DialogHeader>
                    <DialogTitle>
                        <span className="ui-confirm-dialog__title">
                            <MaterialIcon name={icon} variant="app" opticalSize={22} className="ui-confirm-dialog__icon" />
                            {title}
                        </span>
                    </DialogTitle>
                    <DialogCloseButton />
                </DialogHeader>
                {message ? (
                    <DialogBody>
                        <p className="ui-confirm-dialog__message">{message}</p>
                    </DialogBody>
                ) : null}
                <DialogFooter>
                    <button
                        type="button"
                        className="ui-form-btn ui-form-btn--text"
                        disabled={busy}
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`ui-form-btn${tone === 'danger' ? ' ui-form-btn--danger' : ' ui-form-btn--contained'}`}
                        disabled={busy}
                        autoFocus
                        onClick={onConfirm}
                    >
                        {busy ? 'Aguarde…' : confirmLabel}
                    </button>
                </DialogFooter>
            </DialogPanel>
        </Dialog>
    );
}