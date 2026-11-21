import { useMemo } from 'react';
import {
    Bar,
    CartesianGrid,
    Cell,
    ComposedChart,
    Legend,
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
import { buildDebtsChartSeries } from './buildDebtsChartSeries';
import { FluxChartTooltip } from '../../../dashboard/components/flux/FluxChartTooltip';

type Props = {
    debts: Debt[];
    updates: DebtUpdate[];
    currency: string;
};

function DebtsChartGrid({ axis }: { axis: ReturnType<typeof chartAxisColors> }) {
    return (
        <>
            <CartesianGrid stroke={axis.gridVertical} horizontal={false} vertical strokeDasharray="0" />
            <CartesianGrid stroke={axis.grid} horizontal vertical={false} strokeDasharray="0" strokeWidth={1} />
            <ReferenceLine y={0} stroke={axis.gridZero} strokeWidth={2} ifOverflow="extendDomain" />
        </>
    );
}

export function DebtsBalanceChartView({ debts, updates, currency }: Props) {
    const axis = chartAxisColors();
    const totalColor = debtColorHex('wine');
    const currentMonth = new Date().getMonth();

    const { rows, series } = useMemo(() => buildDebtsChartSeries(debts, updates), [debts, updates]);

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

    const margin = { top: 4, right: 8, left: 0, bottom: 0 };

    return (
        <ResponsiveContainer width="100%" height="100%" minHeight={320}>
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
                    cursor={{ fill: 'var(--dash-chart-tooltip-cursor, rgba(255,255,255, 0.06))' }}
                    shared
                    itemSorter={(item) => -(Number(item.value) || 0)}
                />
                <Legend
                    verticalAlign="top"
                    align="center"
                    wrapperStyle={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: axis.tick,
                        paddingBottom: 8,
                        lineHeight: 1.4
                    }}
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
    );
}