type Swatch = { hex: string; label: string };

type Props = {
    label: string;
    value: string;
    defaultValue: string;
    disabled?: boolean;
    swatches?: Swatch[];
    onChange: (hex: string) => void;
    onReset: () => void;
};

export function AccentColorRow({
    label,
    value,
    defaultValue,
    disabled,
    swatches = [],
    onChange,
    onReset
}: Props) {
    const isDefault = value === defaultValue;

    return (
        <div className="ui-accent-color-row">
            <div className="ui-accent-color-row__head">
                <span className="ui-accent-color-row__label">{label}</span>
                {swatches.length > 0 ? (
                    <div
                        className="ui-accent-color-row__presets"
                        role="group"
                        aria-label={`Cores sugeridas para ${label}`}
                    >
                        {swatches.map((swatch) => (
                            <button
                                key={swatch.hex}
                                type="button"
                                className={`ui-accent-color-row__preset${value === swatch.hex ? ' is-active' : ''}`}
                                style={{ ['--preset-color' as string]: swatch.hex }}
                                title={swatch.label}
                                aria-label={swatch.label}
                                aria-pressed={value === swatch.hex}
                                disabled={disabled}
                                onClick={() => onChange(swatch.hex)}
                            />
                        ))}
                    </div>
                ) : null}
            </div>
            <div className="ui-accent-color-row__controls">
                <label className="ui-accent-color-row__swatch" title={`Cor de ${label}`}>
                    <input
                        type="color"
                        className="ui-accent-color-row__input"
                        value={value}
                        disabled={disabled}
                        onChange={(e) => onChange(e.target.value)}
                        aria-label={`Ajustar cor de ${label}`}
                    />
                    <span
                        className="ui-accent-color-row__preview"
                        style={{ background: value }}
                        aria-hidden
                    />
                </label>
                <button
                    type="button"
                    className="ui-accent-color-row__reset"
                    disabled={disabled || isDefault}
                    onClick={onReset}
                >
                    Padrão
                </button>
            </div>
        </div>
    );
}