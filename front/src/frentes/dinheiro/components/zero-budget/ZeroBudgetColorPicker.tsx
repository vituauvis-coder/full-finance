import { useId, useState } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { ZERO_BUDGET_COLORS, getColorHex } from '../../domain/zeroBudgetColors';

type Props = {
    categoryName: string;
    selectedColor?: string;
    onSelect: (colorClass: string) => void | Promise<void>;
};

export function ZeroBudgetColorPicker({ categoryName, selectedColor, onSelect }: Props) {
    const [expanded, setExpanded] = useState(false);
    const listId = useId();
    const currentHex = getColorHex(selectedColor);

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
                title="Cor da meta"
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
                <span className="zero-budget__color-toggle-label">Cor</span>
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
                    aria-label={`Cor ${categoryName}`}
                >
                    <div className="zero-budget__colors-list">
                        {ZERO_BUDGET_COLORS.map((c) => (
                            <button
                                key={c.class}
                                type="button"
                                className={`zero-budget__color-swatch${selectedColor === c.class ? ' is-selected' : ''}`}
                                style={{ backgroundColor: c.hex }}
                                title={c.label}
                                aria-label={`Cor ${c.label}`}
                                aria-pressed={selectedColor === c.class}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void onSelect(c.class);
                                }}
                            />
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}