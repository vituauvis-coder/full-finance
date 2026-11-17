import type { FormEvent } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { ManualCashOutPrefs } from '../types/profile';
import { ProfileCard } from './ProfileCard';

type Props = {
    prefs: ManualCashOutPrefs;
    saving: boolean;
    message: string | null;
    onChange: (patch: Partial<ManualCashOutPrefs>) => void;
    onSubmit: (e: FormEvent) => void;
};

export function ProfileWalletPrefsCard({ prefs, saving, message, onChange, onSubmit }: Props) {
    const subDisabled = !prefs.enabled;

    return (
        <ProfileCard
            slot="full"
            title="Caixa e pagamentos"
            subtitle="O saldo só muda quando você confirma o pagamento."
            icon="account_balance_wallet"
        >
            <form className="profile-modern__form profile-modern__form--stacked" onSubmit={onSubmit}>
                <label className="profile-modern__check profile-modern__check--block">
                    <input
                        type="checkbox"
                        checked={prefs.enabled}
                        onChange={(e) => onChange({ enabled: e.target.checked })}
                    />
                    <span>Exigir confirmação para debitar</span>
                </label>
                <fieldset className="profile-modern__fieldset" disabled={subDisabled}>
                    <legend className="profile-modern__sr-only">Aplicar a</legend>
                    <label className="profile-modern__check profile-modern__check--block">
                        <input
                            type="checkbox"
                            checked={prefs.creditCard}
                            disabled={subDisabled}
                            onChange={(e) => onChange({ creditCard: e.target.checked })}
                        />
                        <span>Cartão de crédito</span>
                    </label>
                    <label className="profile-modern__check profile-modern__check--block">
                        <input
                            type="checkbox"
                            checked={prefs.loan}
                            disabled={subDisabled}
                            onChange={(e) => onChange({ loan: e.target.checked })}
                        />
                        <span>Empréstimo</span>
                    </label>
                    <label className="profile-modern__check profile-modern__check--block">
                        <input
                            type="checkbox"
                            checked={prefs.monthlyFixed}
                            disabled={subDisabled}
                            onChange={(e) => onChange({ monthlyFixed: e.target.checked })}
                        />
                        <span>Despesas fixas mensais</span>
                    </label>
                </fieldset>
                <div className="profile-modern__form-footer">
                    <button type="submit" className="profile-modern__btn" disabled={saving}>
                        <MaterialIcon name="save" variant="app" />
                        {saving ? 'Salvando…' : 'Salvar'}
                    </button>
                    {message ? <p className="profile-modern__feedback">{message}</p> : null}
                </div>
            </form>
        </ProfileCard>
    );
}