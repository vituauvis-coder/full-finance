import { BONUS_PRESETS } from '../../pages/pontos/pontos-format';

function bonusChoices(current: number) {
    const extra = current > 0 && !BONUS_PRESETS.includes(current) ? [current] : [];
    return [...BONUS_PRESETS.filter((p) => p > 0), ...extra].sort((a, b) => a - b);
}

export function TransferBonusToggle({
    value,
    onChange,
    compact = false,
    field = false
}: {
    value: number;
    onChange: (percent: number) => void;
    compact?: boolean;
    field?: boolean;
}) {
    const percent = Math.max(0, Number(value) || 0);
    const options = bonusChoices(percent);
    const compactOn = percent > 0 ? percent : 25;

    if (field) {
        return (
            <select
                className="viagens-field"
                aria-label="Bônus de transferência"
                value={String(percent)}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onChange(Number(e.target.value) || 0)}
            >
                <option value="0">Off</option>
                {options.map((p) => (
                    <option key={p} value={String(p)}>
                        +{p}%
                    </option>
                ))}
            </select>
        );
    }

    return (
        <div
            className={`voo-pay__bonus${percent > 0 ? ' is-on' : ''}${compact ? ' is-compact' : ''}`}
            onClick={(e) => e.stopPropagation()}
        >
            {compact ? null : (
                <div className="voo-pay__bonus-copy">
                    <span>Bônus de transferência</span>
                    <strong>{percent > 0 ? `+${percent}%` : 'Off'}</strong>
                </div>
            )}
            <div className="voo-pay__mode" role="group" aria-label="Bônus de transferência">
                <button
                    type="button"
                    className={percent <= 0 ? 'is-on' : undefined}
                    aria-pressed={percent <= 0}
                    onClick={() => onChange(0)}
                >
                    Off
                </button>
                <button
                    type="button"
                    className={percent > 0 ? 'is-on' : undefined}
                    aria-pressed={percent > 0}
                    onClick={() => onChange(compactOn)}
                >
                    +{compactOn}%
                </button>
            </div>
        </div>
    );
}
