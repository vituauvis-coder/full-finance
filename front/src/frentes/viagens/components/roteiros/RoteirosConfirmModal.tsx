import { MaterialIcon } from '../../../../components/icons/MaterialIcon';

type Props = {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onClose: () => void;
};

export function RoteirosConfirmModal({
    open,
    title,
    message,
    confirmLabel = 'Confirmar',
    onConfirm,
    onClose
}: Props) {
    if (!open) return null;

    return (
        <div className="rote-modal-backdrop" role="presentation" onClick={onClose}>
            <div
                className="rote-modal rote-modal--confirm"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="rote-confirm-title"
                aria-describedby="rote-confirm-desc"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="rote-modal__head">
                    <h2 id="rote-confirm-title">{title}</h2>
                    <button type="button" className="rote-modal__close" onClick={onClose} aria-label="Fechar">
                        <MaterialIcon name="close" variant="app" opticalSize={20} />
                    </button>
                </header>
                <p id="rote-confirm-desc" className="rote-confirm__message">
                    {message}
                </p>
                <footer className="rote-modal__foot">
                    <button type="button" className="viagens-btn viagens-btn--ghost" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="viagens-btn viagens-btn--primary rote-confirm__danger"
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmLabel}
                    </button>
                </footer>
            </div>
        </div>
    );
}