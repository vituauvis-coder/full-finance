import { useMemo } from 'react';
import type { FluxChartSeries } from '../../hooks/useFinancialFluxChart';
import { buildFluxChartData, computeLeftYDomain, type FluxPoint } from './fluxChartData';
import { computeSaldoAxisDomain, readFinancialChartColors } from './fluxChartTheme';

export function useFluxChartModel(params: {
    series: FluxChartSeries;
    activeMonthIndex: number;
    showSaldoTotal: boolean;
    balanceLoading: boolean;
    yearScope: boolean;
}) {
    const colors = useMemo(() => readFinancialChartColors(), []);
    const data = useMemo(() => buildFluxChartData(params.series), [params.series]);
    const emphasis = params.yearScope ? params.activeMonthIndex : -1;
    const highlightLabel = emphasis >= 0 ? data[emphasis]?.label : null;
    const yDomain = useMemo(() => computeLeftYDomain(data), [data]);

    const saldoValues = useMemo(
        () => data.map((d) => d.saldo).filter((v): v is number => v != null && Number.isFinite(v)),
        [data]
    );

    const showSaldoSeries = params.showSaldoTotal && (params.balanceLoading || saldoValues.length > 0);

    const saldoYDomain = useMemo((): [number, number] | null => {
        if (!params.showSaldoTotal) return null;
        if (params.balanceLoading && saldoValues.length === 0) return [0, 1];
        if (!saldoValues.length) return null;
        return computeSaldoAxisDomain(yDomain, saldoValues);
    }, [params.showSaldoTotal, params.balanceLoading, saldoValues, yDomain]);

    const onBarClick = (onSelectMonth: ((i: number) => void) | undefined, bar: { payload?: FluxPoint }) => {
        if (!params.yearScope || !onSelectMonth || bar?.payload == null) return;
        onSelectMonth(bar.payload.index);
    };

    return {
        colors,
        data,
        emphasis,
        highlightLabel,
        yDomain,
        saldoValues,
        showSaldoSeries,
        saldoYDomain,
        onBarClick
    };
}