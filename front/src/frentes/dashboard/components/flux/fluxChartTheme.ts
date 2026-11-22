export const REPORTS_CHART_COLORS_KEY = 'reports.financialChart.colors';

/** Cores dos chips da carteira (fixas / fatura / extras / cofrinhos) — espelhadas nos gráficos. */
/** Paridade com `--v-coral` (Viagens). */
const ORANGE_LIGHT = '#ff5a36';
const ORANGE_DARK = '#ff5a36';
const EXTRA_YELLOW_LIGHT = '#f2c94c';
const EXTRA_YELLOW_DARK = '#ffd60a';
const BALANCE_OFFWHITE_LIGHT = '#eceae4';
const BALANCE_OFFWHITE_DARK = '#dddcd8';

export const DASH_EXPENSE_BUCKETS = {
    /** Despesas fixas — laranja cheio (faturas = mesmo tom, menor opacidade no gráfico). */
    fixa: ORANGE_LIGHT,
    fatura: ORANGE_LIGHT,
    extra: EXTRA_YELLOW_LIGHT,
    cofrinhos: '#a855f7'
} as const;

export type DashboardExpenseBucketColors = typeof DASH_EXPENSE_BUCKETS;

function readCssHexVar(name: string, fallback: string): string {
    if (typeof document === 'undefined') return fallback;
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : fallback;
}

export function readDashboardExpenseBuckets(): DashboardExpenseBucketColors {
    if (typeof document === 'undefined') return { ...DASH_EXPENSE_BUCKETS };
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const fallbackExpense = dark ? ORANGE_DARK : ORANGE_LIGHT;
    const expense = readCssHexVar('--expenses-accent', fallbackExpense);
    const extra = dark ? EXTRA_YELLOW_DARK : EXTRA_YELLOW_LIGHT;
    return { fixa: expense, fatura: expense, extra, cofrinhos: DASH_EXPENSE_BUCKETS.cofrinhos };
}

const DEFAULT = {
    ganhos: '#2ec4b6',
    gastos: '#ff5a36',
    saldoPos: BALANCE_OFFWHITE_LIGHT,
    saldoNeg: '#ff5a36',
    saldoTotal: '#0a84ff'
} as const;

const DEFAULT_DARK = {
    ganhos: '#2ec4b6',
    gastos: '#ff5a36',
    saldoPos: BALANCE_OFFWHITE_DARK,
    saldoNeg: '#ff5a36',
    saldoTotal: '#64d2ff'
} as const;

export type FinancialChartColors = typeof DEFAULT;

function profileFlowColors(dark: boolean): Pick<FinancialChartColors, 'ganhos' | 'gastos' | 'saldoNeg'> {
    const base = dark ? DEFAULT_DARK : DEFAULT;
    const ganhos = readCssHexVar('--gains-accent', base.ganhos);
    const gastos = readCssHexVar('--expenses-accent', base.gastos);
    return { ganhos, gastos, saldoNeg: gastos };
}

function dashboardModernDefaults(): FinancialChartColors {
    if (typeof document === 'undefined') return { ...DEFAULT };
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const base = dark ? { ...DEFAULT_DARK } : { ...DEFAULT };
    const flow = profileFlowColors(dark);
    return { ...base, ...flow };
}

export function readFinancialChartColors(): FinancialChartColors {
    const dark =
        typeof document !== 'undefined' &&
        document.documentElement.getAttribute('data-theme') === 'dark';
    const onDashboard =
        typeof document !== 'undefined' &&
        document.getElementById('dashboard-page')?.classList.contains('dashboard-page--modern');
    const profileFlow = profileFlowColors(dark);

    try {
        const raw = localStorage.getItem(REPORTS_CHART_COLORS_KEY);
        if (!raw) return dashboardModernDefaults();
        const o = JSON.parse(raw) as Record<string, string>;
        if (!o || typeof o !== 'object') return dashboardModernDefaults();
        const norm = (hex: unknown, fallback: string) => {
            const s = String(hex ?? '').trim();
            return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : fallback;
        };
        const base = {
            ganhos: norm(o.ganhos, DEFAULT.ganhos),
            gastos: norm(o.gastos, DEFAULT.gastos),
            saldoPos: norm(o.saldoPos, dark ? DEFAULT_DARK.saldoPos : DEFAULT.saldoPos),
            saldoNeg: norm(o.saldoNeg, DEFAULT.saldoNeg),
            saldoTotal: norm(o.saldoTotal, dark ? DEFAULT_DARK.saldoTotal : DEFAULT.saldoTotal)
        };
        if (onDashboard) {
            return {
                ...base,
                ganhos: profileFlow.ganhos,
                gastos: profileFlow.gastos,
                saldoNeg: profileFlow.saldoNeg
            };
        }
        return base;
    } catch {
        return dashboardModernDefaults();
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
export function barFill(hex: string, monthIndex: number, emphasisIndex: number, strength = 0.92) {
    const emphasis = emphasisIndex >= 0 && monthIndex === emphasisIndex;
    const alpha = emphasis ? strength : strength * 0.38;
    return colorWithAlpha(hex, alpha);
}

/** Saídas — mantêm coral visível mesmo fora do mês em destaque. */
export function barFillOutflow(hex: string, monthIndex: number, emphasisIndex: number, strength = 0.9) {
    const emphasis = emphasisIndex >= 0 && monthIndex === emphasisIndex;
    const alpha = emphasis ? strength : Math.max(0.48, strength * 0.58);
    return colorWithAlpha(hex, alpha);
}

/** Tom mais fechado para faturas (sempre hex — não passar rgba ao `barFill`). */
export function expenseFaturaHex(base: string): string {
    const h = base.replace('#', '');
    if (h.length !== 6) return base;
    const mix = (channel: number) => Math.max(0, Math.round(channel * 0.72));
    const r = mix(parseInt(h.slice(0, 2), 16));
    const g = mix(parseInt(h.slice(2, 4), 16));
    const b = mix(parseInt(h.slice(4, 6), 16));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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