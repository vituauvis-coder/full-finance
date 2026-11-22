import type { FormEvent } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { ProfileCard } from './ProfileCard';
import { ProfilePasswordForm } from './ProfilePasswordForm';

type Props = {
    email: string;
    name: string;
    onNameChange: (v: string) => void;
    savingName: boolean;
    nameMessage: string | null;
    onSaveName: (e: FormEvent) => void;
    savingPassword: boolean;
    passwordMessage: string | null;
    onSavePassword: Parameters<typeof ProfilePasswordForm>[0]['onSubmit'];
};

export function ProfileAccountAccessCard({
    email,
    name,
    onNameChange,
    savingName,
    nameMessage,
    onSaveName,
    savingPassword,
    passwordMessage,
    onSavePassword
}: Props) {
    return (
        <ProfileCard
            slot="full"
            title="Conta e acesso"
            subtitle="Nome, e-mail e senha"
            icon="badge"
        >
            <div className="profile-modern__inset-split">
                <section
                    className="ui-inset-card profile-modern__inset-panel"
                    aria-labelledby="profile-personal-inset-title"
                >
                    <h4 id="profile-personal-inset-title" className="ui-inset-card__title">
                        <MaterialIcon name="person" variant="app" opticalSize={18} aria-hidden />
                        Dados pessoais
                    </h4>
                    <form
                        className="profile-modern__form profile-modern__form--inset profile-modern__account-form"
                        onSubmit={onSaveName}
                    >
                        <div className="profile-modern__account-fields">
                            <label className="profile-modern__field">
                                <span>E-mail</span>
                                <input
                                    type="email"
                                    readOnly
                                    value={email}
                                    autoComplete="email"
                                    className="profile-modern__input"
                                />
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
                        </div>
                        <div className="profile-modern__form-footer profile-modern__form-footer--inset">
                            <button type="submit" className="ui-form-btn ui-form-btn--contained" disabled={savingName}>
                                <MaterialIcon name="check" variant="app" />
                                {savingName ? 'Salvando…' : 'Salvar nome'}
                            </button>
                            {nameMessage ? <p className="profile-modern__feedback">{nameMessage}</p> : null}
                        </div>
                    </form>
                </section>

                <section
                    className="ui-inset-card profile-modern__inset-panel"
                    aria-labelledby="profile-security-inset-title"
                >
                    <h4 id="profile-security-inset-title" className="ui-inset-card__title">
                        <MaterialIcon name="shield" variant="app" opticalSize={18} aria-hidden />
                        Segurança
                    </h4>
                    <ProfilePasswordForm saving={savingPassword} message={passwordMessage} onSubmit={onSavePassword} />
                </section>
            </div>
        </ProfileCard>
    );
}