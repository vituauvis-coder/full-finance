import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { AccentColorRow } from '../../../components/ui/AccentColorRow';
import type { ScreenAccentKey } from '../../../lib/types/profile';
import {
    DEFAULT_SCREEN_ACCENTS,
    SCREEN_ACCENT_KEYS,
    SCREEN_ACCENT_LABELS,
    SCREEN_ACCENT_QUICK_PICKS,
    SCREEN_ACCENT_THEME_PRESETS
} from '../hooks/useProfileScreenColors';

type Props = {
    draft: Record<ScreenAccentKey, string>;
    dirty: boolean;
    saving: boolean;
    message: string | null;
    onColorChange: (key: ScreenAccentKey, hex: string) => void;
    onResetOne: (key: ScreenAccentKey) => void;
    onResetAll: () => void;
    onApplyPreset: (presetId: string) => void;
    onSave: () => void;
};

export function ProfileScreenColorsSection({
    draft,
    dirty,
    saving,
    message,
    onColorChange,
    onResetOne,
    onResetAll,
    onApplyPreset,
    onSave
}: Props) {
    return (
        <section className="ui-inset-card ui-screen-accent-panel" aria-labelledby="profile-screen-colors-title">
            <h4 id="profile-screen-colors-title" className="ui-inset-card__title">
                <MaterialIcon name="palette" variant="app" opticalSize={18} aria-hidden />
                Cores das telas
            </h4>
            <p className="ui-inset-card__hint">
                Acento usado em botões, filtros e destaques de cada área. Pré-visualize ao ajustar; salve para
                aplicar em todo o app.
            </p>
            <div className="ui-screen-accent-presets" role="group" aria-label="Paletas predefinidas">
                <span className="ui-screen-accent-presets__label">Paletas</span>
                <div className="ui-screen-accent-presets__list">
                    {SCREEN_ACCENT_THEME_PRESETS.map((preset) => (
                        <button
                            key={preset.id}
                            type="button"
                            className="ui-screen-accent-preset"
                            disabled={saving}
                            onClick={() => onApplyPreset(preset.id)}
                        >
                            <span className="ui-screen-accent-preset__swatches" aria-hidden>
                                <span style={{ background: preset.accents.gains }} />
                                <span style={{ background: preset.accents.expenses }} />
                                <span style={{ background: preset.accents.wallet }} />
                            </span>
                            <span className="ui-screen-accent-preset__label">{preset.label}</span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="ui-screen-accent-grid">
                {SCREEN_ACCENT_KEYS.map((key) => (
                    <AccentColorRow
                        key={key}
                        label={SCREEN_ACCENT_LABELS[key]}
                        value={draft[key]}
                        defaultValue={DEFAULT_SCREEN_ACCENTS[key]}
                        swatches={SCREEN_ACCENT_QUICK_PICKS[key]}
                        disabled={saving}
                        onChange={(hex) => onColorChange(key, hex)}
                        onReset={() => onResetOne(key)}
                    />
                ))}
            </div>
            <div className="ui-inset-card__footer">
                <button
                    type="button"
                    className="ui-form-btn ui-form-btn--text"
                    disabled={saving}
                    onClick={onResetAll}
                >
                    Restaurar todas
                </button>
                <button
                    type="button"
                    className="ui-form-btn ui-form-btn--contained"
                    disabled={saving || !dirty}
                    onClick={() => void onSave()}
                >
                    {saving ? 'Salvando…' : 'Salvar cores'}
                </button>
            </div>
            {message ? <p className="profile-modern__feedback ui-inset-card__feedback">{message}</p> : null}
        </section>
    );
}