import type { FormEvent } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { ProfileCard } from './ProfileCard';

type Props = {
    email: string;
    name: string;
    onNameChange: (v: string) => void;
    saving: boolean;
    message: string | null;
    onSubmit: (e: FormEvent) => void;
};

export function ProfilePersonalCard({
    email,
    name,
    onNameChange,
    saving,
    message,
    onSubmit
}: Props) {
    return (
        <ProfileCard
            slot="half"
            title="Dados pessoais"
            subtitle="Nome e e-mail de acesso"
            icon="badge"
        >
            <form className="profile-modern__form profile-modern__form--balanced" onSubmit={onSubmit}>
                <label className="profile-modern__field">
                    <span>E-mail</span>
                    <input type="email" readOnly value={email} autoComplete="email" className="profile-modern__input" />
                    <span className="profile-modern__field-hint">Não é possível alterar</span>
                </label>
                <label className="profile-modern__field">
                    <span>Nome completo</span>
                    <input
                        id="profile-name"
                        value={name}
                        onChange={(e) => onNameChange(e.target.value)}
                        required
                        autoComplete="name"
                        placeholder="Como quer ser chamado(a)"
                        className="profile-modern__input"
                    />
                </label>
                <div className="profile-modern__form-footer">
                    <button type="submit" className="profile-modern__btn" disabled={saving}>
                        <MaterialIcon name="check" variant="app" />
                        Salvar nome
                    </button>
                    {message ? <p className="profile-modern__feedback">{message}</p> : null}
                </div>
            </form>
        </ProfileCard>
    );
}