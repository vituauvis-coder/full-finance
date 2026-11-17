import { formatBRL } from '../../../../lib/format';

type PayloadItem = {
    name?: string;
    value?: number | null;
    color?: string;
    dataKey?: string;
};

type Props = {
    active?: boolean;
    payload?: PayloadItem[];
    label?: string;
    currency: string;
};

const LABELS: Record<string, string> = {
    entrada: 'Entradas',
    saida: 'Saídas',
    balanco: 'Balanço',
    saldo: 'Saldo em conta'
};

export function FluxChartTooltip({ active, payload, label, currency }: Props) {
    if (!active || !payload?.length) return null;

    return (
        <div className="flux-chart-tooltip">
            {label ? <div className="flux-chart-tooltip__label">{label}</div> : null}
            <ul className="flux-chart-tooltip__list">
                {payload.map((p) => {
                    const key = String(p.dataKey ?? p.name ?? '');
                    const title = LABELS[key] ?? p.name ?? key;
                    const v = p.value;
                    return (
                        <li key={key} className="flux-chart-tooltip__row">
                            <span
                                className="flux-chart-tooltip__swatch"
                                style={{ background: p.color ?? 'var(--dash-text-tertiary)' }}
                            />
                            <span className="flux-chart-tooltip__name">{title}</span>
                            <span className="flux-chart-tooltip__value">
                                {v == null || Number.isNaN(v) ? '—' : formatBRL(v, currency)}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}