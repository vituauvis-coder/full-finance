import { useId, useState } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { DEBT_COLOR_KEYS, DEBT_COLOR_LABELS, debtColorHex, type DebtColorKey } from '../../domain/debtColors';

type Props = {
    debtName: string;
    selectedKey?: string;
    onSelect: (colorKey: DebtColorKey) => void | Promise<void>;
};

export function DebtColorPicker({ debtName, selectedKey, onSelect }: Props) {
    const [expanded, setExpanded] = useState(false);
    const listId = useId();
    const currentHex = debtColorHex(selectedKey);
    const colorLabel =
        selectedKey && DEBT_COLOR_LABELS[selectedKey as DebtColorKey]
            ? DEBT_COLOR_LABELS[selectedKey as DebtColorKey]
            : 'Escolher cor';

    return (
        <div
            className={`zero-budget__block-colors${expanded ? ' zero-budget__block-colors--expanded' : ''}`}
            data-zb-block-colors=""
        >
            <button
                type="button"
                className="zero-budget__color-toggle"
                aria-expanded={expanded}
                aria-controls={listId}
                title="Cor do card"
                onClick={(e) => {
                    e.stopPropagation();
                    setExpanded((v) => !v);
                }}
            >
                <span
                    className="zero-budget__color-toggle-preview"
                    style={{ backgroundColor: currentHex }}
                    aria-hidden="true"
                />
                <span className="zero-budget__color-toggle-label">{colorLabel}</span>
                <MaterialIcon
                    name={expanded ? 'expand_less' : 'expand_more'}
                    variant="app"
                    filled={false}
                    weight={500}
                    opticalSize={18}
                    className="zero-budget__color-toggle-chevron"
                />
            </button>
            {expanded ? (
                <div
                    id={listId}
                    className="zero-budget__colors-popover"
                    role="group"
                    aria-label={`Cor ${debtName}`}
                >
                    <div className="zero-budget__colors-list">
                        {DEBT_COLOR_KEYS.map((key) => (
                            <button
                                key={key}
                                type="button"
                                className={`zero-budget__color-swatch${selectedKey === key ? ' is-selected' : ''}`}
                                style={{ backgroundColor: debtColorHex(key) }}
                                title={DEBT_COLOR_LABELS[key]}
                                aria-label={`Cor ${DEBT_COLOR_LABELS[key]}`}
                                aria-pressed={selectedKey === key}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void onSelect(key);
                                }}
                            />
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}