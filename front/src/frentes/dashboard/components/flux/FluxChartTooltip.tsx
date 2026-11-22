import { formatBRL } from '../../../../lib/format';
import type { FluxPoint } from './fluxChartData';
import { colorWithAlpha, readDashboardExpenseBuckets, readFinancialChartColors } from './fluxChartTheme';

type PayloadItem = {
    name?: string;
    value?: number | null;
    color?: string;
    dataKey?: string;
    payload?: FluxPoint;
};

type Props = {
    active?: boolean;
    payload?: PayloadItem[];
    label?: string;
    currency: string;
    /** Sobrescreve rótulos padrão do fluxo (ex.: séries de dívidas). */
    labels?: Record<string, string>;
};

export function FluxChartTooltip({ active, payload, label, currency, labels }: Props) {
    if (!active || !payload?.length) return null;

    const point = payload[0]?.payload;
    if (!point) return null;

    const colors = readFinancialChartColors();
    const buckets = readDashboardExpenseBuckets();

    const rows: { id: string; title: string; value: number; color: string }[] = [
        { id: 'entrada', title: labels?.entrada ?? 'Entradas', value: point.entrada, color: colors.ganhos },
        {
            id: 'fixa',
            title: labels?.saidaFixa ?? 'Despesas fixas',
            value: point.saidaFixa,
            color: buckets.fixa
        },
        {
            id: 'fatura',
            title: labels?.saidaFatura ?? 'Faturas',
            value: point.saidaFatura,
            color: colorWithAlpha(buckets.fatura, 0.52)
        },
        {
            id: 'balanco',
            title: labels?.balanco ?? 'Balanço',
            value: point.balanco,
            color: colors.saldoPos
        },
        {
            id: 'extra',
            title: labels?.saidaExtra ?? 'Saídas extras',
            value: point.saidaExtra,
            color: buckets.extra
        },
        {
            id: 'cofrinho',
            title: labels?.saidaCofrinho ?? 'Cofrinhos',
            value: point.saidaCofrinho,
            color: buckets.cofrinhos
        }
    ];

    if (point.saldo != null && Number.isFinite(point.saldo)) {
        rows.push({
            id: 'saldo',
            title: labels?.saldo ?? 'Saldo em conta',
            value: point.saldo,
            color: colors.saldoTotal
        });
    }

    const visible = rows.filter((r) => {
        if (r.id === 'entrada' || r.id === 'balanco') return true;
        if (r.id === 'saldo') return true;
        return r.value > 0;
    });

    if (!visible.length) return null;

    return (
        <div className="flux-chart-tooltip">
            {label ? <div className="flux-chart-tooltip__label">{label}</div> : null}
            <ul className="flux-chart-tooltip__list">
                {visible.map((r) => (
                    <li key={r.id} className="flux-chart-tooltip__row">
                        <span className="flux-chart-tooltip__swatch" style={{ background: r.color }} aria-hidden />
                        <span className="flux-chart-tooltip__name">{r.title}</span>
                        <span className="flux-chart-tooltip__value">{formatBRL(r.value, currency)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}