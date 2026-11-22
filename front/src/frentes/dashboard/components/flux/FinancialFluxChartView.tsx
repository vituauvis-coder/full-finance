import { useMemo } from 'react';
import {
    Bar,
    CartesianGrid,
    Cell,
    ComposedChart,
    Line,
    ReferenceArea,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { formatBRL } from '../../../../lib/format';
import type { FluxChartSeries, FluxChartViz } from '../../hooks/useFinancialFluxChart';
import { FluxChartXTick } from './FluxChartXTick';
import { FluxChartTooltip } from './FluxChartTooltip';
import { barFill, barFillOutflow, chartAxisColors, colorWithAlpha, readDashboardExpenseBuckets } from './fluxChartTheme';
import {
    FluxBalancoNegPattern,
    balancoNegPatternUrl,
    useBalancoNegPatternId
} from './FluxBalancoNegPattern';
import { FluxFixasBarShape } from './FluxFixasBarShape';
import { useFluxChartModel } from './useFluxChartModel';

type Props = {
    series: FluxChartSeries;
    viz: FluxChartViz;
    currency: string;
    activeMonthIndex: number;
    showSaldoTotal: boolean;
    balanceLoading?: boolean;
    yearScope: boolean;
    onSelectMonth?: (monthIndex: number) => void;
};

function FluxChartGrid({ axis }: { axis: ReturnType<typeof chartAxisColors> }) {
    return (
        <>
            <CartesianGrid yAxisId="left" stroke={axis.gridVertical} horizontal={false} vertical strokeDasharray="0" />
            <CartesianGrid
                yAxisId="left"
                stroke={axis.grid}
                horizontal
                vertical={false}
                strokeDasharray="0"
                strokeWidth={1}
            />
            <ReferenceLine yAxisId="left" y={0} stroke={axis.gridZero} strokeWidth={2} ifOverflow="extendDomain" />
        </>
    );
}

export function FinancialFluxChartView({
    series,
    viz,
    currency,
    activeMonthIndex,
    showSaldoTotal,
    balanceLoading = false,
    yearScope,
    onSelectMonth
}: Props) {
    const axis = chartAxisColors();
    const model = useFluxChartModel({
        series,
        activeMonthIndex,
        showSaldoTotal,
        balanceLoading,
        yearScope,
        viz
    });
    const balancoNegPatternId = useBalancoNegPatternId();
    const buckets = useMemo(() => readDashboardExpenseBuckets(), []);

    const xAxis = (
        <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: axis.grid }}
            tick={(p) => (
                <FluxChartXTick
                    x={p.x}
                    y={p.y}
                    payload={p.payload}
                    index={p.index}
                    activeMonthIndex={activeMonthIndex}
                    yearScope={yearScope}
                />
            )}
        />
    );

    const leftAxis = (
        <YAxis
            yAxisId="left"
            domain={model.yDomain}
            tickCount={6}
            tickLine={false}
            axisLine={false}
            tick={{ fill: axis.tick, fontSize: 11 }}
            width={64}
            tickFormatter={(v) => formatBRL(Number(v), currency)}
        />
    );

    const rightAxis =
        model.showSaldoSeries && model.saldoYDomain ? (
            <YAxis
                yAxisId="right"
                orientation="right"
                domain={model.saldoYDomain}
                tickCount={5}
                tickLine={false}
                axisLine={false}
                tick={{ fill: colorWithAlpha(model.colors.saldoTotal, 0.92), fontSize: 10 }}
                width={72}
                tickFormatter={(v) => {
                    const n = Number(v);
                    return Number.isFinite(n) ? formatBRL(n, currency) : '';
                }}
                label={{
                    value: 'Saldo em conta',
                    angle: -90,
                    position: 'insideRight',
                    fill: colorWithAlpha(model.colors.saldoTotal, 0.85),
                    fontSize: 11,
                    fontWeight: 600,
                    offset: 12
                }}
            />
        ) : null;

    const highlight =
        model.highlightLabel != null ? (
            <ReferenceArea
                x1={model.highlightLabel}
                x2={model.highlightLabel}
                fill={colorWithAlpha(model.colors.saldoTotal, viz === 'line' ? 0.14 : 0.12)}
                strokeOpacity={0}
                yAxisId="left"
            />
        ) : null;

    const margin = { top: 8, right: model.showSaldoSeries ? 28 : 4, left: 4, bottom: 0 };
    const fixasBarShape = (shapeProps: { x?: number; y?: number; width?: number; height?: number; payload?: import('./fluxChartData').FluxPoint }) => (
        <FluxFixasBarShape
            {...shapeProps}
            fixaColor={buckets.fixa}
            faturaColor={buckets.fatura}
            emphasis={model.emphasis}
        />
    );

    if (viz === 'line') {
        return (
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <ComposedChart data={model.data} margin={margin} barCategoryGap="22%">
                    <FluxChartGrid axis={axis} />
                    {xAxis}
                    {leftAxis}
                    {rightAxis}
                    <Tooltip
                        content={<FluxChartTooltip currency={currency} />}
                        cursor={{ fill: 'var(--dash-chart-tooltip-cursor, rgba(255,255,255,0.05))' }}
                    />
                    {highlight}
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="entrada"
                        name="entrada"
                        stroke={model.colors.ganhos}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        animationDuration={400}
                    />
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="saidaFixa"
                        name="saidaFixa"
                        stroke={buckets.fixa}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        animationDuration={400}
                    />
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="saidaFatura"
                        name="saidaFatura"
                        stroke={buckets.fatura}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        animationDuration={400}
                    />
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="saidaExtra"
                        name="saidaExtra"
                        stroke={buckets.extra}
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        dot={{ r: 2 }}
                        animationDuration={400}
                    />
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="saidaCofrinho"
                        name="saidaCofrinho"
                        stroke={buckets.cofrinhos}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        animationDuration={400}
                    />
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="balanco"
                        name="balanco"
                        stroke={model.colors.saldoPos}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        animationDuration={400}
                    />
                    {model.showSaldoSeries && !balanceLoading ? (
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="saldo"
                            name="saldo"
                            stroke={model.colors.saldoTotal}
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: model.colors.saldoTotal }}
                            connectNulls={false}
                            animationDuration={400}
                        />
                    ) : null}
                </ComposedChart>
            </ResponsiveContainer>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
            <ComposedChart data={model.data} margin={margin} barCategoryGap="16%" barGap={3}>
                <FluxBalancoNegPattern patternId={balancoNegPatternId} saldoPos={model.colors.saldoPos} />
                <FluxChartGrid axis={axis} />
                {xAxis}
                {leftAxis}
                {rightAxis}
                <Tooltip
                    content={<FluxChartTooltip currency={currency} />}
                    cursor={{ fill: 'var(--dash-chart-tooltip-cursor, rgba(255,255,255,0.06))' }}
                    shared
                />
                {highlight}
                {model.showSaldoSeries && !balanceLoading ? (
                    <Bar
                        yAxisId="right"
                        dataKey="saldo"
                        name="saldo"
                        fill={model.colors.saldoTotal}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={22}
                        animationDuration={450}
                    >
                        {model.data.map((entry) => (
                            <Cell
                                key={`saldo-${entry.label}`}
                                fill={
                                    entry.saldo == null
                                        ? 'transparent'
                                        : barFill(model.colors.saldoTotal, entry.index, model.emphasis)
                                }
                            />
                        ))}
                    </Bar>
                ) : null}
                <Bar
                    yAxisId="left"
                    dataKey="entrada"
                    name="entrada"
                    fill={model.colors.ganhos}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={24}
                    animationDuration={450}
                    onClick={(bar) => model.onBarClick(onSelectMonth, bar)}
                    style={yearScope && onSelectMonth ? { cursor: 'pointer' } : undefined}
                >
                    {model.data.map((entry) => (
                        <Cell key={`in-${entry.label}`} fill={barFill(model.colors.ganhos, entry.index, model.emphasis)} />
                    ))}
                </Bar>
                <Bar
                    yAxisId="left"
                    dataKey="saidaFixas"
                    name="saidaFixas"
                    fill="transparent"
                    radius={0}
                    maxBarSize={24}
                    animationDuration={450}
                    shape={fixasBarShape}
                    onClick={(bar) => model.onBarClick(onSelectMonth, bar)}
                />
                <Bar
                    yAxisId="left"
                    dataKey="balancoMag"
                    name="balanco"
                    fill={model.colors.saldoPos}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={24}
                    minPointSize={3}
                    animationDuration={450}
                    onClick={(bar) => model.onBarClick(onSelectMonth, bar)}
                >
                    {model.data.map((entry) => {
                        const dim = model.emphasis >= 0 && entry.index !== model.emphasis;
                        if (entry.balanco < 0) {
                            return (
                                <Cell
                                    key={`net-${entry.label}`}
                                    fill={balancoNegPatternUrl(balancoNegPatternId)}
                                    opacity={dim ? 0.42 : 1}
                                />
                            );
                        }
                        return (
                            <Cell
                                key={`net-${entry.label}`}
                                fill={barFill(model.colors.saldoPos, entry.index, model.emphasis, 0.98)}
                            />
                        );
                    })}
                </Bar>
                <Bar
                    yAxisId="left"
                    dataKey="saidaCofrinho"
                    name="saidaCofrinho"
                    fill={buckets.cofrinhos}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={24}
                    animationDuration={450}
                    onClick={(bar) => model.onBarClick(onSelectMonth, bar)}
                >
                    {model.data.map((entry) => (
                        <Cell
                            key={`cofrinho-${entry.label}`}
                            fill={barFillOutflow(buckets.cofrinhos, entry.index, model.emphasis, 0.9)}
                        />
                    ))}
                </Bar>
                <Bar
                    yAxisId="left"
                    dataKey="saidaExtra"
                    name="saidaExtra"
                    fill={buckets.extra}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={24}
                    animationDuration={450}
                    onClick={(bar) => model.onBarClick(onSelectMonth, bar)}
                >
                    {model.data.map((entry) => (
                        <Cell
                            key={`extra-${entry.label}`}
                            fill={barFillOutflow(buckets.extra, entry.index, model.emphasis, 0.88)}
                        />
                    ))}
                </Bar>
            </ComposedChart>
        </ResponsiveContainer>
    );
}