import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Chart, ensureChartsRegistered } from '../app/registerCharts';

const TREEMAP_HOST_HEIGHT = 400;

type ChartInstance = InstanceType<typeof Chart>;

type ChartClickHandler = (index: number) => void;

function treemapRawCategory(raw: Record<string, unknown> | undefined): string {
    if (!raw) return '';
    const nested = raw._data as { category?: string } | undefined;
    const fromNested = nested?.category;
    if (fromNested != null && String(fromNested).trim()) return String(fromNested).trim();
    const top = raw.category;
    if (top != null && String(top).trim()) return String(top).trim();
    return '';
}

/** Lifecycle Chart.js (npm + treemap registrado em `registerCharts`). */
export function useChart(
    configFactory: () => object | null,
    deps: unknown[],
    onClickBar?: ChartClickHandler
) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<ChartInstance | null>(null);
    const onClickRef = useRef(onClickBar);
    const [chartError, setChartError] = useState<string | null>(null);
    onClickRef.current = onClickBar;

    useEffect(() => {
        const canvas = canvasRef.current;
        const host = canvas?.parentElement;
        if (!canvas || !host) return;

        ensureChartsRegistered();
        chartRef.current?.destroy();
        setChartError(null);

        const base = configFactory();
        if (!base) return;

        const cfg = {
            ...base,
            options: {
                ...(base as { options?: object }).options,
                onClick: (_ev: unknown, elements: { index: number }[]) => {
                    const el = elements?.[0];
                    if (el != null && typeof el.index === 'number') {
                        onClickRef.current?.(el.index);
                    }
                }
            }
        };
        const wrap = canvas.parentElement;
        if (!wrap) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const ensureWrapHeight = () => {
            if (wrap.clientHeight < 120) {
                wrap.style.minHeight = '400px';
                wrap.style.height = '400px';
            }
        };
        ensureWrapHeight();

        let chart: ChartInstance | null = null;
        let lateResize = 0;
        const resize = () => {
            ensureWrapHeight();
            if (chart) chart.resize();
        };

        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
        ro?.observe(wrap);

        try {
            chart = new Chart(ctx, cfg as never);
            chartRef.current = chart;
            requestAnimationFrame(() => {
                requestAnimationFrame(resize);
            });
            lateResize = window.setTimeout(resize, 120);
        } catch (err) {
            console.error('[useChart] falha ao montar gráfico', err);
            setChartError(err instanceof Error ? err.message : 'Erro ao desenhar o gráfico');
            ro?.disconnect();
            return;
        }

        return () => {
            window.clearTimeout(lateResize);
            ro?.disconnect();
            chart?.destroy();
            chartRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { canvasRef, chartError };
}

/**
 * Treemap — Chart.js mede mal o pai em flex; tamanho explícito (legado: wrap 400px).
 */
export function useTreemapChart(configFactory: () => object | null, deps: unknown[]) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<ChartInstance | null>(null);
    const [chartError, setChartError] = useState<string | null>(null);

    useLayoutEffect(() => {
        const wrap = wrapRef.current;
        const canvas = canvasRef.current;
        if (!wrap || !canvas) return;

        ensureChartsRegistered();
        chartRef.current?.destroy();

        const base = configFactory();
        if (!base) return;

        const cfg = {
            ...base,
            options: {
                ...(base as { options?: object }).options,
                responsive: false,
                maintainAspectRatio: false
            }
        };

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const measure = () => {
            const rect = wrap.getBoundingClientRect();
            const width = Math.max(Math.floor(rect.width), 1);
            const height = TREEMAP_HOST_HEIGHT;
            return { width, height };
        };

        const applyHostSize = () => {
            wrap.style.width = '100%';
            wrap.style.minHeight = `${TREEMAP_HOST_HEIGHT}px`;
            wrap.style.height = `${TREEMAP_HOST_HEIGHT}px`;
        };
        applyHostSize();

        let chart: ChartInstance | null = null;
        let lateResize = 0;

        let resizeRaf = 0;
        const resize = () => {
            applyHostSize();
            const { width, height } = measure();
            if (chart && width > 0) {
                chart.resize(width, height);
            }
        };
        const scheduleResize = () => {
            cancelAnimationFrame(resizeRaf);
            resizeRaf = requestAnimationFrame(resize);
        };

        const ro =
            typeof ResizeObserver !== 'undefined'
                ? new ResizeObserver(() => {
                      scheduleResize();
                  })
                : null;
        ro?.observe(wrap);

        try {
            const { width, height } = measure();
            chart = new Chart(ctx, cfg as never);
            chartRef.current = chart;
            chart.resize(Math.max(width, 1), height);
            scheduleResize();
            lateResize = window.setTimeout(scheduleResize, 150);
            window.addEventListener('resize', scheduleResize);
        } catch (err) {
            console.error('[useTreemapChart] falha ao montar gráfico', err);
            setChartError(err instanceof Error ? err.message : 'Erro ao desenhar o gráfico');
            ro?.disconnect();
            return;
        }

        return () => {
            cancelAnimationFrame(resizeRaf);
            window.clearTimeout(lateResize);
            window.removeEventListener('resize', scheduleResize);
            ro?.disconnect();
            chart?.destroy();
            chartRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { canvasRef, wrapRef, chartError };
}

export { treemapRawCategory };