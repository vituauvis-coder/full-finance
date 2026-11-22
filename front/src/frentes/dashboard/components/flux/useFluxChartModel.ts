import { useMemo } from 'react';
import type { FluxChartSeries, FluxChartViz } from '../../hooks/useFinancialFluxChart';
import { buildFluxChartData, computeLeftYDomain, type FluxPoint } from './fluxChartData';
import { computeSaldoAxisDomain } from './fluxChartTheme';
import { useFluxAccentColors } from './useFluxAccentColors';

export function useFluxChartModel(params: {
    series: FluxChartSeries;
    activeMonthIndex: number;
    showSaldoTotal: boolean;
    balanceLoading: boolean;
    yearScope: boolean;
    viz: FluxChartViz;
}) {
    const { colors } = useFluxAccentColors();
    const data = useMemo(() => buildFluxChartData(params.series), [params.series]);
    const emphasis = params.yearScope ? params.activeMonthIndex : -1;
    const highlightLabel = emphasis >= 0 ? data[emphasis]?.label : null;
    const yDomain = useMemo(() => computeLeftYDomain(data, params.viz), [data, params.viz]);

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