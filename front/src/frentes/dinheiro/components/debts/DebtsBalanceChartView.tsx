import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    Bar,
    CartesianGrid,
    Cell,
    ComposedChart,
    Line,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { formatBRL } from '../../../../lib/format';
import { barFill, chartAxisColors, colorWithAlpha } from '../../../dashboard/components/flux/fluxChartTheme';
import { debtColorHex } from '../../domain/debtColors';
import type { Debt, DebtUpdate } from '../../domain/debtTypes';
import type { DebtsChartRow, DebtsChartSeries } from './buildDebtsChartSeries';
import { FluxChartTooltip } from '../../../dashboard/components/flux/FluxChartTooltip';

type Props = {
    rows: DebtsChartRow[];
    series: DebtsChartSeries[];
    currency: string;
};

const CHART_HEIGHT = 280;

function DebtsChartGrid({ axis }: { axis: ReturnType<typeof chartAxisColors> }) {
    return (
        <>
            <CartesianGrid stroke={axis.gridVertical} horizontal={false} vertical strokeDasharray="0" />
            <CartesianGrid stroke={axis.grid} horizontal vertical={false} strokeDasharray="0" strokeWidth={1} />
            <ReferenceLine y={0} stroke={axis.gridZero} strokeWidth={2} ifOverflow="extendDomain" />
        </>
    );
}

function useChartCanvasWidth(active: boolean) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [width, setWidth] = useState(0);

    useLayoutEffect(() => {
        if (!active) {
            setWidth(0);
            return;
        }
        const el = ref.current;
        if (!el) return;

        const measure = () => {
            if (ref.current) setWidth(ref.current.clientWidth);
        };

        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [active]);

    return { ref, width };
}

export function DebtsBalanceChartView({ rows, series, currency }: Props) {
    const axis = chartAxisColors();
    const totalColor = debtColorHex('wine');
    const currentMonth = new Date().getMonth();
    const active = rows.length > 0;
    const { ref, width } = useChartCanvasWidth(active);

    const labelMap = useMemo(() => {
        const m: Record<string, string> = { total: 'Total' };
        for (const s of series) m[s.key] = s.label;
        return m;
    }, [series]);

    const yMax = useMemo(() => {
        let max = 0;
        for (const row of rows) {
            if (row.total != null) max = Math.max(max, row.total);
            for (const s of series) {
                const v = row[s.key];
                if (typeof v === 'number') max = Math.max(max, v);
            }
        }
        return max > 0 ? max * 1.08 : 1;
    }, [rows, series]);

    const margin = { top: 8, right: 12, left: 4, bottom: 4 };

    return (
        <div ref={ref} className="debts-balance-chart__canvas">
            {width > 0 ? (
                <ResponsiveContainer width={width} height={CHART_HEIGHT}>
                    <ComposedChart data={rows} margin={margin} barCategoryGap="24%" barGap={4}>
                        <DebtsChartGrid axis={axis} />
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={{ stroke: axis.grid }}
                            tick={{ fill: colorWithAlpha(axis.tick, 0.72), fontSize: 11, fontWeight: 500 }}
                        />
                        <YAxis
                            domain={[0, yMax]}
                            tickCount={6}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: axis.tick, fontSize: 11 }}
                            width={72}
                            tickFormatter={(v) => formatBRL(Number(v), currency)}
                        />
                        <Tooltip
                            content={<FluxChartTooltip currency={currency} labels={labelMap} />}
                            cursor={{ fill: 'var(--dash-chart-tooltip-cursor, rgba(255,255, 255, 0.06))' }}
                            shared
                            itemSorter={(item) => -(Number(item.value) || 0)}
                        />
                        <Bar
                            dataKey="total"
                            name="Total"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={40}
                            fill={colorWithAlpha(totalColor, 0.38)}
                            isAnimationActive
                            animationDuration={400}
                        >
                            {rows.map((_, index) => (
                                <Cell key={index} fill={barFill(totalColor, index, currentMonth)} />
                            ))}
                        </Bar>
                        {series.map((s) => (
                            <Line
                                key={s.key}
                                type="monotone"
                                dataKey={s.key}
                                name={s.label}
                                stroke={s.color}
                                strokeWidth={2}
                                dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                                activeDot={{ r: 5 }}
                                connectNulls={s.closed === true}
                                strokeDasharray={s.closed ? '6 4' : undefined}
                                strokeOpacity={s.closed ? 0.75 : 1}
                                isAnimationActive
                                animationDuration={400}
                            />
                        ))}
                    </ComposedChart>
                </ResponsiveContainer>
            ) : null}
        </div>
    );
}