import { useEffect, useState, type FormEvent } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { FormField, FormInput } from '../../../components/ui/form';
import { verifyCurrentPassword } from '../api/profileApi';

type Props = {
    saving: boolean;
    message: string | null;
    onSubmit: (
        e: FormEvent,
        fields: { current: string; next: string; confirm: string }
    ) => void | Promise<void>;
};

type Step = 'current' | 'new';

export function ProfilePasswordForm({ saving, message, onSubmit }: Props) {
    const [step, setStep] = useState<Step>('current');
    const [current, setCurrent] = useState('');
    const [verifiedCurrent, setVerifiedCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [localMessage, setLocalMessage] = useState<string | null>(null);

    const feedback = localMessage ?? message;

    const resetToCurrentStep = () => {
        setStep('current');
        setVerifiedCurrent('');
        setCurrent('');
        setNext('');
        setConfirm('');
        setLocalMessage(null);
    };

    const continueWithCurrent = async () => {
        const value = current.trim();
        if (!value) {
            setLocalMessage('Informe a senha atual.');
            return;
        }
        setVerifying(true);
        setLocalMessage(null);
        try {
            await verifyCurrentPassword(value);
            setVerifiedCurrent(value);
            setCurrent('');
            setStep('new');
        } catch (err) {
            setLocalMessage(err instanceof Error ? err.message : 'Senha atual incorreta.');
        } finally {
            setVerifying(false);
        }
    };

    const handleSubmitNew = (e: FormEvent) => {
        void onSubmit(e, { current: verifiedCurrent, next, confirm });
    };

    useEffect(() => {
        if (message !== 'Senha atualizada.' || step !== 'new') return;
        setStep('current');
        setVerifiedCurrent('');
        setCurrent('');
        setNext('');
        setConfirm('');
        setLocalMessage(null);
    }, [message, step]);

    if (step === 'current') {
        return (
            <div className="profile-modern__password-steps profile-modern__password-steps--current profile-modern__account-form">
                <div className="profile-modern__account-fields">
                    <FormField id="profile-current-password" label="Senha atual" hint={'\u200b'}>
                        <FormInput
                            id="profile-current-password"
                            type="password"
                            autoComplete="current-password"
                            value={current}
                            onChange={(e) => setCurrent(e.target.value)}
                            disabled={verifying}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void continueWithCurrent();
                                }
                            }}
                        />
                    </FormField>
                    <div className="profile-modern__account-field-spacer" aria-hidden />
                </div>
                <div className="profile-modern__form-footer profile-modern__form-footer--inset">
                    <button
                        type="button"
                        className="ui-form-btn ui-form-btn--contained"
                        disabled={verifying || !current.trim()}
                        onClick={() => void continueWithCurrent()}
                    >
                        <MaterialIcon name="arrow_forward" variant="app" />
                        {verifying ? 'Verificando…' : 'Continuar'}
                    </button>
                    {feedback ? <p className="profile-modern__feedback">{feedback}</p> : null}
                </div>
            </div>
        );
    }

    return (
        <form
            className="profile-modern__password-steps profile-modern__account-form"
            onSubmit={handleSubmitNew}
        >
            <div className="profile-modern__account-fields">
                <FormField id="profile-new-password" label="Nova senha" hint="Mínimo 6 caracteres">
                    <FormInput
                        id="profile-new-password"
                        type="password"
                        autoComplete="new-password"
                        minLength={6}
                        value={next}
                        onChange={(e) => setNext(e.target.value)}
                        required
                        disabled={saving}
                    />
                </FormField>
                <FormField id="profile-confirm-password" label="Confirmar nova senha">
                    <FormInput
                        id="profile-confirm-password"
                        type="password"
                        autoComplete="new-password"
                        minLength={6}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        disabled={saving}
                    />
                </FormField>
            </div>
            <div className="profile-modern__form-footer profile-modern__form-footer--inset profile-modern__password-actions">
                <button
                    type="button"
                    className="ui-form-btn ui-form-btn--text"
                    disabled={saving}
                    onClick={resetToCurrentStep}
                >
                    Voltar
                </button>
                <button type="submit" className="ui-form-btn ui-form-btn--contained" disabled={saving}>
                    <MaterialIcon name="key" variant="app" />
                    {saving ? 'Atualizando…' : 'Atualizar senha'}
                </button>
            </div>
            {feedback ? <p className="profile-modern__feedback">{feedback}</p> : null}
        </form>
    );
}