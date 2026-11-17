import type { FluxChartSeries } from '../../hooks/useFinancialFluxChart';

export type FluxPoint = {
    index: number;
    label: string;
    entrada: number;
    saida: number;
    balanco: number;
    saldo: number | null;
};

export function buildFluxChartData(series: FluxChartSeries): FluxPoint[] {
    return series.labels.map((label, index) => ({
        index,
        label,
        entrada: series.gainData[index] ?? 0,
        saida: series.expenseData[index] ?? 0,
        balanco: series.netData[index] ?? 0,
        saldo: series.balanceData[index] ?? null
    }));
}

export function computeLeftYDomain(data: FluxPoint[]): [number, number] {
    const values = data.flatMap((d) => [d.entrada, d.saida, d.balanco]);
    const minY = Math.min(0, ...values);
    const maxY = values.length ? Math.max(...values) : 0;
    const span = maxY - minY;
    const pad = span > 0 ? span * 0.08 : Math.max(Math.abs(maxY), Math.abs(minY), 1) * 0.08;
    return [minY, maxY + pad];
}

export const FLUX_LEGEND_LABELS: Record<string, string> = {
    entrada: 'Entradas',
    saida: 'Saídas',
    balanco: 'Balanço',
    saldo: 'Saldo em conta'
};