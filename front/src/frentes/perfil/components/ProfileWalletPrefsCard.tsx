import type { FormEvent } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { FormCheckbox } from '../../../components/ui/form';
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
            slot="half"
            title="Caixa e pagamentos"
            subtitle="O saldo só muda quando você confirma o pagamento."
            icon="account_balance_wallet"
        >
            <form className="ui-form profile-modern__wallet-prefs-form" onSubmit={onSubmit}>
                <FormCheckbox
                    id="finance-manual-cash-out"
                    label="Exigir confirmação para debitar"
                    checked={prefs.enabled}
                    onChange={(on) => onChange({ enabled: on })}
                />
                <fieldset className="profile-modern__fieldset ui-form-checkboxes" disabled={subDisabled}>
                    <legend className="profile-modern__sr-only">Aplicar a</legend>
                    <FormCheckbox
                        id="finance-manual-credit"
                        label="Cartão de crédito"
                        checked={prefs.creditCard}
                        disabled={subDisabled}
                        onChange={(on) => onChange({ creditCard: on })}
                    />
                    <FormCheckbox
                        id="finance-manual-loan"
                        label="Empréstimo"
                        checked={prefs.loan}
                        disabled={subDisabled}
                        onChange={(on) => onChange({ loan: on })}
                    />
                    <FormCheckbox
                        id="finance-manual-fixed"
                        label="Despesas fixas mensais"
                        checked={prefs.monthlyFixed}
                        disabled={subDisabled}
                        onChange={(on) => onChange({ monthlyFixed: on })}
                    />
                </fieldset>
                <div className="profile-modern__form-footer">
                    <button type="submit" className="ui-form-btn ui-form-btn--contained" disabled={saving}>
                        <MaterialIcon name="save" variant="app" />
                        {saving ? 'Salvando…' : 'Salvar'}
                    </button>
                    {message ? <p className="profile-modern__feedback">{message}</p> : null}
                </div>
            </form>
        </ProfileCard>
    );
}