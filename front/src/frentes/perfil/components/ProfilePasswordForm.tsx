import { useState, type FormEvent } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';

type Props = {
    saving: boolean;
    message: string | null;
    onSubmit: (
        e: FormEvent,
        fields: { current: string; next: string; confirm: string }
    ) => void | Promise<void>;
};

export function ProfilePasswordForm({ saving, message, onSubmit }: Props) {
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');

    return (
        <form
            className="profile-modern__form profile-modern__form--balanced profile-modern__form--password"
            onSubmit={(e) => {
                void onSubmit(e, { current, next, confirm });
            }}
        >
            <label className="profile-modern__field">
                <span>Senha atual</span>
                <input
                    type="password"
                    autoComplete="current-password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    required
                    className="profile-modern__input"
                />
            </label>
            <label className="profile-modern__field">
                <span>Nova senha</span>
                <input
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    required
                    className="profile-modern__input"
                />
                <span className="profile-modern__field-hint">Mínimo 6 caracteres</span>
            </label>
            <label className="profile-modern__field profile-modern__field--span">
                <span>Confirmar nova senha</span>
                <input
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="profile-modern__input"
                />
            </label>
            <div className="profile-modern__form-footer">
                <button type="submit" className="profile-modern__btn" disabled={saving}>
                    <MaterialIcon name="key" variant="app" />
                    Atualizar senha
                </button>
                {message ? <p className="profile-modern__feedback">{message}</p> : null}
            </div>
        </form>
    );
}