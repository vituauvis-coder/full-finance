import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Line,
    ReferenceArea,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { formatBRL, formatBRLChartAxis } from '../../../../lib/format';
import { isAllYearsPeriod, isCivilYearPeriod, monthIndexFromPeriod } from '../../../../lib/period';
import { chartAxisColors, colorWithAlpha } from '../../../dashboard/components/flux/fluxChartTheme';
import type { Movement } from '../../../../lib/types/finance';
import {
    buildCofrinhoAnnualChartSeries,
    type CofrinhoAnnualChartPoint
} from '../../domain/cofrinhoAnnualChartData';
import type { CofrinhoApplication, CofrinhoBucket } from '../../domain/cofrinhoAggregations';
import type { CofrinhoMonthlyBalance } from '../../domain/cofrinhoMonthlyBalances';
import {
    COFRINHO_CHART_BAR_STROKE,
    COFRINHO_CHART_LINE_PURPLE
} from '../../domain/cofrinhoTreemap';

type Props = {
    year: number;
    period: string;
    currency: string;
    buckets: CofrinhoBucket[];
    applications: CofrinhoApplication[];
    expenses: Movement[];
    monthlyBalances: CofrinhoMonthlyBalance[];
};

const COFRINHO_YIELD_GREEN = '#22c55e';

const CHART_HEIGHT = 300;
const CHART_MIN_WIDTH = 320;

function chartGradientId(bucketId: string) {
    return `cofrinho-bar-${String(bucketId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function useChartCanvasWidth(active: boolean) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [width, setWidth] = useState(0);

    useLayoutEffect(() => {
        if (!active) return;
        const el = ref.current;
        if (!el) return;

        const measure = () => {
            const next = Math.floor(el.getBoundingClientRect().width);
            if (next > 0) setWidth(next);
        };

        measure();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
        ro?.observe(el);
        window.addEventListener('resize', measure);
        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [active]);

    return { ref, width: width > 0 ? width : CHART_MIN_WIDTH };
}

function CofrinhosChartTooltip({
    active,
    payload,
    currency
}: {
    active?: boolean;
    payload?: { dataKey?: string; value?: number; name?: string; payload?: CofrinhoAnnualChartPoint }[];
    currency: string;
}) {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload;
    if (!point) return null;

    const segments = payload
        .filter((p) => String(p.dataKey ?? '').startsWith('b_') && (p.value ?? 0) > 0.001)
        .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));

    return (
        <div className="cofrinhos-annual-chart__tooltip">
            <strong>{point.label}</strong>
            <div className="cofrinhos-annual-chart__tooltip-row">
                <span>Aportado no mês</span>
                <span>{formatBRL(point.monthInflow, currency)}</span>
            </div>
            {point.monthYield > 0.001 ? (
                <div className="cofrinhos-annual-chart__tooltip-row is-yield">
                    <span>Rendimento no mês</span>
                    <span>{formatBRL(point.monthYield, currency)}</span>
                </div>
            ) : null}
            <div className="cofrinhos-annual-chart__tooltip-row">
                <span>Acumulado no ano</span>
                <span>{formatBRL(point.cumulative, currency)}</span>
            </div>
            {segments.length > 0 ? (
                <ul className="cofrinhos-annual-chart__tooltip-list">
                    {segments.map((s) => (
                        <li key={String(s.dataKey)}>
                            <span>{s.name}</span>
                            <span title="Acumulado na caixinha">{formatBRL(Number(s.value) || 0, currency)}</span>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}

export function CofrinhosAnnualChart({
    year,
    period,
    currency,
    buckets,
    applications,
    expenses,
    monthlyBalances
}: Props) {
    const axis = chartAxisColors();
    const series = useMemo(
        () => buildCofrinhoAnnualChartSeries(buckets, applications, expenses, year, monthlyBalances),
        [applications, buckets, expenses, monthlyBalances, year]
    );

    const activeMonthIndex = useMemo(() => {
        if (isAllYearsPeriod(period) || isCivilYearPeriod(period)) return -1;
        const mi = monthIndexFromPeriod(period);
        return mi >= 0 ? mi : -1;
    }, [period]);

    const yDomain = useMemo((): [number, number] => {
        const maxY = series.points.reduce(
            (top, p) =>
                Math.max(top, p.cumulative + p.monthYield, p.cumulative, p.monthInflow),
            0
        );
        const pad = maxY > 0 ? maxY * 0.14 : 1;
        return [0, maxY + pad];
    }, [series.points]);

    const legendBuckets = useMemo(
        () =>
            series.buckets.filter((b) =>
                series.points.some((p) => (Number(p[b.stackKey]) || 0) > 0.001)
            ),
        [series.buckets, series.points]
    );

    const highlightLabel =
        activeMonthIndex >= 0 ? series.points[activeMonthIndex]?.label ?? null : null;

    const hasData = series.points.some(
        (p) => p.cumulative > 0.001 || p.monthInflow > 0.001 || p.monthYield > 0.001
    );
    const { ref: canvasRef, width: chartWidth } = useChartCanvasWidth(hasData);

    return (
        <section className="cofrinhos-annual-chart" aria-label={`Alocação anual ${year}`}>
            <header className="cofrinhos-annual-chart__head">
                <h3 className="cofrinhos-annual-chart__title">Alocação anual {year}</h3>
                <p className="cofrinhos-annual-chart__hint">
                    Colunas = saldo acumulado (trecho verde = rendimento do mês) · linha roxa = aporte
                </p>
            </header>
            {!hasData ? (
                <p className="cofrinhos-annual-chart__empty">Sem aportes neste ano para exibir.</p>
            ) : (
                <div className="cofrinhos-annual-chart__plot">
                    <div ref={canvasRef} className="cofrinhos-annual-chart__canvas">
                        <ComposedChart
                            width={chartWidth}
                            height={CHART_HEIGHT}
                            data={series.points}
                            margin={{ top: 12, right: 12, left: 4, bottom: 6 }}
                            barCategoryGap="14%"
                        >
                            <defs>
                                {series.buckets.map((b) => (
                                    <linearGradient
                                        key={b.id}
                                        id={chartGradientId(b.id)}
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop offset="0%" stopColor={b.gradientTop} stopOpacity={0.98} />
                                        <stop offset="100%" stopColor={b.gradientBottom} stopOpacity={1} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid stroke={axis.grid} vertical={false} strokeDasharray="0" />
                            <XAxis dataKey="label" hide xAxisId="months" />
                            <YAxis
                                domain={yDomain}
                                tickCount={5}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: axis.tick, fontSize: 10 }}
                                width={78}
                                tickFormatter={(v) => formatBRLChartAxis(Number(v), currency)}
                            />
                            <Tooltip
                                content={<CofrinhosChartTooltip currency={currency} />}
                                cursor={{ fill: 'var(--dash-chart-tooltip-cursor, rgba(255,255,255,0.06))' }}
                            />
                            {highlightLabel ? (
                                <ReferenceArea
                                    x1={highlightLabel}
                                    x2={highlightLabel}
                                    fill={colorWithAlpha('#8b5cf6', 0.14)}
                                    strokeOpacity={0}
                                />
                            ) : null}
                            {series.buckets.map((b) => (
                                <Bar
                                    key={b.id}
                                    dataKey={b.stackKey}
                                    name={b.name}
                                    stackId="cumulative"
                                    fill={`url(#${chartGradientId(b.id)})`}
                                    stroke={COFRINHO_CHART_BAR_STROKE}
                                    strokeWidth={1.5}
                                    radius={[0, 0, 0, 0]}
                                    maxBarSize={36}
                                    isAnimationActive={false}
                                />
                            ))}
                            <Bar
                                dataKey="monthYield"
                                name="Rendimento no mês"
                                stackId="cumulative"
                                fill={COFRINHO_YIELD_GREEN}
                                fillOpacity={0.92}
                                stroke={colorWithAlpha(COFRINHO_YIELD_GREEN, 0.35)}
                                strokeWidth={1}
                                radius={[5, 5, 0, 0]}
                                maxBarSize={36}
                                isAnimationActive={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="monthInflow"
                                name="Aportado no mês"
                                stroke={COFRINHO_CHART_LINE_PURPLE}
                                strokeWidth={3}
                                dot={{
                                    r: 3.5,
                                    fill: COFRINHO_CHART_LINE_PURPLE,
                                    stroke: 'var(--dash-surface-bg)',
                                    strokeWidth: 1.5
                                }}
                                activeDot={{ r: 4.5 }}
                                animationDuration={350}
                            />
                        </ComposedChart>
                    </div>
                    <div className="cofrinhos-annual-chart__months" role="list" aria-label="Meses do ano">
                        {series.points.map((p) => {
                            const active = p.index === activeMonthIndex;
                            return (
                                <span
                                    key={p.yearMonth}
                                    role="listitem"
                                    className={`cofrinhos-annual-chart__month${active ? ' is-active' : ''}`}
                                >
                                    {p.label}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}
            {hasData ? (
                <footer className="cofrinhos-annual-chart__foot">
                    <ul className="cofrinhos-annual-chart__legend" aria-label="Legenda do gráfico">
                        {legendBuckets.map((b) => (
                            <li key={b.id} title={b.name}>
                                <span
                                    className="cofrinhos-annual-chart__swatch"
                                    style={{
                                        background: `linear-gradient(180deg, ${b.gradientTop}, ${b.gradientBottom})`,
                                        boxShadow: `0 0 0 1px color-mix(in srgb, ${b.color} 35%, transparent)`
                                    }}
                                />
                                <span className="cofrinhos-annual-chart__legend-label">{b.name}</span>
                            </li>
                        ))}
                        <li title="Rendimento do mês no topo da coluna">
                            <span
                                className="cofrinhos-annual-chart__swatch"
                                style={{ background: COFRINHO_YIELD_GREEN }}
                            />
                            <span className="cofrinhos-annual-chart__legend-label">Rendimento (topo)</span>
                        </li>
                        <li className="cofrinhos-annual-chart__legend-line" title="Total aportado no mês">
                            <span className="cofrinhos-annual-chart__swatch cofrinhos-annual-chart__swatch--line" />
                            <span className="cofrinhos-annual-chart__legend-label">Aporte no mês</span>
                        </li>
                    </ul>
                </footer>
            ) : null}
        </section>
    );
}