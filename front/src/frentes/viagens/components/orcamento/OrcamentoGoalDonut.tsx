import { useId, useState } from 'react';
import { formatBRL } from '../../utils/map-utils';

type Props = {
    effectiveGoal: number;
    cofrinhoRemaining: number;
    cofrinhoUsed: number;
    stillToSave: number;
};

type SliceKey = 'saved' | 'used' | 'still';

function goalSliceColor(key: SliceKey): string {
    if (key === 'used') {
        return 'color-mix(in srgb, var(--v-ouro) 92%, var(--v-janela))';
    }
    const mix: Record<'saved' | 'still', number> = { saved: 92, still: 30 };
    return `color-mix(in srgb, var(--v-turquesa) ${mix[key]}%, transparent)`;
}

const LABELS: Record<SliceKey, string> = {
    saved: 'No cofrinho',
    used: 'Saiu do cofrinho',
    still: 'Falta juntar'
};

/** Meta: saldo no cofrinho, o que já saiu de lá e o que falta juntar. */
export function OrcamentoGoalDonut({
    effectiveGoal,
    cofrinhoRemaining,
    cofrinhoUsed,
    stillToSave
}: Props) {
    const listId = useId();
    const [active, setActive] = useState<SliceKey | null>(null);

    const r = 70;
    const stroke = 20;
    const c = 2 * Math.PI * r;
    const cx = 80;
    const cy = 80;
    const vb = 160;

    const slices: { key: SliceKey; value: number }[] = [
        { key: 'saved', value: Math.max(0, cofrinhoRemaining) },
        { key: 'used', value: Math.max(0, cofrinhoUsed) },
        { key: 'still', value: Math.max(0, stillToSave) }
    ];

    const sum = slices.reduce((p, s) => p + s.value, 0);
    const hasGoal = effectiveGoal > 0;
    const empty = !hasGoal || sum <= 0;

    let offset = 0;
    const arcs = slices.map((s) => {
        const frac = sum > 0 ? s.value / sum : 0;
        const len = frac * c;
        const arc = {
            ...s,
            dash: `${len} ${Math.max(0, c - len)}`,
            offset: -offset,
            pct: hasGoal ? Math.round((s.value / effectiveGoal) * 100) : 0
        };
        offset += len;
        return arc;
    });

    const focus = active ? arcs.find((a) => a.key === active) : null;
    const savedTotal = cofrinhoRemaining + cofrinhoUsed;

    return (
        <div className="orc-donut orc-donut--goal" aria-label="Progresso do cofrinho em direção à meta">
            <div className={`orc-donut__stage${empty ? ' is-empty' : ''}`}>
                <div className={`orc-donut__figure${empty ? ' is-empty' : ''}`}>
                    <svg className="orc-donut__svg" viewBox={`0 0 ${vb} ${vb}`} role="img" aria-labelledby={listId}>
                        <title id={listId}>Meta, saldo e uso do cofrinho da viagem</title>
                        <circle cx={cx} cy={cy} r={r} className="orc-donut__track" strokeWidth={stroke} fill="none" />
                        {!empty ? (
                            <g transform={`rotate(-90 ${cx} ${cy})`}>
                                {arcs.map((a) => {
                                    if (a.value <= 0) return null;
                                    const dim = active != null && active !== a.key;
                                    const boost = active === a.key;
                                    return (
                                        <circle
                                            key={a.key}
                                            cx={cx}
                                            cy={cy}
                                            r={r}
                                            fill="none"
                                            stroke={goalSliceColor(a.key)}
                                            strokeWidth={boost ? stroke + 4 : stroke}
                                            strokeLinecap="round"
                                            strokeDasharray={a.dash}
                                            strokeDashoffset={a.offset}
                                            className={`orc-donut__slice orc-donut__slice--${a.key}${dim ? ' is-dim' : ''}${boost ? ' is-active' : ''}`}
                                            onMouseEnter={() => setActive(a.key)}
                                            onMouseLeave={() => setActive(null)}
                                            onFocus={() => setActive(a.key)}
                                            onBlur={() => setActive(null)}
                                            style={{ pointerEvents: 'stroke' }}
                                            tabIndex={0}
                                            role="graphics-symbol"
                                            aria-label={`${LABELS[a.key]} ${formatBRL(a.value)}`}
                                        />
                                    );
                                })}
                            </g>
                        ) : null}
                    </svg>
                    <div className="orc-donut__center">
                        {focus ? (
                            <>
                                <span className={`orc-donut__center-tag orc-donut__center-tag--${focus.key}`}>
                                    {LABELS[focus.key]}
                                </span>
                                <strong className="orc-donut__center-val">{formatBRL(focus.value)}</strong>
                                {hasGoal ? <span className="orc-donut__center-pct">{focus.pct}% da meta</span> : null}
                            </>
                        ) : (
                            <>
                                <span className="orc-donut__center-label">{hasGoal ? 'Meta' : 'Sem meta'}</span>
                                <strong className="orc-donut__center-val">{hasGoal ? formatBRL(effectiveGoal) : '—'}</strong>
                                {hasGoal && savedTotal > 0 ? (
                                    <span className="orc-donut__center-pct">
                                        {Math.round((savedTotal / effectiveGoal) * 100)}% já no cofrinho
                                    </span>
                                ) : null}
                            </>
                        )}
                    </div>
                </div>

                <div className="orc-donut__legend" role="tablist" aria-label="Legenda do cofrinho">
                    {slices.map((s) => {
                        const arc = arcs.find((a) => a.key === s.key);
                        const isOn = active === s.key;
                        return (
                            <button
                                key={s.key}
                                type="button"
                                role="tab"
                                aria-selected={isOn}
                                className={`orc-donut__chip orc-donut__chip--${s.key}${isOn ? ' is-active' : ''}${s.value <= 0 ? ' is-zero' : ''}`}
                                onMouseEnter={() => setActive(s.key)}
                                onMouseLeave={() => setActive(null)}
                                onFocus={() => setActive(s.key)}
                                onBlur={() => setActive(null)}
                                onClick={() => setActive(isOn ? null : s.key)}
                            >
                                <span className="orc-donut__chip-dot" aria-hidden />
                                <span className="orc-donut__chip-name">{LABELS[s.key]}</span>
                                <strong className="orc-donut__chip-val">{formatBRL(s.value)}</strong>
                                {hasGoal && arc ? <span className="orc-donut__chip-pct">{arc.pct}%</span> : null}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}