import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { ScreenAccentKey } from '../../../lib/types/profile';
import { PROFILE_CURRENCIES } from '../types/profile';
import { ProfileCard } from './ProfileCard';
import { ProfileScreenColorsSection } from './ProfileScreenColorsSection';
import { ProfileUiSoundsBlock } from './ProfileUiSoundsBlock';

type Props = {
    currency: string;
    savingCurrency: boolean;
    appearanceMessage: string | null;
    uiSoundsEnabled: boolean;
    onCurrencyChange: (value: string) => void;
    onUiSoundsChange: (enabled: boolean) => void;
    screenColorDraft: Record<ScreenAccentKey, string>;
    screenColorsDirty: boolean;
    savingScreenColors: boolean;
    screenColorsMessage: string | null;
    onScreenColorChange: (key: ScreenAccentKey, hex: string) => void;
    onScreenColorReset: (key: ScreenAccentKey) => void;
    onScreenColorsResetAll: () => void;
    onApplyScreenColorPreset: (presetId: string) => void;
    onSaveScreenColors: () => void;
};

export function ProfileAppearanceCard({
    currency,
    savingCurrency,
    appearanceMessage,
    uiSoundsEnabled,
    onCurrencyChange,
    onUiSoundsChange,
    screenColorDraft,
    screenColorsDirty,
    savingScreenColors,
    screenColorsMessage,
    onScreenColorChange,
    onScreenColorReset,
    onScreenColorsResetAll,
    onApplyScreenColorPreset,
    onSaveScreenColors
}: Props) {
    return (
        <ProfileCard
            slot="full"
            title="Aparência e região"
            subtitle="Moeda, sons, tema e cores das telas"
            icon="tune"
        >
            <div className="profile-modern__appearance-stack">
                <section className="ui-inset-card" aria-labelledby="profile-region-title">
                    <h4 id="profile-region-title" className="ui-inset-card__title">
                        <MaterialIcon name="language" variant="app" opticalSize={18} aria-hidden />
                        Moeda e feedback
                    </h4>
                    <div className="profile-modern__appearance-grid profile-modern__appearance-grid--inset">
                        <div className="profile-modern__appearance-section">
                            <label className="profile-modern__field profile-modern__field--grow">
                                <span className="profile-modern__section-title">Moeda padrão</span>
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
                </section>

                <ProfileScreenColorsSection
                    draft={screenColorDraft}
                    dirty={screenColorsDirty}
                    saving={savingScreenColors}
                    message={screenColorsMessage}
                    onColorChange={onScreenColorChange}
                    onResetOne={onScreenColorReset}
                    onResetAll={onScreenColorsResetAll}
                    onApplyPreset={onApplyScreenColorPreset}
                    onSave={onSaveScreenColors}
                />

                <p className="profile-modern__hint profile-modern__hint--flush">
                    O tema claro ou escuro está no menu lateral, em «Tema escuro».
                </p>
                {appearanceMessage ? <p className="profile-modern__feedback">{appearanceMessage}</p> : null}
            </div>
        </ProfileCard>
    );
}