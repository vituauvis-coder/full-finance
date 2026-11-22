import type { FluxChartSeries } from '../../hooks/useFinancialFluxChart';

export type FluxPoint = {
    index: number;
    label: string;
    entrada: number;
    saidaFixa: number;
    saidaFatura: number;
    saidaExtra: number;
    saidaCofrinho: number;
    /** Fixas + faturas (uma coluna no gráfico). */
    saidaFixas: number;
    saida: number;
    balanco: number;
    /** Altura da coluna de balanço (sempre ≥ 0; sinal em `balanco`). */
    balancoMag: number;
    saldo: number | null;
};

export function buildFluxChartData(series: FluxChartSeries): FluxPoint[] {
    return series.labels.map((label, index) => {
        const saidaFixa = series.expenseFixedData[index] ?? 0;
        const saidaFatura = series.expenseInvoiceData[index] ?? 0;
        const saidaExtra = series.expenseExtraData[index] ?? 0;
        const saidaCofrinho = series.expenseCofrinhoData[index] ?? 0;
        const balanco = series.netData[index] ?? 0;
        const saidaFixas = saidaFixa + saidaFatura;
        return {
            index,
            label,
            entrada: series.gainData[index] ?? 0,
            saidaFixa,
            saidaFatura,
            saidaExtra,
            saidaCofrinho,
            saidaFixas,
            saida: series.expenseData[index] ?? saidaFixas + saidaExtra + saidaCofrinho,
            balanco,
            balancoMag: Math.abs(balanco),
            saldo: series.balanceData[index] ?? null
        };
    });
}

export function computeLeftYDomain(data: FluxPoint[], mode: 'bar' | 'line' = 'bar'): [number, number] {
    if (mode === 'bar') {
        const maxY = data.reduce((top, d) => {
            const local = Math.max(d.entrada, d.saidaFixas, d.saidaExtra, d.saidaCofrinho, d.balancoMag);
            return Math.max(top, local);
        }, 0);
        const pad = maxY > 0 ? maxY * 0.08 : 1;
        return [0, maxY + pad];
    }
    const values = data.flatMap((d) => [
        d.entrada,
        d.saidaFixa + d.saidaFatura,
        d.saidaExtra,
        d.saidaCofrinho,
        d.balanco
    ]);
    const minY = Math.min(0, ...values);
    const maxY = values.length ? Math.max(...values) : 0;
    const span = maxY - minY;
    const pad = span > 0 ? span * 0.08 : Math.max(Math.abs(maxY), Math.abs(minY), 1) * 0.08;
    return [minY, maxY + pad];
}

export const FLUX_LEGEND_LABELS: Record<string, string> = {
    entrada: 'Entradas',
    saidaFixa: 'Despesas fixas',
    saidaFatura: 'Faturas',
    saidaExtra: 'Saídas extras',
    saidaCofrinho: 'Cofrinhos',
    balanco: 'Balanço',
    saldo: 'Saldo em conta'
};