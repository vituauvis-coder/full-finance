import { useEffect, useState } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';

type Props = {
    open: boolean;
    email: string;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
};

export function ProfileDeleteAccountDialog({ open, email, busy, error, onClose, onConfirm }: Props) {
    const [confirmEmail, setConfirmEmail] = useState('');

    useEffect(() => {
        if (open) setConfirmEmail('');
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const canConfirm = confirmEmail === email && !busy;

    return (
        <div className="profile-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-delete-title">
            <button type="button" className="profile-delete-dialog__backdrop" aria-label="Fechar" onClick={onClose} />
            <div className="profile-delete-dialog__panel">
                <button type="button" className="profile-delete-dialog__close" onClick={onClose} aria-label="Fechar">
                    ×
                </button>
                <h3 id="profile-delete-title" className="profile-delete-dialog__title">
                    <MaterialIcon name="warning" variant="app" />
                    Confirmar exclusão de conta
                </h3>
                <div className="profile-delete-dialog__body">
                    <div className="profile-delete-dialog__alert">
                        <p className="profile-delete-dialog__alert-lead">Esta ação é irreversível.</p>
                        <p>Serão removidos permanentemente: contas, movimentos, metas, cartões, foto e configurações.</p>
                    </div>
                    <label className="profile-modern__field">
                        <span>Para confirmar, digite seu e-mail</span>
                        <input
                            type="email"
                            autoComplete="email"
                            value={confirmEmail}
                            disabled={busy}
                            placeholder="Digite seu e-mail completo"
                            className="profile-modern__input"
                            onChange={(e) => setConfirmEmail(e.target.value)}
                        />
                        <span className="profile-modern__field-hint">
                            Você deve digitar exatamente: <strong>{email}</strong>
                        </span>
                    </label>
                    {error ? <p className="profile-modern__feedback profile-modern__feedback--error">{error}</p> : null}
                </div>
                <div className="profile-delete-dialog__footer">
                    <button
                        type="button"
                        className="profile-modern__btn profile-modern__btn--secondary"
                        disabled={busy}
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="profile-modern__btn profile-modern__btn--danger"
                        disabled={!canConfirm}
                        onClick={() => void onConfirm()}
                    >
                        <MaterialIcon name="delete_forever" variant="app" />
                        {busy ? 'Excluindo…' : 'Excluir minha conta'}
                    </button>
                </div>
            </div>
        </div>
    );
}