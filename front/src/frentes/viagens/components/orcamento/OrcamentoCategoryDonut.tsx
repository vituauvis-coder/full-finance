import { useId, useMemo, useState } from 'react';
import { formatBRL } from '../../utils/map-utils';
import type { buildOrcamentoSnapshot } from './orcamento-model';

type Row = ReturnType<typeof buildOrcamentoSnapshot>['categoryRows'][number];

/**
 * Tom laranja/âmbar da paleta Viagens — cores sólidas (sem transparente),
 * contrastantes no anel escuro; ordem = ranking de gasto na legenda.
 */
const CATEGORY_TONES = [
    'var(--v-coral)',
    'var(--v-ouro)',
    'color-mix(in srgb, var(--v-coral) 45%, var(--v-ouro))',
    'color-mix(in srgb, var(--v-coral) 78%, var(--v-tinta))',
    'color-mix(in srgb, var(--v-ouro) 62%, var(--v-coral))',
    'color-mix(in srgb, var(--v-coral) 28%, var(--v-tinta))'
] as const;

function categorySliceColor(rank: number): string {
    return CATEGORY_TONES[rank % CATEGORY_TONES.length];
}

type Props = {
    rows: Row[];
};

export function OrcamentoCategoryDonut({ rows }: Props) {
    const listId = useId();
    const [active, setActive] = useState<string | null>(null);

    const orderedRows = useMemo(() => [...rows].sort((a, b) => b.used - a.used), [rows]);

    const slices = useMemo(() => {
        const withSpend = orderedRows.filter((r) => r.used > 0);
        return withSpend.map((r, spendRank) => ({
            key: r.id,
            label: r.label,
            value: r.used,
            color: categorySliceColor(spendRank)
        }));
    }, [orderedRows]);

    const sum = slices.reduce((p, s) => p + s.value, 0);
    const empty = sum <= 0;

    const legendItems = useMemo(
        () =>
            orderedRows.map((r, rank) => ({
                key: r.id,
                label: r.label,
                value: r.used,
                color: categorySliceColor(rank),
                pct: sum > 0 && r.used > 0 ? Math.round((r.used / sum) * 100) : 0
            })),
        [orderedRows, sum]
    );

    const r = 70;
    const stroke = 20;
    const c = 2 * Math.PI * r;
    const cx = 80;
    const cy = 80;
    const vb = 160;

    let offset = 0;
    const arcs = slices.map((s) => {
        const frac = sum > 0 ? s.value / sum : 0;
        const len = frac * c;
        const arc = {
            ...s,
            dash: `${len} ${Math.max(0, c - len)}`,
            offset: -offset,
            pct: sum > 0 ? Math.round((s.value / sum) * 100) : 0
        };
        offset += len;
        return arc;
    });

    const focus = active ? legendItems.find((a) => a.key === active) : null;
    const focusPct = focus && sum > 0 && focus.value > 0 ? Math.round((focus.value / sum) * 100) : 0;

    return (
        <div className="orc-donut orc-donut--categories" aria-label="Gastos por categoria">
            <header className="orc-donut-cats__head">
                <span className="orc-donut-cats__kicker">Gastos por categoria</span>
            </header>
            <div className={`orc-donut__stage orc-donut__stage--categories${empty ? ' is-empty' : ''}`}>
                <div className={`orc-donut__figure orc-donut__figure--categories${empty ? ' is-empty' : ''}`}>
                    <svg className="orc-donut__svg" viewBox={`0 0 ${vb} ${vb}`} role="img" aria-labelledby={listId}>
                        <title id={listId}>Distribuição dos gastos por categoria</title>
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
                                            stroke={a.color}
                                            strokeWidth={boost ? stroke + 4 : stroke}
                                            strokeLinecap="round"
                                            strokeDasharray={a.dash}
                                            strokeDashoffset={a.offset}
                                            className={`orc-donut__slice orc-donut__slice--cat${dim ? ' is-dim' : ''}${boost ? ' is-active' : ''}`}
                                            onMouseEnter={() => setActive(a.key)}
                                            onMouseLeave={() => setActive(null)}
                                            onFocus={() => setActive(a.key)}
                                            onBlur={() => setActive(null)}
                                            style={{ pointerEvents: 'stroke' }}
                                            tabIndex={0}
                                            role="graphics-symbol"
                                            aria-label={`${a.label} ${formatBRL(a.value)}`}
                                        />
                                    );
                                })}
                            </g>
                        ) : null}
                    </svg>
                    <div className="orc-donut__center">
                        {focus ? (
                            <>
                                <span className="orc-donut__center-tag orc-donut__center-tag--cat">{focus.label}</span>
                                <strong className="orc-donut__center-val">{formatBRL(focus.value)}</strong>
                                <span className="orc-donut__center-pct">
                                    {focus.value > 0 && sum > 0 ? `${focusPct}% do total` : 'Sem gasto'}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="orc-donut__center-label">{empty ? 'Sem gastos' : 'Total'}</span>
                                <strong className="orc-donut__center-val orc-donut__center-val--coral">
                                    {empty ? '—' : formatBRL(sum)}
                                </strong>
                            </>
                        )}
                    </div>
                </div>

                <div className="orc-donut__legend orc-donut__legend--categories" role="tablist" aria-label="Legenda por categoria">
                    {legendItems.map((s) => {
                        const isOn = active === s.key;
                        return (
                            <button
                                key={s.key}
                                type="button"
                                role="tab"
                                aria-selected={isOn}
                                className={`orc-donut__chip orc-donut__chip--cat${isOn ? ' is-active' : ''}${s.value <= 0 ? ' is-zero' : ''}`}
                                onMouseEnter={() => setActive(s.key)}
                                onMouseLeave={() => setActive(null)}
                                onFocus={() => setActive(s.key)}
                                onBlur={() => setActive(null)}
                                onClick={() => setActive(isOn ? null : s.key)}
                            >
                                <span className="orc-donut__chip-dot" style={{ background: s.color }} aria-hidden />
                                <span className="orc-donut__chip-name">{s.label}</span>
                                <strong className="orc-donut__chip-val">{formatBRL(s.value)}</strong>
                                <span className="orc-donut__chip-pct">
                                    {s.value > 0 && sum > 0 ? `${s.pct}%` : '—'}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}