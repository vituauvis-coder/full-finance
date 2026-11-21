import { DEBT_COLOR_KEYS, DEBT_COLOR_LABELS, debtColorHex } from '../../domain/debtColors';

type Props = {
    selectedKey: string;
    onSelect: (key: string) => void;
    ariaLabel?: string;
    disabled?: boolean;
    /** `form` omite rótulo interno (o campo já tem label no modal). */
    layout?: 'card' | 'form';
};

export function DebtColorSwatches({
    selectedKey,
    onSelect,
    ariaLabel = 'Cor do card',
    disabled,
    layout = 'card'
}: Props) {
    const key = selectedKey || 'wine';
    const wrapClass =
        layout === 'form' ? 'debt-form-color-swatches' : 'zero-budget__block-colors debts-page__goal-card-colors';
    return (
        <div className={wrapClass}>
            {layout === 'card' ? <span className="zero-budget__colors-label">Cor do card</span> : null}
            <div className="zero-budget__colors-list" role="radiogroup" aria-label={ariaLabel}>
                {DEBT_COLOR_KEYS.map((colorKey) => {
                    const hex = debtColorHex(colorKey);
                    const selected = colorKey === key;
                    const label = DEBT_COLOR_LABELS[colorKey] || colorKey;
                    return (
                        <button
                            key={colorKey}
                            type="button"
                            className={`zero-budget__color-swatch${selected ? ' is-selected' : ''}`}
                            style={{ backgroundColor: hex }}
                            title={label}
                            aria-label={`Cor ${label}`}
                            aria-pressed={selected}
                            disabled={disabled}
                            onClick={() => onSelect(colorKey)}
                        />
                    );
                })}
            </div>
        </div>
    );
}