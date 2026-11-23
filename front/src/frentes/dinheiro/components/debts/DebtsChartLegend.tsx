import { debtColorHex } from '../../domain/debtColors';
import type { DebtsChartSeries } from './buildDebtsChartSeries';

type Props = {
    series: DebtsChartSeries[];
};

export function DebtsChartLegend({ series }: Props) {
    const totalColor = debtColorHex('wine');

    return (
        <footer className="debts-balance-chart__foot">
            <ul className="debts-balance-chart__legend" aria-label="Legenda do gráfico">
                <li title="Total das dívidas no mês">
                    <span
                        className="debts-balance-chart__swatch"
                        style={{
                            background: `color-mix(in srgb, ${totalColor} 55%, var(--dash-surface-bg))`,
                            boxShadow: `0 0 0 1px color-mix(in srgb, ${totalColor} 40%, transparent)`
                        }}
                    />
                    <span className="debts-balance-chart__legend-label">Total</span>
                </li>
                {series.map((s) => (
                    <li key={s.key} title={s.label}>
                        <span
                            className="debts-balance-chart__swatch debts-balance-chart__swatch--line"
                            style={{
                                background: s.color,
                                boxShadow: `0 0 0 1px color-mix(in srgb, ${s.color} 35%, transparent)`,
                                opacity: s.closed ? 0.72 : 1
                            }}
                        />
                        <span className="debts-balance-chart__legend-label">{s.label}</span>
                    </li>
                ))}
            </ul>
        </footer>
    );
}