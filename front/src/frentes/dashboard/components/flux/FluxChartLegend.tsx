import { colorWithAlpha } from './fluxChartTheme';
import { useFluxAccentColors } from './useFluxAccentColors';
import type { FluxChartViz } from '../../hooks/useFinancialFluxChart';

type Props = {
    viz: FluxChartViz;
    showSaldoTotal?: boolean;
};

export function FluxChartLegend({ viz, showSaldoTotal = false }: Props) {
    const { colors, buckets } = useFluxAccentColors();

    const items =
        viz === 'line'
            ? [
                  { label: 'Entradas', color: colors.ganhos },
                  { label: 'Despesas fixas', color: buckets.fixa },
                  { label: 'Faturas', color: colorWithAlpha(buckets.fatura, 0.52) },
                  { label: 'Saídas extras', color: buckets.extra },
                  { label: 'Cofrinhos', color: buckets.cofrinhos },
                  { label: 'Balanço', color: colors.saldoPos },
                  ...(showSaldoTotal ? [{ label: 'Saldo em conta', color: colors.saldoTotal }] : [])
              ]
            : [
                  { label: 'Entradas', color: colors.ganhos },
                  { label: 'Saídas fixas', color: buckets.fixa },
                  { label: 'Balanço', color: colors.saldoPos },
                  { label: 'Cofrinhos', color: buckets.cofrinhos },
                  { label: 'Saídas extras', color: buckets.extra },
                  ...(showSaldoTotal ? [{ label: 'Saldo em conta', color: colors.saldoTotal }] : [])
              ];

    return (
        <ul className="dashboard-flux-chart-legend" aria-label="Legenda do gráfico">
            {items.map((item) => (
                <li key={item.label} className="dashboard-flux-chart-legend__item">
                    <span
                        className="dashboard-flux-chart-legend__swatch"
                        style={{ background: item.color }}
                        aria-hidden
                    />
                    <span className="dashboard-flux-chart-legend__label">{item.label}</span>
                </li>
            ))}
        </ul>
    );
}