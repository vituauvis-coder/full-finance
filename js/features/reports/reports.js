// js/reports.js
import { expenseContributionProjectedToMonthKey } from '../../core/expense-calendar-month.js';
import { expenseContributionPaidThroughListMonthKey } from '../../core/expense-list-month-contribution.js';
import {
    expenseCountsAsCashOut,
    formatCurrency,
    getChartAxisColors,
    isCreditCardType,
    isDarkTheme,
    movementDateToJsDate
} from '../../core/utils.js';
import {
    getInstallmentDueDates,
    getLoanInstallmentDueDates,
    isExpenseInstallmentDueCountedInCashFlow,
    isInstallmentDuePaidForCashOut,
    isLoanExpense,
    shouldDeferCashOutForMonthlyFixedSeries
} from '../../core/credit-installments.js';
import { getTotalApplicationsSum } from '../cofrinhos/cofrinhos-page.js';
import {
    getDefaultPeriodValue,
    getPeriodDateBounds
} from '../../core/period-filters.js';
import {
    enumerateCalendarMonths,
    isProjectionMonth,
    sumOutflowsProjectedForCalendarMonth,
    sumProjectedGainsForCalendarMonth
} from '../../core/projected-period-net.js';
import {
    DASHBOARD_EXPENSE_FACET_IDS,
    DASHBOARD_STATUS_FACET_IDS,
    dashOutflowCardSummationMode,
    expenseIsMarkedFixed,
    filterExpensesForDashboardFacets,
    filterGainsForDashboardFacets
} from '../../core/dashboard-expense-facets.js';
import { buildSyntheticExpectedSplitGainsRows } from '../../core/expected-split-gain-rows.js';
import { fetchDashboardPeriodBalance } from '../../services/firestore.js';
import { DASHBOARD_SUMMARY_COPY, summaryFilterRequiredHintHtml } from '../../core/movement-summary-copy.js';
import { setSummaryCardTitle } from '../../components/movement-summary-cards.js';
import {
    applySplitNetToContribution,
    isAcceptedSettledSplitRequest,
} from '../../core/split-net.js';
import { setMovementSummaryMomVariation } from '../../core/movement-summary-variation.js';
import { setButtonLoading } from '../../core/button-loading.js';

/**
 * Aplica estado "carregando" nos filtros e (opcional) num botão antes de
 * recarregar os relatórios. Garante restauração via try/finally.
 */
async function reloadReportsWithBusy(triggerBtn = null) {
    if (!lastReportsLoadArgs) return;
    const periodSel = document.getElementById('period-filter');
    const categorySel = document.getElementById('category-filter');
    const wasCategoryDisabled = categorySel ? categorySel.disabled : false;
    [periodSel, categorySel].forEach((el) => {
        if (!el) return;
        el.disabled = true;
        el.setAttribute('aria-busy', 'true');
    });
    if (triggerBtn) setButtonLoading(triggerBtn, true);
    try {
        await loadReportsData(...lastReportsLoadArgs);
    } finally {
        if (periodSel) {
            periodSel.disabled = false;
            periodSel.removeAttribute('aria-busy');
        }
        if (categorySel) {
            // refreshCategoryFilterOptions pode redefinir o disabled; preservamos.
            categorySel.disabled = wasCategoryDisabled;
            categorySel.removeAttribute('aria-busy');
        }
        if (triggerBtn && triggerBtn.isConnected) setButtonLoading(triggerBtn, false);
    }
}

let financialProgressionChart = null;
let lastReportsLoadArgs = null;
let reportsListenersBound = false;
const ALL_CATEGORIES_FILTER_VALUE = '__all__';
/** Eixo do fluxo mensal no painel: sempre os 12 meses do ano civil atual; o filtro de período altera só os cards. */
const DASHBOARD_CHART_AXIS_PERIOD = 'current-year';
/** Após o utilizador mudar o período do painel, os cartões passam a seguir o filtro até recarregar a página. */
let dashboardPeriodLinked = false;

function isDashboardPeriodLinked() {
    return dashboardPeriodLinked;
}

function markDashboardPeriodLinked() {
    dashboardPeriodLinked = true;
}

/**
 * Valores formatados junto aos pontos (fluxo mensal), só em modo linha e com poucos meses para não poluir.
 */
function createFinancialPointValueLabelsPlugin(userCurrency, monthCount) {
    const maxMonths = 9;
    return {
        id: 'reportsFinancialPointValues',
        afterDatasetsDraw(chart) {
            if (chart.config.type !== 'line') return;
            if (monthCount > maxMonths) return;
            const { ctx, data } = chart;
            const { tick: tickColor } = getChartAxisColors();

            ctx.save();
            ctx.font = '500 10px system-ui, -apple-system, Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            for (let di = 0; di < data.datasets.length; di++) {
                const ds = data.datasets[di];
                if (ds.yAxisID === 'y1') continue;
                const meta = chart.getDatasetMeta(di);
                if (meta.hidden) continue;
                const color =
                    typeof ds.borderColor === 'string'
                        ? ds.borderColor
                        : Array.isArray(ds.borderColor)
                          ? ds.borderColor[0]
                          : tickColor;
                ctx.fillStyle = color;

                const pts = meta.data || [];
                for (let i = 0; i < pts.length; i++) {
                    const el = pts[i];
                    const raw = ds.data[i];
                    if (raw == null || Number.isNaN(Number(raw))) continue;
                    const cx = el?.x;
                    const cy = el?.y;
                    if (cx == null || cy == null) continue;
                    ctx.fillText(formatCurrency(Number(raw), userCurrency), cx, cy - 6);
                }
            }
            ctx.restore();
        }
    };
}

const REPORTS_CHART_PREF_KEY_FIN = 'reports.chartType.financialProgression';
const REPORTS_CHART_COLORS_KEY = 'reports.financialChart.colors';
const REPORTS_CHART_SHOW_SALDO_TOTAL_KEY = 'reports.financialChart.showSaldoTotal';
/** Chips de estado por fluxo (`expenses` / `gains`) — objeto JSON em storage; migrações tratam array antigo. */
const REPORTS_DASHBOARD_FLOW_FACETS_KEY = 'reports.dashboard.flowFacetKeys';
/** Legado: um só conjunto aplicado a entradas e saídas. */
const REPORTS_DASHBOARD_EXPENSE_FACETS_KEY_LEGACY = 'reports.dashboard.expenseFacetKeys';

const DASHBOARD_FACETS_ALLOWED = new Set(DASHBOARD_EXPENSE_FACET_IDS);
const DASHBOARD_STATUS_FACETS_ALLOWED = new Set(DASHBOARD_STATUS_FACET_IDS);

let dashboardExpenseFacetsHydratedFromStorage = false;

/** Cor fixa da série «Patrimônio investido» (não personalizável no painel). */
const FINANCIAL_CHART_INVEST_COLOR = '#14b8a6';

const FINANCIAL_CHART_COLOR_KEYS_DEFAULT = {
    ganhos: '#22c55e',
    gastos: '#ef4444',
    saldoPos: '#fbbf24',
    saldoNeg: '#f43f5e',
    saldoTotal: '#6366f1'
};

function getShowFinancialChartSaldoTotal() {
    try {
        const v = localStorage.getItem(REPORTS_CHART_SHOW_SALDO_TOTAL_KEY);
        if (v === null) return false;
        return v === '1' || v === 'true';
    } catch {
        return false;
    }
}

function setShowFinancialChartSaldoTotal(show) {
    try {
        localStorage.setItem(REPORTS_CHART_SHOW_SALDO_TOTAL_KEY, show ? '1' : '0');
    } catch {
        // ignore
    }
}

function normalizeFinChartHex(hex) {
    const s = String(hex || '').trim();
    return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : null;
}

function getFinancialChartColors() {
    const base = { ...FINANCIAL_CHART_COLOR_KEYS_DEFAULT };
    try {
        const raw = localStorage.getItem(REPORTS_CHART_COLORS_KEY);
        if (!raw) return base;
        const o = JSON.parse(raw);
        if (!o || typeof o !== 'object') return base;
        for (const k of Object.keys(FINANCIAL_CHART_COLOR_KEYS_DEFAULT)) {
            const n = normalizeFinChartHex(o[k]);
            if (n) base[k] = n;
        }
        return base;
    } catch {
        return base;
    }
}

function saveFinancialChartColors(obj) {
    try {
        localStorage.setItem(REPORTS_CHART_COLORS_KEY, JSON.stringify(obj));
    } catch {
        // ignore
    }
}

function financialChartColorToInputValue(hex) {
    const n = normalizeFinChartHex(hex);
    return n || '#000000';
}

function ensureFinancialChartColorSettingsBound() {
    if (ensureFinancialChartColorSettingsBound._bound) return;
    ensureFinancialChartColorSettingsBound._bound = true;
    const btn = document.getElementById('financial-chart-colors-btn');
    const panel = document.getElementById('financial-chart-colors-panel');
    if (!btn || !panel) return;

    const syncInputsFromStorage = () => {
        const c = getFinancialChartColors();
        panel.querySelectorAll('input[type="color"][data-fin-color]').forEach((inp) => {
            const k = inp.dataset.finColor;
            if (k && c[k]) inp.value = financialChartColorToInputValue(c[k]);
        });
        const saldoCb = document.getElementById('fin-show-saldo-total-contas');
        if (saldoCb) saldoCb.checked = getShowFinancialChartSaldoTotal();
    };

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nowHidden = panel.classList.toggle('hidden');
        btn.setAttribute('aria-expanded', String(!nowHidden));
        if (!nowHidden) syncInputsFromStorage();
    });

    panel.addEventListener('click', (e) => e.stopPropagation());

    document.getElementById('fin-show-saldo-total-contas')?.addEventListener('change', (ev) => {
        const el = ev.target;
        if (!(el instanceof HTMLInputElement)) return;
        setShowFinancialChartSaldoTotal(el.checked);
        void reloadReportsWithBusy();
    });

    panel.querySelectorAll('input[type="color"][data-fin-color]').forEach((inp) => {
        inp.addEventListener('input', () => {
            const key = inp.dataset.finColor;
            const val = normalizeFinChartHex(inp.value);
            if (!key || !val) return;
            const next = { ...getFinancialChartColors(), [key]: val };
            saveFinancialChartColors(next);
            void reloadReportsWithBusy();
        });
    });

    document.getElementById('financial-chart-colors-reset')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            localStorage.removeItem(REPORTS_CHART_COLORS_KEY);
            localStorage.removeItem(REPORTS_CHART_SHOW_SALDO_TOTAL_KEY);
        } catch {
            // ignore
        }
        syncInputsFromStorage();
        void reloadReportsWithBusy(e.currentTarget instanceof HTMLButtonElement ? e.currentTarget : null);
    });

    document.addEventListener('click', () => {
        if (!panel.classList.contains('hidden')) {
            panel.classList.add('hidden');
            btn.setAttribute('aria-expanded', 'false');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (panel.classList.contains('hidden')) return;
        panel.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
    });

    syncInputsFromStorage();
}

function safeLocalStorageGet(key, fallback = '') {
    try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : String(v);
    } catch {
        return fallback;
    }
}

function safeLocalStorageSet(key, value) {
    try {
        localStorage.setItem(key, String(value));
    } catch {
        // ignore (private mode / blocked storage)
    }
}

function getChartTypePreference(chartKey) {
    if (chartKey === 'financialProgression') {
        const v = safeLocalStorageGet(REPORTS_CHART_PREF_KEY_FIN, 'bar');
        return v === 'line' || v === 'bar' ? v : 'bar';
    }
    return 'bar';
}

function setChartTypePreference(chartKey, type) {
    if (chartKey === 'financialProgression') {
        safeLocalStorageSet(REPORTS_CHART_PREF_KEY_FIN, type);
    }
}

function syncChartTypeToggleUI(chartKey) {
    if (chartKey !== 'financialProgression') return;
    const activeType = getChartTypePreference('financialProgression');
    document.querySelectorAll('.chart-type-btn[data-chart="financialProgression"]').forEach((btn) => {
        const t = btn?.dataset?.type;
        btn.classList.toggle('is-active', t === activeType);
    });
}

function ensureChartTypeTogglesBound() {
    if (ensureChartTypeTogglesBound._bound) return;
    ensureChartTypeTogglesBound._bound = true;

    document.addEventListener('click', (ev) => {
        const btn = ev.target?.closest?.('.chart-type-btn');
        if (!btn) return;
        const chartKey = btn.dataset.chart;
        const type = btn.dataset.type;
        if (!chartKey || !type) return;
        setChartTypePreference(chartKey, type);
        syncChartTypeToggleUI(chartKey);
        void reloadReportsWithBusy(btn instanceof HTMLButtonElement ? btn : null);
    });

    syncChartTypeToggleUI('financialProgression');
}

/** @returns {{ expenses: Set<string>, gains: Set<string> }} Saídas: estado + tipos válidos; entradas: só `paid`/`unpaid`. */
function parseDashboardFlowFacetsFromStorage() {
    const empty = () => ({ expenses: new Set(), gains: new Set() });
    const statusOnly = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr.filter((k) => typeof k === 'string' && DASHBOARD_STATUS_FACETS_ALLOWED.has(k));
    };
    const expenseFlowKeys = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr.filter((k) => typeof k === 'string' && DASHBOARD_FACETS_ALLOWED.has(k));
    };
    try {
        const rawNew = localStorage.getItem(REPORTS_DASHBOARD_FLOW_FACETS_KEY);
        if (rawNew) {
            const parsed = JSON.parse(rawNew);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return {
                    expenses: new Set(expenseFlowKeys(parsed.expenses)),
                    gains: new Set(statusOnly(parsed.gains))
                };
            }
        }
        const rawLegacy = localStorage.getItem(REPORTS_DASHBOARD_EXPENSE_FACETS_KEY_LEGACY);
        if (rawLegacy) {
            const parsed = JSON.parse(rawLegacy);
            if (Array.isArray(parsed)) {
                const keys = statusOnly(parsed);
                const s = new Set(keys);
                try {
                    localStorage.setItem(
                        REPORTS_DASHBOARD_FLOW_FACETS_KEY,
                        JSON.stringify({ expenses: [...s], gains: [...s] })
                    );
                    localStorage.removeItem(REPORTS_DASHBOARD_EXPENSE_FACETS_KEY_LEGACY);
                } catch {
                    /* ignore */
                }
                return { expenses: new Set(s), gains: new Set(s) };
            }
        }
    } catch {
        /* ignore */
    }
    return empty();
}

function readDashboardOutflowFacetSetFromDom() {
    const root = document.getElementById('dashboard-page');
    if (!root) return new Set();
    const facets = new Set();
    root
        .querySelectorAll(
            '.dashboard-expense-facet-btn[data-dashboard-flow="expenses"][data-facet][aria-pressed="true"]'
        )
        .forEach((btn) => {
            const f = String(btn.dataset.facet || '').trim();
            if (f && DASHBOARD_FACETS_ALLOWED.has(f)) facets.add(f);
        });
    return facets;
}

function readDashboardInflowFacetSetFromDom() {
    const root = document.getElementById('dashboard-page');
    if (!root) return new Set();
    const facets = new Set();
    root
        .querySelectorAll(
            '.dashboard-expense-facet-btn[data-dashboard-flow="gains"][data-facet][aria-pressed="true"]'
        )
        .forEach((btn) => {
            const f = String(btn.dataset.facet || '').trim();
            if (f && DASHBOARD_FACETS_ALLOWED.has(f)) facets.add(f);
        });
    return facets;
}

function persistDashboardExpenseFacetsFromDom() {
    const root = document.getElementById('dashboard-page');
    const expenses = [];
    const gains = [];
    if (root) {
        root
            .querySelectorAll(
                '.dashboard-expense-facet-btn[data-dashboard-flow="expenses"][data-facet][aria-pressed="true"]'
            )
            .forEach((btn) => {
                const f = String(btn.dataset.facet || '').trim();
                if (f && DASHBOARD_FACETS_ALLOWED.has(f)) expenses.push(f);
            });
        root
            .querySelectorAll(
                '.dashboard-expense-facet-btn[data-dashboard-flow="gains"][data-facet][aria-pressed="true"]'
            )
            .forEach((btn) => {
                const f = String(btn.dataset.facet || '').trim();
                if (f && DASHBOARD_STATUS_FACETS_ALLOWED.has(f)) gains.push(f);
            });
    }
    expenses.sort();
    gains.sort();
    try {
        localStorage.setItem(REPORTS_DASHBOARD_FLOW_FACETS_KEY, JSON.stringify({ expenses, gains }));
    } catch {
        /* ignore */
    }
}

/**
 * Um por carregamento de página: aplica estado guardado aos botões antes da primeira soma dos cards.
 */
function hydrateDashboardExpenseFacetsFromStorageOnce() {
    if (dashboardExpenseFacetsHydratedFromStorage) return;
    dashboardExpenseFacetsHydratedFromStorage = true;

    const { expenses: expenseActive, gains: gainActive } = parseDashboardFlowFacetsFromStorage();

    const root = document.getElementById('dashboard-page');
    if (!root) return;

    root.querySelectorAll('.dashboard-expense-facet-btn[data-facet][data-dashboard-flow]').forEach((btn) => {
        const f = String(btn.dataset.facet || '').trim();
        const flow = String(btn.dataset.dashboardFlow || '').trim();
        if (!f || !DASHBOARD_FACETS_ALLOWED.has(f)) return;
        const activeSet = flow === 'gains' ? gainActive : expenseActive;
        const on = activeSet.has(f);
        btn.setAttribute('aria-pressed', String(on));
        btn.classList.toggle('is-active', on);
    });
}

function onDashboardExpenseFacetBarClick(ev) {
    const btn = ev.target?.closest?.('.dashboard-expense-facet-btn');
    if (!btn || !document.getElementById('dashboard-page')?.contains(btn)) return;
    ev.preventDefault();
    const pressed = btn.getAttribute('aria-pressed') === 'true';
    const next = !pressed;
    btn.setAttribute('aria-pressed', String(next));
    btn.classList.toggle('is-active', next);
    persistDashboardExpenseFacetsFromDom();
    void reloadReportsWithBusy(btn instanceof HTMLButtonElement ? btn : null);
}

function ensureReportsListeners() {
    hydrateDashboardExpenseFacetsFromStorageOnce();
    if (reportsListenersBound) return;
    reportsListenersBound = true;
    ensureFinancialChartColorSettingsBound();
    ensureChartTypeTogglesBound();
    document.getElementById('dashboard-page')?.addEventListener('click', onDashboardExpenseFacetBarClick);
    document.getElementById('period-filter')?.addEventListener('change', () => {
        markDashboardPeriodLinked();
        void reloadReportsWithBusy();
    });
    document.getElementById('category-filter')?.addEventListener('change', () => {
        void reloadReportsWithBusy();
    });
}

function normalizeCategoryName(category) {
    const raw = String(category ?? '').trim();
    return raw || 'Sem categoria';
}

function filterExpensesByCategory(expenses, selectedCategory) {
    if (!selectedCategory || selectedCategory === ALL_CATEGORIES_FILTER_VALUE) return expenses || [];
    return (expenses || []).filter((t) => normalizeCategoryName(t.category) === selectedCategory);
}

function refreshCategoryFilterOptions(expenseContributions) {
    const select = document.getElementById('category-filter');
    if (!select) return ALL_CATEGORIES_FILTER_VALUE;

    const previousValue = select.value || ALL_CATEGORIES_FILTER_VALUE;
    const categories = [...new Set((expenseContributions || []).map((x) => normalizeCategoryName(x.category)))].sort(
        (a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
    );

    const options = [
        { value: ALL_CATEGORIES_FILTER_VALUE, label: 'Todas as categorias' },
        ...categories.map((cat) => ({ value: cat, label: cat }))
    ];

    select.replaceChildren();
    for (const opt of options) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
    }

    const nextValue = options.some((opt) => opt.value === previousValue)
        ? previousValue
        : ALL_CATEGORIES_FILTER_VALUE;
    select.value = nextValue;
    select.disabled = options.length <= 1;
    return nextValue;
}

/**
 * Saldo em contas no fim do mês civil `mo` — mesma regra do card «Saldo em conta» (ledger via API + projeção para meses futuros).
 */
async function dashboardBalanceAtEndOfChartMonth(
    mo,
    now,
    userGains,
    expenseListForBalanceProj,
    userAccounts,
    userProfile,
    splitRequests
) {
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (mo.end <= endOfToday) {
        return fetchDashboardPeriodBalance(mo.start, mo.end);
    }
    const baseBal = await fetchDashboardPeriodBalance(
        new Date(now.getFullYear(), now.getMonth(), 1),
        endOfToday
    );
    if (baseBal == null) return null;
    let projected = baseBal;
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    if (mo.end >= nextMonthStart) {
        for (const m2 of enumerateCalendarMonths(nextMonthStart, mo.end)) {
            const inc = sumProjectedGainsForCalendarMonth(m2, userGains);
            const outMo = sumOutflowsProjectedForCalendarMonth(
                m2,
                expenseListForBalanceProj,
                userAccounts,
                now,
                userProfile,
                splitRequests
            );
            projected += inc - outMo;
        }
    }
    return projected;
}

/**
 * Limites do eixo y1 (saldo em conta) para o zero coincidir em pixels com o eixo y principal —
 * evita barras «penduradas» no topo quando há duas escalas.
 */
function computeY1BoundsAlignedToYZero(yMin, yMax, saldoTotals) {
    const vals = saldoTotals.filter((v) => v != null && Number.isFinite(Number(v))).map(Number);
    const saldoMax = vals.length ? Math.max(...vals) : 0;
    const saldoMin = vals.length ? Math.min(...vals) : 0;
    const span = yMax - yMin;
    if (span <= 0 || !vals.length) {
        return { min: Math.min(0, saldoMin), max: Math.max(saldoMax, saldoMin + 1, 1) };
    }
    const t = (0 - yMin) / span;
    let y1Hi = Math.max(saldoMax * 1.03, saldoMax, 1e-6);
    let y1Lo;
    if (t <= 1e-10) {
        y1Lo = Math.min(0, saldoMin);
        if (y1Hi <= y1Lo) y1Hi = y1Lo + 1;
        return { min: y1Lo, max: y1Hi };
    }
    if (t >= 1 - 1e-10) {
        y1Lo = Math.min(saldoMin, 0) - Math.max(1, Math.abs(saldoMax) * 0.02);
        y1Hi = Math.max(saldoMax, y1Lo + 1);
        return { min: y1Lo, max: y1Hi };
    }
    y1Lo = (t * y1Hi) / (t - 1);
    if (!Number.isFinite(y1Lo)) {
        y1Lo = Math.min(0, saldoMin);
    }
    if (y1Hi < saldoMax) {
        y1Hi = saldoMax * 1.06;
        y1Lo = (t * y1Hi) / (t - 1);
    }
    if (y1Hi <= y1Lo) {
        y1Hi = y1Lo + 1;
    }
    return { min: y1Lo, max: y1Hi };
}

/**
 * Carrega e exibe os dados da página de relatórios.
 */
export async function loadReportsData(
    userExpenses,
    userGains,
    userAccounts,
    userCurrency,
    cofrinhoApplications,
    userProfile = null,
    expenseSplitRequests = null
) {
    ensureReportsListeners();
    lastReportsLoadArgs = [
        userExpenses,
        userGains,
        userAccounts,
        userCurrency,
        cofrinhoApplications,
        userProfile,
        expenseSplitRequests
    ];
    const outgoingAcceptedSplits = (expenseSplitRequests?.outgoing || []).filter((s) =>
        isAcceptedSettledSplitRequest(s)
    );
    const gainsForTotals = (userGains || []).filter((g) => g && !g.referenceOnly);

    const periodFilter = document.getElementById('period-filter');
    if (!periodFilter) return;

    const now = new Date();
    const cardPeriod = isDashboardPeriodLinked() ? periodFilter.value : getDefaultPeriodValue(now);

    const syntheticExpectedGains = buildSyntheticExpectedSplitGainsRows(
        cardPeriod,
        now,
        userExpenses || [],
        userAccounts || [],
        expenseSplitRequests?.outgoing || [],
        userGains || []
    );
    const gainsForDashboardRaw = [...gainsForTotals, ...syntheticExpectedGains];

    const expenseFacetSet = readDashboardOutflowFacetSetFromDom();
    const gainFacetSet = readDashboardInflowFacetSetFromDom();
    const dashSummationMode = dashOutflowCardSummationMode(expenseFacetSet);
    const expensesForDashboard = filterExpensesForDashboardFacets(
        userExpenses,
        userAccounts,
        expenseFacetSet
    );
    const gainsForDashboard = filterGainsForDashboardFacets(gainsForDashboardRaw, gainFacetSet);

    const allExpensesForCategoryChart = mapExpensesToPeriodContributions(
        DASHBOARD_CHART_AXIS_PERIOD,
        expensesForDashboard,
        userAccounts,
        now,
        userProfile,
        outgoingAcceptedSplits,
        dashSummationMode
    );
    const selectedCategory = refreshCategoryFilterOptions(allExpensesForCategoryChart);
    const categoryScopedExpenses = filterExpensesByCategory(expensesForDashboard, selectedCategory);

    await updateDashboardCardsAndTitlesForPeriod(
        cardPeriod,
        expensesForDashboard,
        gainsForDashboard,
        userAccounts,
        userCurrency,
        userProfile,
        outgoingAcceptedSplits,
        {
            expenseListForBalanceProjection: userExpenses,
            gainListForBalanceProjection: gainsForTotals,
            dashSummationMode,
            dashboardIncomeFacetsActive: gainFacetSet.size > 0,
            dashboardExpenseFacetsActive: expenseFacetSet.size > 0
        }
    );

    let saldoEmContaSeries = null;
    if (getShowFinancialChartSaldoTotal()) {
        const { startDate: chartAxisStart, endDate: chartAxisEnd } = getPeriodDateBounds(
            DASHBOARD_CHART_AXIS_PERIOD,
            now
        );
        if (chartAxisStart <= chartAxisEnd) {
            const chartMonths = enumerateCalendarMonths(chartAxisStart, chartAxisEnd);
            saldoEmContaSeries = await Promise.all(
                chartMonths.map((mo) =>
                    dashboardBalanceAtEndOfChartMonth(
                        mo,
                        now,
                        gainsForTotals,
                        userExpenses,
                        userAccounts,
                        userProfile,
                        outgoingAcceptedSplits
                    )
                )
            );
        }
    }

    renderUnifiedFinancialChart(
        DASHBOARD_CHART_AXIS_PERIOD,
        categoryScopedExpenses,
        gainsForDashboard,
        userAccounts,
        cofrinhoApplications,
        userCurrency,
        userProfile,
        outgoingAcceptedSplits,
        cardPeriod,
        saldoEmContaSeries,
        dashSummationMode
    );

    const catSel = document.getElementById('category-filter');
    const dashFiltBtn = document.getElementById('dashboard-filter-open-btn');
    if (dashFiltBtn && catSel) {
        const v = catSel.value;
        dashFiltBtn.classList.toggle('filter-drawer-trigger--active', Boolean(v) && v !== '__all__');
    }
}

/** Sincroniza o filtro de período do painel com um mês do grafo (Janeiro … Dezembro do ano do eixo). */
function applyDashboardPeriodFromChartMonth(monthsForAxis, dataIndex) {
    if (!monthsForAxis || dataIndex == null || dataIndex < 0 || dataIndex >= monthsForAxis.length) return;
    if (!lastReportsLoadArgs) return;
    const mo = monthsForAxis[dataIndex];
    const periodValue = `month-${Math.min(11, Math.max(0, mo.start.getMonth()))}`;
    const sel = document.getElementById('period-filter');
    if (!sel?.querySelector(`option[value="${periodValue}"]`)) return;
    if (sel.value === periodValue) return;
    sel.value = periodValue;
    markDashboardPeriodLinked();
    void reloadReportsWithBusy();
}

function monthKeyFromMonthObj(mo) {
    return `${mo.start.getFullYear()}-${String(mo.start.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeyFromDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Limites do mês civil anterior ao de `selStart` (primeiro dia … último segundo). */
function dashboardPrevCalendarMonthBounds(selStart) {
    const prevStart = new Date(selStart.getFullYear(), selStart.getMonth() - 1, 1);
    const prevEnd = new Date(selStart.getFullYear(), selStart.getMonth(), 0, 23, 59, 59, 999);
    return { prevStart, prevEnd };
}

function sumOutflowsClosedRange(
    startDate,
    endDate,
    userExpenses,
    userAccounts,
    now,
    userProfile,
    splitRequests,
    dashSummationMode = 'paid_through'
) {
    if (startDate > endDate) return 0;
    return enumerateCalendarMonths(startDate, endDate).reduce((sum, mo) => {
        const proj = isProjectionMonth(mo, now);
        return (
            sum +
            (proj
                ? dashSummationMode === 'pending_due'
                    ? sumPendingOutflowsProjectedForCalendarMonth(
                          mo,
                          userExpenses,
                          userAccounts,
                          now,
                          userProfile,
                          splitRequests
                      )
                    : sumOutflowsProjectedForCalendarMonth(
                          mo,
                          userExpenses,
                          userAccounts,
                          now,
                          userProfile,
                          splitRequests
                      )
                : sumOutflowsForCalendarMonth(
                      mo,
                      userExpenses,
                      userAccounts,
                      now,
                      userProfile,
                      splitRequests,
                      dashSummationMode
                  ))
        );
    }, 0);
}

/** Entradas − saídas no mês civil (`mo`), mesma regra de projeção de saídas do painel. */
function dashboardLiquidoMesCivil(
    mo,
    gainsForDashboard,
    userExpenses,
    userAccounts,
    now,
    userProfile,
    splitRequests,
    dashSummationMode = 'paid_through'
) {
    const g = sumMovementsInRange(gainsForDashboard || [], mo.start, mo.end);
    const o = isProjectionMonth(mo, now)
        ? dashSummationMode === 'pending_due'
            ? sumPendingOutflowsProjectedForCalendarMonth(
                  mo,
                  userExpenses,
                  userAccounts,
                  now,
                  userProfile,
                  splitRequests
              )
            : sumOutflowsProjectedForCalendarMonth(
                  mo,
                  userExpenses,
                  userAccounts,
                  now,
                  userProfile,
                  splitRequests
              )
        : sumOutflowsForCalendarMonth(
              mo,
              userExpenses,
              userAccounts,
              now,
              userProfile,
              splitRequests,
              dashSummationMode
          );
    return g - o;
}

function endOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function coerceDayOfMonth(value) {
    if (value == null || value === '') return undefined;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const s = String(value).trim();
    // Se vier um ISO date/time (ex.: "2026-03-10T..."), usa o dia do mês.
    if (s.includes('-') || s.includes('T') || s.includes('/')) {
        const d = new Date(s);
        if (!Number.isNaN(d.getTime())) {
            const day = d.getDate();
            if (day >= 1 && day <= 31) return day;
        }
    }
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < 1 || n > 31) return undefined;
    return n;
}

/**
 * Contribuição por vencimento/competência no mês (cartões, empréstimos, demais):
 * só entra no total dos cards / gráfico (mês não projetado) se a saída estiver efetivamente paga —
 * cartão/empréstimo: parcela com {@link isInstallmentDuePaidForCashOut}; demais: `isPaid !== false`;
 * séries fixas com confirmação no saldo continuam a depender de `cashOutConfirmedPeriods`.
 */
function expenseContributionPaidThroughToMonthKey(
    t,
    acc,
    monthKey,
    cutoffEndInclusive,
    userProfile = null,
    splitRequests = null,
    allUserExpenses = null,
    refNow = new Date()
) {
    const forSplit = allUserExpenses;
    const cutoffT = endOfDay(cutoffEndInclusive).getTime();
    const amt = Number(t.amount) || 0;
    const nInst = Math.max(1, parseInt(String(t.installmentCount ?? '1'), 10) || 1);

    // Cartão: usa vencimentos das parcelas
    if (acc && isCreditCardType(acc.type)) {
        const cd = coerceDayOfMonth(acc.closeDay ?? acc.closingDay);
        const dd = coerceDayOfMonth(acc.dueDay ?? acc.dueDate);
        const purchase = movementDateToJsDate(t.date);
        if (Number.isNaN(purchase.getTime())) return 0;

        // Se não tem vencimento configurado, trata como à vista pela data do lançamento
        if (!dd) {
            if (monthKeyFromDate(purchase) !== monthKey) return 0;
            if (purchase.getTime() > cutoffT) return 0;
            if (!isExpenseInstallmentDueCountedInCashFlow(t, purchase)) return 0;
            if (!expenseCountsAsCashOut(t, acc)) return 0;
            if (!isInstallmentDuePaidForCashOut(t, acc, purchase, userProfile, refNow)) return 0;
            return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
        }

        if (nInst < 2) {
            // Compra à vista no cartão: considera no mês do vencimento da fatura (mesma regra do app)
            const dues = getInstallmentDueDates(purchase, 1, cd, dd);
            const due = dues[0] || purchase;
            if (monthKeyFromDate(due) !== monthKey) return 0;
            if (due.getTime() > cutoffT) return 0;
            if (!isExpenseInstallmentDueCountedInCashFlow(t, due)) return 0;
            if (!expenseCountsAsCashOut(t, acc)) return 0;
            if (!isInstallmentDuePaidForCashOut(t, acc, due, userProfile, refNow)) return 0;
            return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
        }

        const dues = getInstallmentDueDates(purchase, nInst, cd, dd);
        if (!dues.length) return 0;
        const per = amt / nInst;
        let sum = 0;
        for (const d of dues) {
            if (monthKeyFromDate(d) !== monthKey) continue;
            if (d.getTime() > cutoffT) continue;
            if (!isExpenseInstallmentDueCountedInCashFlow(t, d)) continue;
            if (!isInstallmentDuePaidForCashOut(t, acc, d, userProfile, refNow)) continue;
            sum += per;
        }
        return applySplitNetToContribution(t, monthKey, sum, splitRequests, forSplit);
    }

    // Empréstimo: vencimentos mensais
    if (isLoanExpense(t) && (!acc || !isCreditCardType(acc.type)) && nInst >= 2) {
        if (t.isPaid === true) return 0;
        const purchase = movementDateToJsDate(t.date);
        if (Number.isNaN(purchase.getTime())) return 0;
        const dues = getLoanInstallmentDueDates(purchase, nInst);
        const per = amt / nInst;
        let sum = 0;
        for (const d of dues) {
            if (monthKeyFromDate(d) !== monthKey) continue;
            if (d.getTime() > cutoffT) continue;
            if (!isExpenseInstallmentDueCountedInCashFlow(t, d)) continue;
            if (!isInstallmentDuePaidForCashOut(t, acc || null, d, userProfile, refNow)) continue;
            sum += per;
        }
        return applySplitNetToContribution(t, monthKey, sum, splitRequests, forSplit);
    }

    const purchasePlain = movementDateToJsDate(t.date);
    if (!Number.isNaN(purchasePlain.getTime()) && acc && shouldDeferCashOutForMonthlyFixedSeries(t, acc, userProfile)) {
        if (monthKeyFromDate(purchasePlain) !== monthKey) return 0;
        if (purchasePlain.getTime() > cutoffT) return 0;
        if (!expenseCountsAsCashOut(t, acc)) return 0;
        if (!isInstallmentDuePaidForCashOut(t, acc, purchasePlain, userProfile, refNow)) return 0;
        return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
    }

    // Demais contas: pela data do lançamento
    const d = movementDateToJsDate(t.date);
    if (Number.isNaN(d.getTime())) return 0;
    if (monthKeyFromDate(d) !== monthKey) return 0;
    if (d.getTime() > cutoffT) return 0;
    if (!expenseCountsAsCashOut(t, acc)) return 0;
    if (t.isPaid === false) return 0;
    return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
}

/**
 * Todas as parcelas / competências com vencimento no mês até `cutoff`, pagas ou pendentes;
 * mesmo critério espacial/temporal que «pago até», sem filtro de pagamento — uma só `applySplitNetToContribution`.
 */
function expenseContributionAllPaidOrPendingDueInMonthKey(
    t,
    acc,
    monthKey,
    cutoffEndInclusive,
    userProfile = null,
    splitRequests = null,
    allUserExpenses = null
) {
    const forSplit = allUserExpenses;
    const cutoffT = endOfDay(cutoffEndInclusive).getTime();
    const amt = Number(t.amount) || 0;
    const nInst = Math.max(1, parseInt(String(t.installmentCount ?? '1'), 10) || 1);

    if (acc && isCreditCardType(acc.type)) {
        const cd = coerceDayOfMonth(acc.closeDay ?? acc.closingDay);
        const dd = coerceDayOfMonth(acc.dueDay ?? acc.dueDate);
        const purchase = movementDateToJsDate(t.date);
        if (Number.isNaN(purchase.getTime())) return 0;

        if (!dd) {
            if (monthKeyFromDate(purchase) !== monthKey) return 0;
            if (purchase.getTime() > cutoffT) return 0;
            if (!isExpenseInstallmentDueCountedInCashFlow(t, purchase)) return 0;
            if (!expenseCountsAsCashOut(t, acc)) return 0;
            return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
        }

        if (nInst < 2) {
            const dues = getInstallmentDueDates(purchase, 1, cd, dd);
            const due = dues[0] || purchase;
            if (monthKeyFromDate(due) !== monthKey) return 0;
            if (due.getTime() > cutoffT) return 0;
            if (!isExpenseInstallmentDueCountedInCashFlow(t, due)) return 0;
            if (!expenseCountsAsCashOut(t, acc)) return 0;
            return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
        }

        const dues = getInstallmentDueDates(purchase, nInst, cd, dd);
        if (!dues.length) return 0;
        const per = amt / nInst;
        let sum = 0;
        for (const d of dues) {
            if (monthKeyFromDate(d) !== monthKey) continue;
            if (d.getTime() > cutoffT) continue;
            if (!isExpenseInstallmentDueCountedInCashFlow(t, d)) continue;
            sum += per;
        }
        return applySplitNetToContribution(t, monthKey, sum, splitRequests, forSplit);
    }

    if (isLoanExpense(t) && (!acc || !isCreditCardType(acc.type)) && nInst >= 2) {
        if (t.isPaid === true) return 0;
        const purchase = movementDateToJsDate(t.date);
        if (Number.isNaN(purchase.getTime())) return 0;
        const dues = getLoanInstallmentDueDates(purchase, nInst);
        const per = amt / nInst;
        let sum = 0;
        for (const d of dues) {
            if (monthKeyFromDate(d) !== monthKey) continue;
            if (d.getTime() > cutoffT) continue;
            if (!isExpenseInstallmentDueCountedInCashFlow(t, d)) continue;
            sum += per;
        }
        return applySplitNetToContribution(t, monthKey, sum, splitRequests, forSplit);
    }

    const purchasePlain = movementDateToJsDate(t.date);
    if (
        !Number.isNaN(purchasePlain.getTime()) &&
        acc &&
        shouldDeferCashOutForMonthlyFixedSeries(t, acc, userProfile)
    ) {
        if (monthKeyFromDate(purchasePlain) !== monthKey) return 0;
        if (purchasePlain.getTime() > cutoffT) return 0;
        if (!expenseCountsAsCashOut(t, acc)) return 0;
        return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
    }

    const d = movementDateToJsDate(t.date);
    if (Number.isNaN(d.getTime())) return 0;
    if (monthKeyFromDate(d) !== monthKey) return 0;
    if (d.getTime() > cutoffT) return 0;
    if (!expenseCountsAsCashOut(t, acc)) return 0;
    return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
}

/**
 * Contribuição «pendente até ao fim do mês»: espelho de {@link expenseContributionPaidThroughToMonthKey}
 * com inclusão quando a parcela / lançamento ainda não está confirmado como pago.
 */
function expenseContributionPendingDueInMonthKey(
    t,
    acc,
    monthKey,
    cutoffEndInclusive,
    userProfile = null,
    splitRequests = null,
    allUserExpenses = null,
    refNow = new Date()
) {
    const forSplit = allUserExpenses;
    const cutoffT = endOfDay(cutoffEndInclusive).getTime();
    const amt = Number(t.amount) || 0;
    const nInst = Math.max(1, parseInt(String(t.installmentCount ?? '1'), 10) || 1);

    if (acc && isCreditCardType(acc.type)) {
        const cd = coerceDayOfMonth(acc.closeDay ?? acc.closingDay);
        const dd = coerceDayOfMonth(acc.dueDay ?? acc.dueDate);
        const purchase = movementDateToJsDate(t.date);
        if (Number.isNaN(purchase.getTime())) return 0;

        if (!dd) {
            if (monthKeyFromDate(purchase) !== monthKey) return 0;
            if (purchase.getTime() > cutoffT) return 0;
            if (!isExpenseInstallmentDueCountedInCashFlow(t, purchase)) return 0;
            if (!expenseCountsAsCashOut(t, acc)) return 0;
            if (isInstallmentDuePaidForCashOut(t, acc, purchase, userProfile, refNow)) return 0;
            return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
        }

        if (nInst < 2) {
            const dues = getInstallmentDueDates(purchase, 1, cd, dd);
            const due = dues[0] || purchase;
            if (monthKeyFromDate(due) !== monthKey) return 0;
            if (due.getTime() > cutoffT) return 0;
            if (!isExpenseInstallmentDueCountedInCashFlow(t, due)) return 0;
            if (!expenseCountsAsCashOut(t, acc)) return 0;
            if (isInstallmentDuePaidForCashOut(t, acc, due, userProfile, refNow)) return 0;
            return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
        }

        const dues = getInstallmentDueDates(purchase, nInst, cd, dd);
        if (!dues.length) return 0;
        const per = amt / nInst;
        let sum = 0;
        for (const d of dues) {
            if (monthKeyFromDate(d) !== monthKey) continue;
            if (d.getTime() > cutoffT) continue;
            if (!isExpenseInstallmentDueCountedInCashFlow(t, d)) continue;
            if (isInstallmentDuePaidForCashOut(t, acc, d, userProfile, refNow)) continue;
            sum += per;
        }
        return applySplitNetToContribution(t, monthKey, sum, splitRequests, forSplit);
    }

    if (isLoanExpense(t) && (!acc || !isCreditCardType(acc.type)) && nInst >= 2) {
        if (t.isPaid === true) return 0;
        const purchase = movementDateToJsDate(t.date);
        if (Number.isNaN(purchase.getTime())) return 0;
        const dues = getLoanInstallmentDueDates(purchase, nInst);
        const per = amt / nInst;
        let sum = 0;
        for (const d of dues) {
            if (monthKeyFromDate(d) !== monthKey) continue;
            if (d.getTime() > cutoffT) continue;
            if (!isExpenseInstallmentDueCountedInCashFlow(t, d)) continue;
            if (isInstallmentDuePaidForCashOut(t, acc || null, d, userProfile, refNow)) continue;
            sum += per;
        }
        return applySplitNetToContribution(t, monthKey, sum, splitRequests, forSplit);
    }

    const purchasePlain = movementDateToJsDate(t.date);
    if (
        !Number.isNaN(purchasePlain.getTime()) &&
        acc &&
        shouldDeferCashOutForMonthlyFixedSeries(t, acc, userProfile)
    ) {
        if (monthKeyFromDate(purchasePlain) !== monthKey) return 0;
        if (purchasePlain.getTime() > cutoffT) return 0;
        if (!expenseCountsAsCashOut(t, acc)) return 0;
        if (isInstallmentDuePaidForCashOut(t, acc, purchasePlain, userProfile, refNow)) return 0;
        return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
    }

    const d = movementDateToJsDate(t.date);
    if (Number.isNaN(d.getTime())) return 0;
    if (monthKeyFromDate(d) !== monthKey) return 0;
    if (d.getTime() > cutoffT) return 0;
    if (!expenseCountsAsCashOut(t, acc)) return 0;
    if (t.isPaid !== false) return 0;
    return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
}

/**
 * Saídas pendentes em mês futuro (projeção): parcelas com vencimento naquele mês ainda não pagas;
 * alinhado a `sumOutflowsProjectedForCalendarMonth` para despesas recorrentes / data no mês.
 */
function expenseContributionPendingProjectedForMonthKey(
    t,
    acc,
    monthKey,
    mo,
    now,
    userProfile = null,
    splitRequests = null,
    allUserExpenses = null,
    refNow = new Date()
) {
    const mk = monthKey;
    const targetMonthOrdinal = mo.start.getFullYear() * 12 + mo.start.getMonth();
    const amt = Number(t.amount) || 0;
    const nInst = Math.max(1, parseInt(String(t.installmentCount ?? '1'), 10) || 1);

    if (acc && isCreditCardType(acc.type)) {
        const cd = coerceDayOfMonth(acc.closeDay ?? acc.closingDay);
        const dd = coerceDayOfMonth(acc.dueDay ?? acc.dueDate);
        const purchase = movementDateToJsDate(t.date);
        if (Number.isNaN(purchase.getTime())) return 0;
        if (!expenseCountsAsCashOut(t, acc)) return 0;

        if (!dd) {
            if (monthKeyFromDate(purchase) !== mk) return 0;
            if (!isExpenseInstallmentDueCountedInCashFlow(t, purchase)) return 0;
            if (isInstallmentDuePaidForCashOut(t, acc, purchase, userProfile, refNow)) return 0;
            return applySplitNetToContribution(t, mk, amt, splitRequests, allUserExpenses);
        }

        if (nInst < 2) {
            const dues = getInstallmentDueDates(purchase, 1, cd, dd);
            const due = dues[0] || purchase;
            if (monthKeyFromDate(due) !== mk) return 0;
            if (!isExpenseInstallmentDueCountedInCashFlow(t, due)) return 0;
            if (isInstallmentDuePaidForCashOut(t, acc, due, userProfile, refNow)) return 0;
            return applySplitNetToContribution(t, mk, amt, splitRequests, allUserExpenses);
        }

        const dues = getInstallmentDueDates(purchase, nInst, cd, dd);
        if (!dues.length) return 0;
        const per = amt / nInst;
        let sum = 0;
        for (const d of dues) {
            if (monthKeyFromDate(d) !== mk) continue;
            if (!isExpenseInstallmentDueCountedInCashFlow(t, d)) continue;
            if (isInstallmentDuePaidForCashOut(t, acc, d, userProfile, refNow)) continue;
            sum += per;
        }
        return applySplitNetToContribution(t, mk, sum, splitRequests, allUserExpenses);
    }

    if (isLoanExpense(t) && (!acc || !isCreditCardType(acc.type)) && nInst >= 2) {
        if (t.isPaid === true) return 0;
        const purchase = movementDateToJsDate(t.date);
        if (Number.isNaN(purchase.getTime())) return 0;
        if (!expenseCountsAsCashOut(t, acc)) return 0;
        const dues = getLoanInstallmentDueDates(purchase, nInst);
        const per = amt / nInst;
        let sum = 0;
        for (const d of dues) {
            if (monthKeyFromDate(d) !== mk) continue;
            if (!isExpenseInstallmentDueCountedInCashFlow(t, d)) continue;
            if (isInstallmentDuePaidForCashOut(t, acc || null, d, userProfile, refNow)) continue;
            sum += per;
        }
        return applySplitNetToContribution(t, mk, sum, splitRequests, allUserExpenses);
    }

    const d = movementDateToJsDate(t.date);
    if (Number.isNaN(d.getTime())) return 0;

    if (t.recurringMonthly === true) {
        const baseMonthOrdinal = d.getFullYear() * 12 + d.getMonth();
        if (targetMonthOrdinal < baseMonthOrdinal) return 0;
        if (!expenseCountsAsCashOut(t, acc)) return 0;
        if (t.isPaid !== false) return 0;
        return applySplitNetToContribution(t, mk, amt, splitRequests, allUserExpenses);
    }

    if (d >= mo.start && d <= mo.end && expenseCountsAsCashOut(t, acc)) {
        if (t.isPaid !== false) return 0;
        return applySplitNetToContribution(t, mk, amt, splitRequests, allUserExpenses);
    }
    return 0;
}

function sumPendingOutflowsProjectedForCalendarMonth(
    mo,
    userExpenses,
    userAccounts,
    now,
    userProfile = null,
    splitRequests = null
) {
    const accountsById = new Map((userAccounts || []).map((a) => [a.id, a]));
    const mk = `${mo.start.getFullYear()}-${String(mo.start.getMonth() + 1).padStart(2, '0')}`;
    let sum = 0;
    for (const t of userExpenses || []) {
        const acc = accountsById.get(t.accountId);
        sum += expenseContributionPendingProjectedForMonthKey(
            t,
            acc,
            mk,
            mo,
            now,
            userProfile,
            splitRequests,
            userExpenses,
            now
        );
    }
    return sum;
}

/**
 * Converte despesas em "contribuições do período" para usar em agregações por categoria.
 * Meses passados / mês atual: conforme modo do painel (pago até ao corte ou pendente até ao fim do mês).
 * Meses futuros: projeção alinhada a `expenseContributionProjectedToMonthKey` ou à variante pendente.
 */
function mapExpensesToPeriodContributions(
    period,
    userExpenses,
    userAccounts,
    now,
    userProfile = null,
    splitRequests = null,
    dashSummationMode = 'paid_through'
) {
    const { startDate, endDate } = getPeriodDateBounds(period, now);
    const months = enumerateCalendarMonths(startDate, endDate);
    const accountsById = new Map((userAccounts || []).map((a) => [a.id, a]));
    const out = [];

    for (const mo of months) {
        const mk = monthKeyFromMonthObj(mo);
        const projection = isProjectionMonth(mo, now);

        for (const t of userExpenses || []) {
            const acc = accountsById.get(t.accountId);
            const cutoff = mo.end;

            let v;
            if (projection) {
                if (dashSummationMode === 'pending_due') {
                    v = expenseContributionPendingProjectedForMonthKey(
                        t,
                        acc,
                        mk,
                        mo,
                        now,
                        userProfile,
                        splitRequests,
                        userExpenses,
                        now
                    );
                } else {
                    v = expenseContributionProjectedToMonthKey(
                        t,
                        acc,
                        mk,
                        now,
                        userProfile,
                        splitRequests,
                        userExpenses
                    );
                }
            } else {
                if (dashSummationMode === 'pending_due') {
                    v = expenseContributionPendingDueInMonthKey(
                        t,
                        acc,
                        mk,
                        cutoff,
                        userProfile,
                        splitRequests,
                        userExpenses,
                        now
                    );
                } else if (dashSummationMode === 'all_slices') {
                    v = expenseContributionAllPaidOrPendingDueInMonthKey(
                        t,
                        acc,
                        mk,
                        cutoff,
                        userProfile,
                        splitRequests,
                        userExpenses
                    );
                } else {
                    v = expenseContributionPaidThroughToMonthKey(
                        t,
                        acc,
                        mk,
                        cutoff,
                        userProfile,
                        splitRequests,
                        userExpenses,
                        now
                    );
                }
            }
            if (!v || v <= 0) continue;
            out.push({
                category: t.category,
                subcategory: t.subcategory,
                amount: v
            });
        }
    }
    return out;
}

function setTextIfExists(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function sumOutflowsForPeriod(
    period,
    userExpenses,
    userAccounts,
    now,
    userProfile = null,
    splitRequests = null,
    dashSummationMode = 'paid_through'
) {
    let { startDate, endDate } = getPeriodDateBounds(period, now);
    if (startDate > endDate) return 0;
    const months = enumerateCalendarMonths(startDate, endDate);
    return months.reduce((sum, mo) => {
        const proj = isProjectionMonth(mo, now);
        return (
            sum +
            (proj
                ? dashSummationMode === 'pending_due'
                    ? sumPendingOutflowsProjectedForCalendarMonth(
                          mo,
                          userExpenses,
                          userAccounts,
                          now,
                          userProfile,
                          splitRequests
                      )
                    : sumOutflowsProjectedForCalendarMonth(
                          mo,
                          userExpenses,
                          userAccounts,
                          now,
                          userProfile,
                          splitRequests
                      )
                : sumOutflowsForCalendarMonth(
                      mo,
                      userExpenses,
                      userAccounts,
                      now,
                      userProfile,
                      splitRequests,
                      dashSummationMode
                  ))
        );
    }, 0);
}

function sumGainsForPeriod(period, userGains) {
    const now = new Date();
    let { startDate, endDate } = getPeriodDateBounds(period, now);
    if (startDate > endDate) return 0;
    // Períodos futuros: soma entradas cuja data cai no intervalo (inclui linhas já lançadas para meses futuros / série).
    return sumMovementsInRange(userGains || [], startDate, endDate);
}

async function updateDashboardCardsAndTitlesForPeriod(
    period,
    userExpenses,
    gainsForDashboard,
    userAccounts,
    userCurrency,
    userProfile = null,
    splitRequests = null,
    {
        expenseListForBalanceProjection,
        gainListForBalanceProjection,
        dashSummationMode = 'paid_through',
        dashboardIncomeFacetsActive = true,
        dashboardExpenseFacetsActive = true
    } = {}
) {
    const expenseListForBalanceProj = expenseListForBalanceProjection ?? userExpenses;
    const gainsForBalanceProj = gainListForBalanceProjection ?? gainsForDashboard;
    const now = new Date();
    const isSingleMonth = /^month-\d+$/.test(period || '');
    const { startDate: dashStart, endDate: dashEnd } = getPeriodDateBounds(period, now);
    const prevBounds = isSingleMonth ? dashboardPrevCalendarMonthBounds(dashStart) : null;

    setSummaryCardTitle('dashboard-balance', DASHBOARD_SUMMARY_COPY.titles.balance);
    setSummaryCardTitle('monthly-income', DASHBOARD_SUMMARY_COPY.titles.income);
    setSummaryCardTitle('monthly-expenses', DASHBOARD_SUMMARY_COPY.titles.expenses);
    setSummaryCardTitle('dashboard-projection', DASHBOARD_SUMMARY_COPY.titles.projection);
    setTextIfExists(
        'financial-progression-title',
        'Fluxo mensal'
    );

    const facetDashReady = dashboardIncomeFacetsActive && dashboardExpenseFacetsActive;

    // Valores dos cards respondendo ao período do filtro
    const income = dashboardIncomeFacetsActive ? sumGainsForPeriod(period, gainsForDashboard) : null;
    const out = dashboardExpenseFacetsActive
        ? sumOutflowsForPeriod(
              period,
              userExpenses,
              userAccounts,
              now,
              userProfile,
              splitRequests,
              dashSummationMode
          )
        : null;

    if (!dashboardIncomeFacetsActive) {
        setTextIfExists('monthly-income', '—');
        const incVar = document.getElementById('monthly-income-variation');
        if (incVar) {
            incVar.innerHTML = summaryFilterRequiredHintHtml(DASHBOARD_SUMMARY_COPY.incomeFacetHint);
        }
    } else {
        setTextIfExists('monthly-income', formatCurrency(income ?? 0, userCurrency));
        const incomePrev =
            prevBounds && prevBounds.prevStart <= prevBounds.prevEnd
                ? sumMovementsInRange(gainsForDashboard || [], prevBounds.prevStart, prevBounds.prevEnd)
                : 0;
        setMovementSummaryMomVariation(
            document.getElementById('monthly-income-variation'),
            income ?? 0,
            incomePrev,
            isSingleMonth,
            false
        );
    }

    if (!dashboardExpenseFacetsActive) {
        setTextIfExists('monthly-expenses', '—');
        const outVar = document.getElementById('monthly-expenses-variation');
        if (outVar) {
            outVar.innerHTML = summaryFilterRequiredHintHtml(DASHBOARD_SUMMARY_COPY.expenseFacetHint);
        }
    } else {
        setTextIfExists('monthly-expenses', formatCurrency(out ?? 0, userCurrency));
        const outPrev =
            prevBounds && prevBounds.prevStart <= prevBounds.prevEnd
                ? sumOutflowsClosedRange(
                      prevBounds.prevStart,
                      prevBounds.prevEnd,
                      userExpenses,
                      userAccounts,
                      now,
                      userProfile,
                      splitRequests,
                      dashSummationMode
                  )
                : 0;
        setMovementSummaryMomVariation(
            document.getElementById('monthly-expenses-variation'),
            out ?? 0,
            outPrev,
            isSingleMonth,
            true
        );
    }

    // Fluxo líquido (entradas − saídas): todos os meses do período — passados com totais realizados;
    // futuros com projeção; alinhado ao eixo «Sobra» do gráfico e a {@link dashboardLiquidoMesCivil}.
    let dashNetProj = 0;
    let dashAnyProj = false;
    {
        let { startDate, endDate } = getPeriodDateBounds(period, now);
        if (startDate > endDate) {
            setTextIfExists('dashboard-projection-total', '—');
        } else if (!facetDashReady) {
            setTextIfExists('dashboard-projection-total', '—');
        } else {
            const months = enumerateCalendarMonths(startDate, endDate);
            dashAnyProj = months.length > 0;
            dashNetProj = months.reduce(
                (sum, mo) =>
                    sum +
                    dashboardLiquidoMesCivil(
                        mo,
                        gainsForDashboard,
                        userExpenses,
                        userAccounts,
                        now,
                        userProfile,
                        splitRequests,
                        dashSummationMode
                    ),
                0
            );
            setTextIfExists(
                'dashboard-projection-total',
                dashAnyProj ? formatCurrency(dashNetProj, userCurrency) : '—'
            );
        }
    }

    const projVarEl = document.getElementById('dashboard-projection-variation');
    if (projVarEl) {
        if (!facetDashReady) {
            projVarEl.innerHTML = summaryFilterRequiredHintHtml(DASHBOARD_SUMMARY_COPY.projectionFacetHint);
        } else if (!isSingleMonth) {
            setMovementSummaryMomVariation(projVarEl, 0, 0, false, false);
        } else if (!dashAnyProj || !prevBounds) {
            projVarEl.innerHTML = summaryFilterRequiredHintHtml(DASHBOARD_SUMMARY_COPY.projectionSingleMonthHint);
        } else {
            const selMonths = enumerateCalendarMonths(dashStart, dashEnd);
            const prevMonths = enumerateCalendarMonths(prevBounds.prevStart, prevBounds.prevEnd);
            const selMo = selMonths[0];
            const prevMo = prevMonths[0];
            if (selMo && prevMo) {
                const netCurr = dashboardLiquidoMesCivil(
                    selMo,
                    gainsForDashboard,
                    userExpenses,
                    userAccounts,
                    now,
                    userProfile,
                    splitRequests,
                    dashSummationMode
                );
                const netPrev = dashboardLiquidoMesCivil(
                    prevMo,
                    gainsForDashboard,
                    userExpenses,
                    userAccounts,
                    now,
                    userProfile,
                    splitRequests,
                    dashSummationMode
                );
                setMovementSummaryMomVariation(projVarEl, netCurr, netPrev, true, false);
            }
        }
    }

    // ── Card Saldo em conta ────────────────────────────────────────────────────
    let balanceCurr = null;
    let balancePrev = null;
    try {
        const { startDate, endDate } = getPeriodDateBounds(period, now);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        if (endDate > endOfToday) {
            const baseBal = await fetchDashboardPeriodBalance(
                new Date(now.getFullYear(), now.getMonth(), 1),
                endOfToday
            );
            if (baseBal != null) {
                const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                let projected = baseBal;
                if (endDate >= nextMonthStart) {
                    for (const mo of enumerateCalendarMonths(nextMonthStart, endDate)) {
                        const inc = sumProjectedGainsForCalendarMonth(mo, gainsForBalanceProj);
                        const outMo = sumOutflowsProjectedForCalendarMonth(
                            mo,
                            expenseListForBalanceProj,
                            userAccounts,
                            now,
                            userProfile,
                            splitRequests
                        );
                        projected += inc - outMo;
                    }
                }
                balanceCurr = projected;
            }
        } else {
            balanceCurr = await fetchDashboardPeriodBalance(startDate, endDate);
        }
        if (isSingleMonth && prevBounds) {
            balancePrev = await fetchDashboardPeriodBalance(prevBounds.prevStart, prevBounds.prevEnd);
        }
    } catch {
        balanceCurr = null;
        balancePrev = null;
    }

    setTextIfExists(
        'dashboard-balance-total',
        balanceCurr != null ? formatCurrency(balanceCurr, userCurrency) : '—'
    );

    const balVarEl = document.getElementById('dashboard-balance-variation');
    if (balVarEl) {
        if (!isSingleMonth) {
            setMovementSummaryMomVariation(balVarEl, 0, 0, false, false);
        } else if (balanceCurr == null) {
            balVarEl.innerHTML = summaryFilterRequiredHintHtml(DASHBOARD_SUMMARY_COPY.balanceVariationHint);
        } else {
            setMovementSummaryMomVariation(
                balVarEl,
                balanceCurr,
                balancePrev != null ? balancePrev : 0,
                true,
                false
            );
        }
    }
}

function filterExpensesByPeriod(period, userExpenses) {
    const now = new Date();
    const { startDate, endDate } = getPeriodDateBounds(period, now);

    return (userExpenses || []).filter((t) => {
        const transactionDate = movementDateToJsDate(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
    });
}

/**
 * Posição investida atual só no mês civil atual; meses passados sem registro = 0; futuros = null.
 */
function investmentSeriesNoProjection(months, investedTotal, now = new Date()) {
    const y = now.getFullYear();
    const m = now.getMonth();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const v = Number(investedTotal) || 0;

    return months.map((mo) => {
        if (mo.start.getFullYear() === y && mo.start.getMonth() === m) {
            return v;
        }
        if (mo.end < startOfToday) {
            return 0;
        }
        return null;
    });
}

/** Aplica alpha a cor #rrggbb (ou retorna cor original se não for hex). */
function colorWithAlpha(hex, alpha) {
    const s = String(hex || '').trim();
    if (!s.startsWith('#') || (s.length !== 7 && s.length !== 4)) return s;
    let r;
    let g;
    let b;
    if (s.length === 7) {
        r = parseInt(s.slice(1, 3), 16);
        g = parseInt(s.slice(3, 5), 16);
        b = parseInt(s.slice(5, 7), 16);
    } else {
        r = parseInt(s[1] + s[1], 16);
        g = parseInt(s[2] + s[2], 16);
        b = parseInt(s[3] + s[3], 16);
    }
    if ([r, g, b].some((x) => Number.isNaN(x))) return s;
    return `rgba(${r},${g},${b},${alpha})`;
}

function segmentBorderColorFactory(baseColor, projectionFlags) {
    return (ctx) => {
        const i0 = ctx.p0DataIndex;
        const i1 = ctx.p1DataIndex;
        if (i0 == null || i1 == null) return baseColor;
        const proj = projectionFlags[i0] || projectionFlags[i1];
        return proj ? colorWithAlpha(baseColor, 0.72) : baseColor;
    };
}

function pointColorsForProjection(baseColor, projectionFlags, alphaFill = 0.58) {
    return projectionFlags.map((pf) => (pf ? colorWithAlpha(baseColor, alphaFill) : baseColor));
}

function pointBorderColorsForProjection(baseColor, projectionFlags) {
    return projectionFlags.map((pf) => (pf ? colorWithAlpha(baseColor, 0.82) : baseColor));
}

/**
 * Índice no eixo (0…n-1) do mês destacado quando o painel está num período `month-*` do mesmo ano dos meses desenhados.
 * Caso contrário, sem destaque (‑1).
 */
function resolveDashboardChartEmphasisMonthIndex(periodFilterValue, chartMonths) {
    const monthMatch = /^month-(\d+)$/.exec(periodFilterValue || '');
    if (!monthMatch || !chartMonths?.length) return -1;
    const mi = Math.min(11, Math.max(0, parseInt(monthMatch[1], 10)));
    const axisYear = chartMonths[0].start.getFullYear();
    return chartMonths.findIndex((mo) => mo.start.getMonth() === mi && mo.start.getFullYear() === axisYear);
}

/** Faixa suave atrás do mês em destaque no painel (alinha aos cards quando o período é um mês). */
function createCurrentMonthBandPlugin(enabled, monthIndex, monthCount) {
    return {
        id: 'dashboardCurrentMonthBand',
        beforeDatasetsDraw(chart) {
            if (!enabled || monthIndex < 0 || monthIndex >= monthCount) return;
            const xScale = chart.scales.x;
            const { chartArea, ctx } = chart;
            if (!xScale || !chartArea) return;
            const cx = xScale.getPixelForTick(monthIndex);
            if (cx == null || Number.isNaN(cx)) return;
            const n = Math.max(1, monthCount);
            const x0 = xScale.getPixelForTick(0);
            const x1 = xScale.getPixelForTick(Math.min(n - 1, 1));
            const step = n > 1 && Math.abs(x1 - x0) > 1 ? Math.abs(x1 - x0) : chartArea.width / n;
            const w = step * 0.88;
            ctx.save();
            ctx.fillStyle = isDarkTheme() ? 'rgba(59, 130, 246, 0.07)' : 'rgba(59, 130, 246, 0.06)';
            ctx.fillRect(cx - w / 2, chartArea.top, w, chartArea.bottom - chartArea.top);
            ctx.restore();
        }
    };
}

export function sumMovementsInRange(items, rangeStart, rangeEnd) {
    return (items || []).reduce((sum, t) => {
        const d = movementDateToJsDate(t.date);
        if (d >= rangeStart && d <= rangeEnd) return sum + (Number(t.amount) || 0);
        return sum;
    }, 0);
}

/**
 * Modo de agregação das saídas no painel (pago até ao corte / pendente / ambos), igual ao card «Saídas».
 * Usa os chips do dashboard quando visíveis; senão o que estiver em `localStorage`.
 */
export function getDashboardExpenseSummationMode() {
    let expenseFacetSet = readDashboardOutflowFacetSetFromDom();
    if (expenseFacetSet.size === 0) {
        expenseFacetSet = parseDashboardFlowFacetsFromStorage().expenses;
    }
    return dashOutflowCardSummationMode(expenseFacetSet);
}

/**
 * Contribuição no mês civil `mo` de uma única despesa **essencial**, mesma regra do painel (pago/projetado/pendente).
 */
export function expenseEssentialDashboardContributionInMonth(
    t,
    mo,
    userAccounts,
    now,
    userProfile = null,
    splitRequests = null,
    userExpenses = null,
    dashSummationMode = 'paid_through'
) {
    if (!expenseIsMarkedFixed(t)) return 0;
    const accountsById = new Map((userAccounts || []).map((a) => [a.id, a]));
    const acc = accountsById.get(t.accountId);
    const mk = `${mo.start.getFullYear()}-${String(mo.start.getMonth() + 1).padStart(2, '0')}`;
    const cutoff = mo.end;

    if (isProjectionMonth(mo, now)) {
        if (dashSummationMode === 'pending_due') {
            return expenseContributionPendingProjectedForMonthKey(
                t,
                acc,
                mk,
                mo,
                now,
                userProfile,
                splitRequests,
                userExpenses,
                now
            );
        }
        return expenseContributionProjectedToMonthKey(
            t,
            acc,
            mk,
            now,
            userProfile,
            splitRequests,
            userExpenses
        );
    }

    if (dashSummationMode === 'pending_due') {
        return expenseContributionPendingDueInMonthKey(
            t,
            acc,
            mk,
            cutoff,
            userProfile,
            splitRequests,
            userExpenses,
            now
        );
    }
    if (dashSummationMode === 'all_slices') {
        return expenseContributionAllPaidOrPendingDueInMonthKey(
            t,
            acc,
            mk,
            cutoff,
            userProfile,
            splitRequests,
            userExpenses
        );
    }
    return expenseContributionPaidThroughToMonthKey(
        t,
        acc,
        mk,
        cutoff,
        userProfile,
        splitRequests,
        userExpenses,
        now
    );
}

export function sumEssentialOutflowsDashboardPlanningMonth(
    mo,
    userExpenses,
    userAccounts,
    now,
    userProfile = null,
    splitRequests = null,
    dashSummationMode = 'paid_through'
) {
    let sum = 0;
    for (const t of userExpenses || []) {
        sum += expenseEssentialDashboardContributionInMonth(
            t,
            mo,
            userAccounts,
            now,
            userProfile,
            splitRequests,
            userExpenses,
            dashSummationMode
        );
    }
    return sum;
}

/**
 * Contribuição no mês de uma despesa **essencial**, alinhada à **lista de Saídas** (vencimentos no mês,
 * mês civil completo até `mo.end`, parcelas de cartão pendentes incluídas).
 */
export function expenseEssentialListContributionInMonth(
    t,
    mo,
    userAccounts,
    userProfile = null,
    splitRequests = null,
    userExpenses = null
) {
    if (!expenseIsMarkedFixed(t)) return 0;
    const accountsById = new Map((userAccounts || []).map((a) => [a.id, a]));
    const acc = accountsById.get(t.accountId);
    const mk = `${mo.start.getFullYear()}-${String(mo.start.getMonth() + 1).padStart(2, '0')}`;
    return expenseContributionPaidThroughListMonthKey(
        t,
        acc,
        mk,
        mo.end,
        userProfile,
        splitRequests,
        userExpenses
    );
}

export function sumEssentialOutflowsListPlanningMonth(
    mo,
    userExpenses,
    userAccounts,
    userProfile = null,
    splitRequests = null
) {
    let sum = 0;
    for (const t of userExpenses || []) {
        sum += expenseEssentialListContributionInMonth(
            t,
            mo,
            userAccounts,
            userProfile,
            splitRequests,
            userExpenses
        );
    }
    return sum;
}

/**
 * Saldo livre para o Planejamento Base Zero: **entradas no mês** como na lista Entradas (inclui
 * «Expectativa de estorno» sintética) menos **só saídas essenciais** no mês, com a **mesma soma da lista
 * de Saídas** (parcelas com vencimento no mês, pago ou pendente).
 */
export function planningSaldoLivreMes(
    month,
    year,
    gains,
    expenses,
    userAccounts,
    userProfile = null,
    splitOutgoing = null,
    now = new Date()
) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    const months = enumerateCalendarMonths(startDate, endDate);
    const mo = months[0];
    if (!mo) return 0;

    const gainsFiltered = (gains || []).filter((g) => g && !g.referenceOnly);

    const totalGanhos = sumMovementsInRange(gainsFiltered, mo.start, mo.end);
    const totalEssencial = sumEssentialOutflowsListPlanningMonth(
        mo,
        expenses,
        userAccounts,
        userProfile,
        splitOutgoing
    );
    return totalGanhos - totalEssencial;
}

/**
 * Total de saídas no mês-calendário — cards «Saídas» / «Balanço» e eixo de saídas do gráfico (mês atual/passado):
 * `paid_through`: só confirmadas pagas ao corte; `pending_due`: só em aberto; `all_slices`: pago + pendente no mês (sem duplicar splits).
 */
function sumOutflowsForCalendarMonth(
    mo,
    userExpenses,
    userAccounts,
    now,
    userProfile = null,
    splitRequests = null,
    dashSummationMode = 'paid_through'
) {
    const accountsById = new Map((userAccounts || []).map((a) => [a.id, a]));
    const mk = `${mo.start.getFullYear()}-${String(mo.start.getMonth() + 1).padStart(2, '0')}`;
    let sum = 0;
    for (const t of userExpenses || []) {
        const acc = accountsById.get(t.accountId);
        const cutoff = mo.end;
        let row;
        if (dashSummationMode === 'pending_due') {
            row = expenseContributionPendingDueInMonthKey(
                t,
                acc,
                mk,
                cutoff,
                userProfile,
                splitRequests,
                userExpenses,
                now
            );
        } else if (dashSummationMode === 'all_slices') {
            row = expenseContributionAllPaidOrPendingDueInMonthKey(
                t,
                acc,
                mk,
                cutoff,
                userProfile,
                splitRequests,
                userExpenses
            );
        } else {
            row = expenseContributionPaidThroughToMonthKey(
                t,
                acc,
                mk,
                cutoff,
                userProfile,
                splitRequests,
                userExpenses,
                now
            );
        }
        sum += row;
    }
    return sum;
}

/**
 * Série «Saldo em conta» no eixo direito: mesmos valores do card (API / ledger + projeção).
 * `dashboardHighlightPeriod` combina com os cards (`month-*` → destaque na coluna correspondente ao ano do eixo).
 */
function renderUnifiedFinancialChart(
    period,
    userExpenses,
    gainsForDashboard,
    userAccounts,
    cofrinhoApplications,
    userCurrency,
    userProfile = null,
    splitRequests = null,
    dashboardHighlightPeriod = '',
    saldoEmContaSeries = null,
    dashSummationMode = 'paid_through'
) {
    const canvas = document.getElementById('financial-progression-chart');
    if (!canvas) return;

    canvas.removeAttribute('title');

    const now = new Date();
    let { startDate, endDate } = getPeriodDateBounds(period, now);
    if (startDate > endDate) return;
    const months = enumerateCalendarMonths(startDate, endDate);
    if (months.length === 0) return;

    const expenses = userExpenses || [];
    const gains = gainsForDashboard || [];
    const investedTotal = getTotalApplicationsSum(cofrinhoApplications);

    const labels = months.map((mo) => mo.label);
    const projectionFlags = months.map((mo) => isProjectionMonth(mo, now));
    const dataGastos = months.map((mo) =>
        isProjectionMonth(mo, now)
            ? dashSummationMode === 'pending_due'
                ? sumPendingOutflowsProjectedForCalendarMonth(
                      mo,
                      expenses,
                      userAccounts,
                      now,
                      userProfile,
                      splitRequests
                  )
                : sumOutflowsProjectedForCalendarMonth(
                      mo,
                      expenses,
                      userAccounts,
                      now,
                      userProfile,
                      splitRequests
                  )
            : sumOutflowsForCalendarMonth(
                  mo,
                  expenses,
                  userAccounts,
                  now,
                  userProfile,
                  splitRequests,
                  dashSummationMode
              )
    );
    const dataGanhos = months.map((mo) => sumMovementsInRange(gains, mo.start, mo.end));
    const dataInvest = investmentSeriesNoProjection(months, investedTotal);
    /** Balanço mensal: entradas do mês menos saídas (realizadas ou projetadas conforme o mês). */
    const dataSobraMes = months.map((_, i) => (dataGanhos[i] || 0) - (dataGastos[i] || 0));

    const showSaldoTotalBar = getShowFinancialChartSaldoTotal();
    const dataSaldoTotal =
        showSaldoTotalBar &&
        Array.isArray(saldoEmContaSeries) &&
        saldoEmContaSeries.length === months.length
            ? saldoEmContaSeries.map((v) =>
                  v == null || !Number.isFinite(Number(v)) ? null : Number(v)
              )
            : [];

    if (financialProgressionChart) financialProgressionChart.destroy();

    const { tick, grid } = getChartAxisColors();
    const fc = getFinancialChartColors();
    const ganhosColor = fc.ganhos;
    const gastosColor = fc.gastos;
    const invColor = FINANCIAL_CHART_INVEST_COLOR;
    const sobraPosColor = fc.saldoPos;
    const sobraNegColor = fc.saldoNeg;
    const saldoTotalColor = fc.saldoTotal;

    const emphasisMonthIdx = resolveDashboardChartEmphasisMonthIndex(dashboardHighlightPeriod, months);

    const pointRadiusProj = projectionFlags.map((pf) => (pf ? 3 : 4));

    const finTypePref = getChartTypePreference('financialProgression');
    syncChartTypeToggleUI('financialProgression');
    const barMode = finTypePref === 'bar';
    const areaMode = finTypePref === 'area';

    const barMonthOpacity = (i) => {
        if (emphasisMonthIdx >= 0 && i === emphasisMonthIdx) return 1;
        if (projectionFlags[i]) return 0.58;
        return 0.38;
    };

    const barPaint = (hex, i) => colorWithAlpha(hex, 0.92 * barMonthOpacity(i));
    const barPaintSobra = (i) => {
        const v = Number(dataSobraMes[i]) || 0;
        const hex = v < 0 ? sobraNegColor : sobraPosColor;
        return colorWithAlpha(hex, 0.92 * barMonthOpacity(i));
    };

    const lineFill = (hex) =>
        projectionFlags.map((pf) => (pf ? colorWithAlpha(hex, 0.24) : colorWithAlpha(hex, 0.45)));

    let datasets = barMode
        ? [
              {
                  type: 'bar',
                  label: 'Entradas',
                  data: dataGanhos,
                  yAxisID: 'y',
                  backgroundColor: dataGanhos.map((_, i) => barPaint(ganhosColor, i)),
                  borderColor: dataGanhos.map((_, i) => barPaint(ganhosColor, i)),
                  borderWidth: 0,
                  borderRadius: 6,
                  borderSkipped: false,
                  order: 2
              },
              {
                  type: 'bar',
                  label: 'Saídas',
                  data: dataGastos,
                  yAxisID: 'y',
                  backgroundColor: dataGastos.map((_, i) => barPaint(gastosColor, i)),
                  borderColor: dataGastos.map((_, i) => barPaint(gastosColor, i)),
                  borderWidth: 0,
                  borderRadius: 6,
                  borderSkipped: false,
                  order: 2
              },
              {
                  type: 'bar',
                  label: 'Balanço',
                  data: dataSobraMes,
                  yAxisID: 'y',
                  backgroundColor: dataSobraMes.map((_, i) => barPaintSobra(i)),
                  borderColor: dataSobraMes.map((_, i) => barPaintSobra(i)),
                  borderWidth: 0,
                  borderRadius: 6,
                  borderSkipped: false,
                  order: 2
              }
          ]
        : [
              {
                  label: 'Entradas',
                  data: dataGanhos,
                  yAxisID: 'y',
                  borderColor: ganhosColor,
                  segment: {
                      borderColor: segmentBorderColorFactory(ganhosColor, projectionFlags)
                  },
                  pointBackgroundColor: pointColorsForProjection(ganhosColor, projectionFlags),
                  pointBorderColor: pointBorderColorsForProjection(ganhosColor, projectionFlags),
                  pointRadius: pointRadiusProj,
                  backgroundColor: lineFill(ganhosColor),
                  fill: areaMode ? 'stack' : false,
                  tension: 0.35,
                  spanGaps: true,
                  stack: areaMode ? 'main' : undefined
              },
              {
                  label: 'Saídas',
                  data: dataGastos,
                  yAxisID: 'y',
                  borderColor: gastosColor,
                  segment: {
                      borderColor: segmentBorderColorFactory(gastosColor, projectionFlags)
                  },
                  pointBackgroundColor: pointColorsForProjection(gastosColor, projectionFlags),
                  pointBorderColor: pointBorderColorsForProjection(gastosColor, projectionFlags),
                  pointRadius: pointRadiusProj,
                  backgroundColor: lineFill(gastosColor),
                  fill: areaMode ? 'stack' : false,
                  tension: 0.35,
                  spanGaps: true,
                  stack: areaMode ? 'main' : undefined
              },
              {
                  label: 'Patrimônio investido',
                  data: dataInvest,
                  yAxisID: 'y',
                  borderColor: invColor,
                  segment: {
                      borderColor: segmentBorderColorFactory(invColor, projectionFlags)
                  },
                  pointBackgroundColor: pointColorsForProjection(invColor, projectionFlags),
                  pointBorderColor: pointBorderColorsForProjection(invColor, projectionFlags),
                  pointRadius: pointRadiusProj,
                  backgroundColor: lineFill(invColor),
                  fill: areaMode ? 'stack' : false,
                  tension: 0,
                  spanGaps: false,
                  stack: areaMode ? 'main' : undefined
              },
              {
                  label: 'Balanço',
                  data: dataSobraMes,
                  yAxisID: 'y',
                  borderColor: sobraPosColor,
                  segment: {
                      borderColor: (ctx) => {
                          const i0 = ctx.p0DataIndex;
                          const i1 = ctx.p1DataIndex;
                          if (i0 == null || i1 == null) return sobraPosColor;
                          const v0 = Number(dataSobraMes[i0]) || 0;
                          const v1 = Number(dataSobraMes[i1]) || 0;
                          const base = v0 < 0 && v1 < 0 ? sobraNegColor : sobraPosColor;
                          const proj = projectionFlags[i0] || projectionFlags[i1];
                          return proj ? colorWithAlpha(base, 0.72) : base;
                      }
                  },
                  pointBackgroundColor: projectionFlags.map((pf, i) => {
                      const v = Number(dataSobraMes[i]) || 0;
                      const c = v < 0 ? sobraNegColor : sobraPosColor;
                      return pf ? colorWithAlpha(c, 0.58) : c;
                  }),
                  pointBorderColor: projectionFlags.map((pf, i) => {
                      const v = Number(dataSobraMes[i]) || 0;
                      const c = v < 0 ? sobraNegColor : sobraPosColor;
                      return pf ? colorWithAlpha(c, 0.82) : c;
                  }),
                  pointRadius: pointRadiusProj,
                  backgroundColor: lineFill(sobraPosColor),
                  fill: false,
                  tension: 0.35,
                  spanGaps: true
              }
          ];

    if (showSaldoTotalBar && dataSaldoTotal.length) {
        datasets.push({
            type: 'bar',
            label: 'Saldo em conta',
            data: dataSaldoTotal,
            yAxisID: 'y1',
            base: 0,
            order: 0,
            borderRadius: 6,
            borderSkipped: false,
            borderWidth: 0,
            backgroundColor: dataSaldoTotal.map((_, i) => barPaint(saldoTotalColor, i)),
            borderColor: dataSaldoTotal.map((_, i) => barPaint(saldoTotalColor, i))
        });
    }

    const flowValues = datasets
        .filter((ds) => ds && ds.yAxisID !== 'y1' && Array.isArray(ds.data))
        .flatMap((ds) => ds.data)
        .map((v) => (v == null || Number.isNaN(Number(v)) ? 0 : Number(v)));
    const minY = Math.min(0, ...flowValues);
    const maxYRaw = flowValues.length ? Math.max(...flowValues) : 0;
    const ySpan = maxYRaw - minY;
    const yPad = ySpan > 0 ? ySpan * 0.08 : Math.max(Math.abs(maxYRaw), Math.abs(minY), 1) * 0.08;
    const yMax = maxYRaw + yPad;

    const y1Axis =
        showSaldoTotalBar && dataSaldoTotal.length
            ? computeY1BoundsAlignedToYZero(minY, yMax, dataSaldoTotal)
            : null;

    financialProgressionChart = new Chart(canvas, {
        type: barMode ? 'bar' : 'line',
        data: {
            labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            onClick: (_evt, els) => {
                if (!els?.length) return;
                const idx = els[0]?.index;
                if (typeof idx !== 'number') return;
                applyDashboardPeriodFromChartMonth(months, idx);
            },
            onHover: (_evt, els) => {
                canvas.style.cursor = els?.length ? 'pointer' : 'default';
            },
            datasets: barMode
                ? {
                      bar: {
                          categoryPercentage: 0.72,
                          barPercentage: 0.85,
                          borderSkipped: false
                      }
                  }
                : undefined,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        color: tick,
                        boxWidth: 10,
                        boxHeight: 10,
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        font: { size: 11, weight: '600' }
                    }
                },
                tooltip: {
                    backgroundColor: isDarkTheme() ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
                    titleColor: tick,
                    bodyColor: tick,
                    footerColor: isDarkTheme() ? '#cbd5e1' : '#475569',
                    borderColor: isDarkTheme() ? 'rgba(148, 163, 184, 0.35)' : 'rgba(71, 85, 105, 0.18)',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 6,
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12 },
                    footerFont: { size: 11, weight: '600' },
                    callbacks: {
                        title: (tooltipItems) => {
                            if (!tooltipItems.length) return '';
                            const idx = tooltipItems[0].dataIndex;
                            const lbl = String(tooltipItems[0].chart.data.labels[idx] ?? '');
                            return projectionFlags[idx] ? `${lbl} · projeção` : lbl;
                        },
                        label: (ctx) => {
                            const v = ctx.parsed.y;
                            if (v == null || Number.isNaN(v)) return `${ctx.dataset.label}: —`;
                            return `${ctx.dataset.label}: ${formatCurrency(v, userCurrency)}`;
                        },
                        afterBody: () => [],
                        footer: () => ''
                    }
                }
            },
            scales: {
                x: {
                    stacked: areaMode,
                    ticks: {
                        color: (ctx) => {
                            const i = ctx.index;
                            const labelsArr = ctx.chart.data.labels;
                            if (i < 0 || i >= labelsArr.length) return tick;
                            if (emphasisMonthIdx >= 0 && i === emphasisMonthIdx) {
                                return isDarkTheme() ? '#f1f5f9' : '#0f172a';
                            }
                            if (projectionFlags[i]) return colorWithAlpha(tick, 0.72);
                            return colorWithAlpha(tick, 0.48);
                        },
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: true,
                        font: { size: 11, weight: '500' }
                    },
                    grid: { color: grid, display: true }
                },
                y: {
                    position: 'left',
                    min: minY,
                    max: yMax,
                    stacked: areaMode,
                    ticks: {
                        color: tick,
                        callback: (val) => formatCurrency(val, userCurrency)
                    },
                    grid: {
                        color: (ctx) => {
                            if (ctx.tick && Number(ctx.tick.value) === 0) {
                                return colorWithAlpha(tick, 0.42);
                            }
                            return grid;
                        },
                        lineWidth: (ctx) => {
                            if (ctx.tick && Number(ctx.tick.value) === 0) return 2;
                            return 1;
                        }
                    },
                    title: {
                        display: true,
                        text: 'Movimentação no mês',
                        color: colorWithAlpha(tick, 0.82),
                        font: { size: 11, weight: '600' }
                    }
                },
                ...(showSaldoTotalBar && dataSaldoTotal.length && y1Axis
                    ? {
                          y1: {
                              position: 'right',
                              min: y1Axis.min,
                              max: y1Axis.max,
                              grid: { display: false },
                              ticks: {
                                  color: colorWithAlpha(tick, 0.88),
                                  callback: (val) => {
                                      const n = Number(val);
                                      if (!Number.isFinite(n) || n < 0) return '';
                                      return formatCurrency(n, userCurrency);
                                  }
                              },
                              title: {
                                  display: true,
                                  text: 'Saldo em conta',
                                  color: colorWithAlpha(tick, 0.82),
                                  font: { size: 11, weight: '600' }
                              }
                          }
                      }
                    : {})
            }
        },
        plugins: [
            createCurrentMonthBandPlugin(barMode, emphasisMonthIdx, months.length),
            ...(!barMode ? [createFinancialPointValueLabelsPlugin(userCurrency, labels.length)] : [])
        ]
    });
}

export function refreshReportsChartsForTheme() {
    if (!lastReportsLoadArgs) return;
    void loadReportsData(...lastReportsLoadArgs);
}
