export const REPORTS_CHART_COLORS_KEY = 'reports.financialChart.colors';

const DEFAULT = {
    ganhos: '#34c759',
    gastos: '#ff3b30',
    saldoPos: '#ff9f0a',
    saldoNeg: '#ff453a',
    saldoTotal: '#0a84ff'
} as const;

const DEFAULT_DARK = {
    ganhos: '#30d158',
    gastos: '#ff453a',
    saldoPos: '#ffd60a',
    saldoNeg: '#ff375f',
    saldoTotal: '#64d2ff'
} as const;

export type FinancialChartColors = typeof DEFAULT;

function dashboardModernDefaults(): FinancialChartColors {
    if (typeof document === 'undefined') return { ...DEFAULT };
    const onDashboard = document.getElementById('dashboard-page')?.classList.contains('dashboard-page--modern');
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (onDashboard) return dark ? { ...DEFAULT_DARK } : { ...DEFAULT };
    return { ...DEFAULT };
}

export function readFinancialChartColors(): FinancialChartColors {
    try {
        const raw = localStorage.getItem(REPORTS_CHART_COLORS_KEY);
        if (!raw) return dashboardModernDefaults();
        const o = JSON.parse(raw) as Record<string, string>;
        if (!o || typeof o !== 'object') return { ...DEFAULT };
        const norm = (hex: unknown, fallback: string) => {
            const s = String(hex ?? '').trim();
            return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : fallback;
        };
        return {
            ganhos: norm(o.ganhos, DEFAULT.ganhos),
            gastos: norm(o.gastos, DEFAULT.gastos),
            saldoPos: norm(o.saldoPos, DEFAULT.saldoPos),
            saldoNeg: norm(o.saldoNeg, DEFAULT.saldoNeg),
            saldoTotal: norm(o.saldoTotal, DEFAULT.saldoTotal)
        };
    } catch {
        return { ...DEFAULT };
    }
}

export function colorWithAlpha(hex: string, alpha: number) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Opacidade das colunas: mês em destaque = 1; demais ≈ legado (0.38). */
export function barFill(hex: string, monthIndex: number, emphasisIndex: number) {
    const emphasis = emphasisIndex >= 0 && monthIndex === emphasisIndex;
    const alpha = emphasis ? 0.92 : 0.92 * 0.38;
    return colorWithAlpha(hex, alpha);
}

/** Eixo direito «Saldo em conta» — alinhado ao zero do eixo de fluxo (como `computeY1BoundsAlignedToYZero`). */
export function computeSaldoAxisDomain(leftDomain: [number, number], saldos: number[]): [number, number] {
    if (!saldos.length) return [0, 1];
    const saldoMax = Math.max(...saldos);
    const saldoMin = Math.min(...saldos);
    const [yMin, yMax] = leftDomain;
    const span = yMax - yMin;
    if (span <= 0) {
        return [Math.min(0, saldoMin), Math.max(saldoMax * 1.06, saldoMin + 1, 1)];
    }
    const t = (0 - yMin) / span;
    let y1Hi = Math.max(saldoMax * 1.03, saldoMax, 1e-6);
    let y1Lo: number;
    if (t <= 1e-10) {
        y1Lo = Math.min(0, saldoMin);
        if (y1Hi <= y1Lo) y1Hi = y1Lo + 1;
        return [y1Lo, y1Hi];
    }
    if (t >= 1 - 1e-10) {
        y1Lo = Math.min(saldoMin, 0) - Math.max(1, Math.abs(saldoMax) * 0.02);
        y1Hi = Math.max(saldoMax, y1Lo + 1);
        return [y1Lo, y1Hi];
    }
    y1Lo = (t * y1Hi) / (t - 1);
    if (!Number.isFinite(y1Lo)) y1Lo = Math.min(0, saldoMin);
    if (y1Hi < saldoMax) y1Hi = saldoMax * 1.06;
    return [y1Lo, y1Hi];
}

export function chartAxisColors() {
    if (typeof document === 'undefined') {
        return {
            tick: '#94a3b8',
            grid: 'rgba(148, 163, 184, 0.2)',
            gridVertical: 'rgba(148, 163, 184, 0.1)',
            gridZero: 'rgba(148, 163, 184, 0.38)'
        };
    }
    const onDashboard = document.getElementById('dashboard-page')?.classList.contains('dashboard-page--modern');
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (onDashboard) {
        return {
            tick: dark ? '#86868b' : '#6e6e73',
            grid: dark ? 'rgba(163, 163, 163, 0.22)' : 'rgba(0, 0, 0, 0.08)',
            gridVertical: dark ? 'rgba(163, 163, 163, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            gridZero: dark ? 'rgba(245, 245, 247, 0.35)' : 'rgba(29, 29, 31, 0.18)'
        };
    }
    return {
        tick: dark ? '#cbd5e1' : '#64748b',
        grid: dark ? 'rgba(163, 163, 163, 0.26)' : 'rgba(71, 85, 105, 0.14)',
        gridVertical: dark ? 'rgba(163, 163, 163, 0.12)' : 'rgba(71, 85, 105, 0.08)',
        gridZero: dark ? 'rgba(212, 212, 212, 0.48)' : 'rgba(71, 85, 105, 0.28)'
    };
}