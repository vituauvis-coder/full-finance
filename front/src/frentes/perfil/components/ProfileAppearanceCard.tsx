import { ProfileCard } from './ProfileCard';
import { ProfileUiSoundsBlock } from './ProfileUiSoundsBlock';
import { PROFILE_CURRENCIES } from '../types/profile';

type Props = {
    currency: string;
    savingCurrency: boolean;
    appearanceMessage: string | null;
    uiSoundsEnabled: boolean;
    onCurrencyChange: (value: string) => void;
    onUiSoundsChange: (enabled: boolean) => void;
};

export function ProfileAppearanceCard({
    currency,
    savingCurrency,
    appearanceMessage,
    uiSoundsEnabled,
    onCurrencyChange,
    onUiSoundsChange
}: Props) {
    return (
        <ProfileCard
            slot="half"
            title="Aparência e região"
            subtitle="Moeda e tema da interface"
            icon="tune"
        >
            <div className="profile-modern__appearance-grid">
                <div className="profile-modern__appearance-section">
                    <h4 className="profile-modern__section-title">Moeda padrão</h4>
                    <label className="profile-modern__field profile-modern__field--grow">
                        <span>Valores em</span>
                        <select
                            id="default-currency"
                            className="profile-modern__input profile-modern__select"
                            value={currency}
                            disabled={savingCurrency}
                            onChange={(e) => onCurrencyChange(e.target.value)}
                        >
                            {PROFILE_CURRENCIES.map((c) => (
                                <option key={c.value} value={c.value}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                        <span className="profile-modern__field-hint">Saldos, listas e relatórios</span>
                    </label>
                </div>
                <ProfileUiSoundsBlock enabled={uiSoundsEnabled} onChange={onUiSoundsChange} />
            </div>
            <p className="profile-modern__hint">
                O tema claro ou escuro está no menu lateral, em «Modo escuro».
            </p>
            {appearanceMessage ? <p className="profile-modern__feedback">{appearanceMessage}</p> : null}
        </ProfileCard>
    );
}