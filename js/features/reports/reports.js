// js/reports.js
import { expenseContributionToCalendarMonth } from '../../core/expense-calendar-month.js';
import {
    expenseCountsAsCashOut,
    formatCurrency,
    getChartAxisColors,
    isCreditCardType,
    isDarkTheme,
    movementDateToJsDate
} from '../../core/utils.js';
import {
    getCreditInstallmentMonthAllocationsIncludingFuture,
    getInstallmentDueDates,
    getLoanInstallmentDueDates,
    getLoanInstallmentMonthAllocationsIncludingFuture,
    isExpenseInstallmentDueCountedInCashFlow,
    isLoanExpense
} from '../../core/credit-installments.js';
import { getTotalInvestedSum } from '../investments/investments.js';
// Saldo total removido temporariamente (será reintroduzido futuramente com mais controle)

let reportsChart = null;
let financialProgressionChart = null;
let lastReportsLoadArgs = null;
let reportsListenersBound = false;

const REPORTS_CHART_PREF_KEY_EXPENSES = 'reports.chartType.expensesByCategory';
const REPORTS_CHART_PREF_KEY_FIN = 'reports.chartType.financialProgression';

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
    if (chartKey === 'expensesByCategory') {
        const v = safeLocalStorageGet(REPORTS_CHART_PREF_KEY_EXPENSES, 'bar');
        return v === 'pie' || v === 'bar' || v === 'treemap' ? v : 'bar';
    }
    if (chartKey === 'financialProgression') {
        const v = safeLocalStorageGet(REPORTS_CHART_PREF_KEY_FIN, 'line');
        // 'area' foi removido; se estiver salvo, volta para 'line'
        return v === 'line' || v === 'bar' ? v : 'line';
    }
    return '';
}

function setChartTypePreference(chartKey, type) {
    if (chartKey === 'expensesByCategory') {
        safeLocalStorageSet(REPORTS_CHART_PREF_KEY_EXPENSES, type);
    } else if (chartKey === 'financialProgression') {
        safeLocalStorageSet(REPORTS_CHART_PREF_KEY_FIN, type);
    }
}

function syncChartTypeToggleUI(chartKey) {
    const activeType = getChartTypePreference(chartKey);
    document.querySelectorAll(`.chart-type-btn[data-chart="${chartKey}"]`).forEach((btn) => {
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
        if (lastReportsLoadArgs) loadReportsData(...lastReportsLoadArgs);
    });

    syncChartTypeToggleUI('expensesByCategory');
    syncChartTypeToggleUI('financialProgression');
}

function ensureReportsListeners() {
    if (reportsListenersBound) return;
    reportsListenersBound = true;
    ensureChartTypeTogglesBound();
    document.getElementById('period-filter')?.addEventListener('change', () => {
        if (lastReportsLoadArgs) loadReportsData(...lastReportsLoadArgs);
    });
}

/**
 * Carrega e exibe os dados da página de relatórios.
 */
export function loadReportsData(
    userExpenses,
    userGains,
    userAccounts,
    userCurrency,
    userInvestments,
    userProfile = null
) {
    ensureReportsListeners();
    lastReportsLoadArgs = [userExpenses, userGains, userAccounts, userCurrency, userInvestments, userProfile];

    const periodFilter = document.getElementById('period-filter');
    if (!periodFilter) return;

    const selectedPeriod = periodFilter.value;
    const now = new Date();
    const filteredExpenses = filterExpensesByPeriod(selectedPeriod, userExpenses);
    // Para «Saídas por categoria», o período deve refletir a contribuição no mês (vencimentos)
    // — especialmente importante para cartão parcelado (mês passado não usa a data da compra).
    const expensesForCategoryChart = mapExpensesToPeriodContributions(
        selectedPeriod,
        userExpenses,
        userAccounts,
        now,
        userProfile
    );
    const expensesByCategory = aggregateExpensesByCategory(expensesForCategoryChart);

    updateDashboardCardsAndTitlesForPeriod(
        selectedPeriod,
        userExpenses,
        userGains,
        userAccounts,
        userCurrency,
        userProfile
    );

    if (Object.keys(expensesByCategory).length === 0) {
        showEmptyReportsState();
    } else {
        renderReportsChart(expensesForCategoryChart, userCurrency);
    }

    renderUnifiedFinancialChart(
        selectedPeriod,
        userExpenses,
        userGains,
        userAccounts,
        userInvestments,
        userCurrency,
        userProfile
    );
}

function monthKeyFromMonthObj(mo) {
    return `${mo.start.getFullYear()}-${String(mo.start.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeyFromDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isCurrentMonthObj(mo, now = new Date()) {
    return mo.start.getFullYear() === now.getFullYear() && mo.start.getMonth() === now.getMonth();
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
 * Contribuição "paga até a data" por vencimento (cartão/empréstimo):
 * - cartão: parcela conta se o vencimento <= cutoff
 * - empréstimo: parcela conta se o vencimento <= cutoff
 * - demais: conta se a data do lançamento <= cutoff
 *
 * Não depende de confirmações manuais de caixa (evita "zerar" em meses passados/ano).
 */
function expenseContributionPaidThroughToMonthKey(t, acc, monthKey, cutoffEndInclusive, userProfile = null) {
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
            if (!expenseCountsAsCashOut(t, acc)) return 0;
            return amt;
        }

        if (nInst < 2) {
            // Compra à vista no cartão: considera no mês do vencimento da fatura (mesma regra do app)
            const dues = getInstallmentDueDates(purchase, 1, cd, dd);
            const due = dues[0] || purchase;
            if (monthKeyFromDate(due) !== monthKey) return 0;
            if (due.getTime() > cutoffT) return 0;
            return amt;
        }

        const dues = getInstallmentDueDates(purchase, nInst, cd, dd);
        if (!dues.length) return 0;
        const per = amt / nInst;
        let sum = 0;
        for (const d of dues) {
            if (monthKeyFromDate(d) !== monthKey) continue;
            if (d.getTime() > cutoffT) continue;
            sum += per;
        }
        return sum;
    }

    // Empréstimo: vencimentos mensais
    if (isLoanExpense(t) && (!acc || !isCreditCardType(acc.type)) && nInst >= 2) {
        const purchase = movementDateToJsDate(t.date);
        if (Number.isNaN(purchase.getTime())) return 0;
        const dues = getLoanInstallmentDueDates(purchase, nInst);
        const per = amt / nInst;
        let sum = 0;
        for (const d of dues) {
            if (monthKeyFromDate(d) !== monthKey) continue;
            if (d.getTime() > cutoffT) continue;
            sum += per;
        }
        return sum;
    }

    // Demais contas: pela data do lançamento
    const d = movementDateToJsDate(t.date);
    if (Number.isNaN(d.getTime())) return 0;
    if (monthKeyFromDate(d) !== monthKey) return 0;
    if (d.getTime() > cutoffT) return 0;
    if (!expenseCountsAsCashOut(t, acc)) return 0;
    return amt;
}

function expenseContributionProjectedToMonthKey(t, acc, monthKey, now, userProfile = null) {
    const nInst = Math.max(1, parseInt(String(t.installmentCount ?? '1'), 10) || 1);
    if (acc && isCreditCardType(acc.type)) {
        const allocs = getCreditInstallmentMonthAllocationsIncludingFuture(t, acc, now, userProfile);
        return allocs[monthKey] || 0;
    }
    if (isLoanExpense(t) && (!acc || !isCreditCardType(acc.type)) && nInst >= 2) {
        const allocs = getLoanInstallmentMonthAllocationsIncludingFuture(t);
        return allocs[monthKey] || 0;
    }
    const d = movementDateToJsDate(t.date);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (mk !== monthKey) return 0;
    if (!expenseCountsAsCashOut(t, acc)) return 0;
    return Number(t.amount) || 0;
}

/**
 * Converte despesas em "contribuições do período" para usar em agregações por categoria.
 * Para meses encerrados, usa alocação projetada por vencimento (cartão/empréstimo); para o mês atual,
 * usa a contribuição real do mês (mesma regra do card «Saídas do mês»).
 */
function mapExpensesToPeriodContributions(period, userExpenses, userAccounts, now, userProfile = null) {
    const { startDate, endDate } = getPeriodDateBounds(period);
    const months = enumerateCalendarMonths(startDate, endDate);
    const accountsById = new Map((userAccounts || []).map((a) => [a.id, a]));
    const out = [];

    for (const mo of months) {
        // "Este ano": não incluir meses futuros (no card já limitamos; aqui limita também para não confundir o gráfico)
        if (period === 'current-year' && isProjectionMonth(mo, now)) continue;

        const mk = monthKeyFromMonthObj(mo);
        for (const t of userExpenses || []) {
            const acc = accountsById.get(t.accountId);
            const cutoff =
                period === 'current-year' && isCurrentMonthObj(mo, now) ? now : mo.end;
            const v =
                period === 'current-month'
                    ? expenseContributionToCalendarMonth(t, acc, mk, now, userProfile)
                    : expenseContributionPaidThroughToMonthKey(t, acc, mk, cutoff, userProfile);
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

function periodTitleParts(period, now = new Date()) {
    const mLong = (d) => d.toLocaleDateString('pt-BR', { month: 'long' });
    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

    if (period === 'current-year') {
        return { kind: 'year', label: String(now.getFullYear()) };
    }
    if (period === 'current-month') {
        return { kind: 'month', label: cap(mLong(now)) };
    }
    if (period === 'last-month') {
        const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return { kind: 'month', label: cap(mLong(d)) };
    }
    return { kind: 'range', label: 'Período selecionado' };
}

function setTextIfExists(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function sumOutflowsForPeriod(period, userExpenses, userAccounts, now, userProfile = null) {
    let { startDate, endDate } = getPeriodDateBounds(period);
    // Para "Este ano", o card deve refletir apenas o que já aconteceu até hoje (não o ano inteiro futuro).
    if (period === 'current-year') {
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }
    const months = enumerateCalendarMonths(startDate, endDate);
    return months.reduce((sum, mo) => {
        // `sumOutflowsForCalendarMonth` já aplica:
        // - mês atual: regra "caixa" do app
        // - meses encerrados: parcelas por vencimento (pago até o fim do mês), sem depender de confirmações manuais
        return sum + sumOutflowsForCalendarMonth(mo, userExpenses, userAccounts, now, userProfile);
    }, 0);
}

/** Soma de saídas marcadas como investimento (aportes), mesma regra de competência que o card «Saídas». */
function sumInvestmentOutflowsForPeriod(period, userExpenses, userAccounts, now, userProfile = null) {
    let { startDate, endDate } = getPeriodDateBounds(period);
    if (period === 'current-year') {
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }
    const months = enumerateCalendarMonths(startDate, endDate);
    return months.reduce(
        (sum, mo) =>
            sum + sumInvestmentOutflowsForCalendarMonth(mo, userExpenses, userAccounts, now, userProfile),
        0
    );
}

function sumGainsForPeriod(period, userGains) {
    let { startDate, endDate } = getPeriodDateBounds(period);
    if (period === 'current-year') {
        const now = new Date();
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }
    return sumMovementsInRange(userGains || [], startDate, endDate);
}

function updateDashboardCardsAndTitlesForPeriod(
    period,
    userExpenses,
    userGains,
    userAccounts,
    userCurrency,
    userProfile = null
) {
    const now = new Date();
    const parts = periodTitleParts(period, now);

    // Títulos dos cards e dos gráficos (período alinhado ao filtro)
    if (parts.kind === 'year') {
        setTextIfExists('monthly-expenses-title', `Saídas de ${parts.label}`);
        setTextIfExists('monthly-income-title', `Entradas de ${parts.label}`);
        setTextIfExists('dashboard-investments-title', `Aportes em investimentos de ${parts.label}`);
        setTextIfExists('reports-chart-title', `Distribuição das saídas · ${parts.label}`);
        setTextIfExists('financial-progression-title', `Fluxo mensal e patrimônio · ${parts.label}`);
    } else if (parts.kind === 'month') {
        setTextIfExists('monthly-expenses-title', `Saídas de ${parts.label}`);
        setTextIfExists('monthly-income-title', `Entradas de ${parts.label}`);
        setTextIfExists('dashboard-investments-title', `Aportes em investimentos de ${parts.label}`);
        setTextIfExists('reports-chart-title', `Distribuição das saídas · ${parts.label}`);
        setTextIfExists('financial-progression-title', `Fluxo mensal e patrimônio · ${parts.label}`);
    } else {
        setTextIfExists('monthly-expenses-title', `Saídas — ${parts.label}`);
        setTextIfExists('monthly-income-title', `Entradas — ${parts.label}`);
        setTextIfExists('dashboard-investments-title', `Aportes em investimentos — ${parts.label}`);
        setTextIfExists('reports-chart-title', `Distribuição das saídas — ${parts.label}`);
        setTextIfExists('financial-progression-title', `Fluxo mensal e patrimônio — ${parts.label}`);
    }

    // Valores dos cards respondendo ao período do filtro
    const income = sumGainsForPeriod(period, userGains);
    const out = sumOutflowsForPeriod(period, userExpenses, userAccounts, now, userProfile);
    const invAportes = sumInvestmentOutflowsForPeriod(period, userExpenses, userAccounts, now, userProfile);
    setTextIfExists('monthly-income', formatCurrency(income, userCurrency));
    setTextIfExists('monthly-expenses', formatCurrency(out, userCurrency));
    setTextIfExists('dashboard-investments-total', formatCurrency(invAportes, userCurrency));
}

function filterExpensesByPeriod(period, userExpenses) {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (period) {
        case 'current-month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'last-month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            break;
        case 'current-year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
            break;
    }

    return (userExpenses || []).filter((t) => {
        const transactionDate = movementDateToJsDate(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
    });
}

function aggregateExpensesByCategory(transactions) {
    const categories = {};
    transactions.forEach((t) => {
        const category = t.category || 'Sem Categoria';
        if (!categories[category]) categories[category] = 0;
        categories[category] += t.amount;
    });
    return categories;
}

function normalizePieDataFromCategoryTotals(expensesByCategory) {
    const entries = Object.entries(expensesByCategory || {}).map(([label, amount]) => ({
        label,
        amount: Number(amount) || 0
    }));
    entries.sort((a, b) => b.amount - a.amount);
    return {
        labels: entries.map((e) => e.label),
        data: entries.map((e) => e.amount)
    };
}

function buildTreemapTreeFromExpenses(filteredExpenses) {
    const rows = [];
    for (const t of filteredExpenses || []) {
        const cat = String(t.category || 'Sem Categoria').trim() || 'Sem Categoria';
        const sub =
            t.subcategory && String(t.subcategory).trim()
                ? String(t.subcategory).trim()
                : 'Sem subcategoria';
        const value = Number(t.amount) || 0;
        if (value <= 0) continue;
        rows.push({ category: cat, subcategory: sub, value });
    }
    return rows;
}

/**
 * Paleta dashboard (categorias): baixa saturação, harmônica — legível sem blocos chapados.
 * Varia por tema para contraste no fundo do card.
 */
function getReportsStackColors() {
    if (isDarkTheme()) {
        return [
            '#94A3C8', '#8AA0C8', '#82A8C4', '#78B0B8', '#88B898',
            '#A8B888', '#B8A888', '#C09898', '#B098C0', '#A098D0',
            '#88A8D8', '#80C0B8', '#B8B098', '#A890B0'
        ];
    }
    return [
        '#8E96AE', '#8492B0', '#7A9AAC', '#729E98', '#82A088',
        '#9AA078', '#A89478', '#A88888', '#9888A0', '#7C88B0',
        '#6C90B4', '#6898A4', '#8E9078', '#988898'
    ];
}

/**
 * Colunas empilhadas: uma coluna por categoria; cada segmento é uma subcategoria (ou "Sem subcategoria").
 */
function aggregateExpensesForStackedBarByCategory(transactions) {
    const byCat = new Map();
    for (const t of transactions || []) {
        const cat = t.category || 'Sem Categoria';
        const sub =
            t.subcategory && String(t.subcategory).trim()
                ? String(t.subcategory).trim()
                : 'Sem subcategoria';
        if (!byCat.has(cat)) byCat.set(cat, new Map());
        const m = byCat.get(cat);
        m.set(sub, (m.get(sub) || 0) + (Number(t.amount) || 0));
    }

    if (byCat.size === 0) {
        return { categoryLabels: [], datasets: [] };
    }

    const catTotals = [...byCat.entries()].map(([c, m]) => ({
        cat: c,
        total: [...m.values()].reduce((a, b) => a + b, 0)
    }));
    catTotals.sort((a, b) => b.total - a.total);
    const categoryLabels = catTotals.map((x) => x.cat);

    const subNameToCats = new Map();
    for (const cat of categoryLabels) {
        for (const sub of byCat.get(cat).keys()) {
            if (!subNameToCats.has(sub)) subNameToCats.set(sub, new Set());
            subNameToCats.get(sub).add(cat);
        }
    }
    const ambiguousSub = new Set();
    for (const [sub, cats] of subNameToCats) {
        if (cats.size > 1) ambiguousSub.add(sub);
    }

    const palette = getReportsStackColors();
    const barBorder = isDarkTheme() ? 'rgba(15, 23, 42, 0.22)' : 'rgba(255, 255, 255, 0.82)';
    const datasets = [];
    let colorIdx = 0;

    for (const cat of categoryLabels) {
        const subs = byCat.get(cat);
        const entries = [...subs.entries()].sort((a, b) => b[1] - a[1]);
        for (const [sub, amount] of entries) {
            const data = categoryLabels.map((c) => (c === cat ? amount : 0));
            const label = ambiguousSub.has(sub) ? `${cat} — ${sub}` : sub;
            datasets.push({
                label,
                data,
                backgroundColor: palette[colorIdx % palette.length],
                borderColor: barBorder,
                borderWidth: 1
            });
            colorIdx++;
        }
    }

    return { categoryLabels, datasets };
}

function renderReportsChart(filteredExpenses, userCurrency) {
    let reportsChartCanvas = document.getElementById('reports-chart');
    if (!reportsChartCanvas) {
        const chartWrapper = document.querySelector('#dashboard-reports-pie .chart-wrapper');
        if (chartWrapper) {
            chartWrapper.innerHTML = '<canvas id="reports-chart"></canvas>';
            reportsChartCanvas = document.getElementById('reports-chart');
        }
    }
    if (!reportsChartCanvas) return;

    const chartType = getChartTypePreference('expensesByCategory');
    syncChartTypeToggleUI('expensesByCategory');

    const expensesByCategory = aggregateExpensesByCategory(filteredExpenses);
    const { labels: pieLabels, data: pieData } = normalizePieDataFromCategoryTotals(expensesByCategory);
    const treemapTree = buildTreemapTreeFromExpenses(filteredExpenses);
    const { categoryLabels, datasets } = aggregateExpensesForStackedBarByCategory(filteredExpenses);
    const { tick, grid } = getChartAxisColors();
    const categoryPalette = getReportsStackColors();
    const pieSliceBorder = isDarkTheme() ? 'rgba(15, 23, 42, 0.35)' : 'rgba(255, 255, 255, 0.88)';

    if (reportsChart) reportsChart.destroy();

    if (chartType === 'bar' && (categoryLabels.length === 0 || datasets.length === 0)) return;
    if (chartType === 'pie' && pieData.length === 0) return;
    if (chartType === 'treemap' && treemapTree.length === 0) return;

    const categoryIndex = new Map();
    pieLabels.forEach((lab, idx) => categoryIndex.set(lab, idx));

    reportsChart = new Chart(reportsChartCanvas, {
        type: chartType === 'bar' ? 'bar' : chartType,
        data:
            chartType === 'bar'
                ? { labels: categoryLabels, datasets }
                : chartType === 'pie'
                  ? {
                        labels: pieLabels,
                        datasets: [
                            {
                                label: 'Saídas por categoria',
                                data: pieData,
                                backgroundColor: pieLabels.map(
                                    (_, i) => categoryPalette[i % categoryPalette.length]
                                ),
                                borderColor: pieSliceBorder,
                                borderWidth: 1
                            }
                        ]
                    }
                  : {
                        datasets: [
                            {
                                label: 'Saídas por categoria',
                                tree: treemapTree,
                                key: 'value',
                                groups: ['category', 'subcategory'],
                                spacing: 0.8,
                                borderWidth: 1,
                                borderColor: pieSliceBorder,
                                backgroundColor: (ctx) => {
                                    if (ctx.type !== 'data') return 'transparent';
                                    const raw = ctx.raw || {};
                                    const cat = raw?._data?.category || raw?.category;
                                    const i = categoryIndex.get(cat) ?? 0;
                                    return categoryPalette[i % categoryPalette.length];
                                }
                            }
                        ]
                    },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            datasets:
                chartType === 'bar'
                    ? {
                          bar: {
                              categoryPercentage: 0.65,
                              barPercentage: 0.92
                          }
                      }
                    : undefined,
            scales:
                chartType === 'bar'
                    ? {
                          x: {
                              stacked: true,
                              ticks: {
                                  color: tick,
                                  maxRotation: 45,
                                  minRotation: 0,
                                  autoSkip: true
                              },
                              grid: { color: grid }
                          },
                          y: {
                              stacked: true,
                              beginAtZero: true,
                              ticks: {
                                  color: tick,
                                  callback: (value) => formatCurrency(value, userCurrency)
                              },
                              grid: { color: grid }
                          }
                      }
                    : undefined,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: tick,
                        boxWidth: 10,
                        boxHeight: 10,
                        font: { size: 11 },
                        padding: 10,
                        usePointStyle: chartType !== 'bar'
                    }
                },
                tooltip: {
                    filter:
                        chartType === 'bar'
                            ? (item) => {
                                  const p = item.parsed;
                                  const y = typeof p === 'object' && p !== null ? p.y : p;
                                  return (Number(y) || 0) > 0;
                              }
                            : undefined,
                    callbacks: {
                        title: (items) => items[0]?.label || '',
                        label: (ctx) => {
                            const p = ctx.parsed;
                            const v = typeof p === 'object' && p !== null ? p.y : p;
                            if (chartType === 'treemap') {
                                const raw = ctx.raw || {};
                                const cat = raw?._data?.category || raw?.category || '—';
                                const sub = raw?._data?.subcategory || raw?.subcategory || '—';
                                const val = raw?.v ?? raw?.value ?? raw?._data?.value ?? v;
                                return `${cat} — ${sub}: ${formatCurrency(val, userCurrency)}`;
                            }
                            return `${ctx.dataset.label}: ${formatCurrency(v, userCurrency)}`;
                        }
                    }
                }
            }
        }
    });
}

function showEmptyReportsState() {
    if (reportsChart) reportsChart.destroy();
    const chartContainer = document.querySelector('#dashboard-reports-pie .chart-wrapper');
    if (chartContainer) {
        chartContainer.innerHTML = '<p class="empty-state">Nenhuma saída encontrada para o período.</p>';
    }
}

/** Limites do período (mesmo critério de `filterExpensesByPeriod`). */
function getPeriodDateBounds(period) {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (period) {
        case 'current-month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'last-month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            break;
        case 'current-year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
            break;
        case 'last-3-months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'last-6-months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    return { startDate, endDate };
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

/** Mês-calendário estritamente após o mês atual (projeção no gráfico de fluxo). */
function isProjectionMonth(mo, ref = new Date()) {
    const y = mo.start.getFullYear();
    const m = mo.start.getMonth();
    const ry = ref.getFullYear();
    const rm = ref.getMonth();
    return y > ry || (y === ry && m > rm);
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
        return proj ? colorWithAlpha(baseColor, 0.52) : baseColor;
    };
}

function pointColorsForProjection(baseColor, projectionFlags, alphaFill = 0.45) {
    return projectionFlags.map((pf) => (pf ? colorWithAlpha(baseColor, alphaFill) : baseColor));
}

function pointBorderColorsForProjection(baseColor, projectionFlags) {
    return projectionFlags.map((pf) => (pf ? colorWithAlpha(baseColor, 0.58) : baseColor));
}

/** Meses completos entre start e end (inclusive), para eixos do gráfico. */
function enumerateCalendarMonths(startDate, endDate) {
    const months = [];
    let y = startDate.getFullYear();
    let m = startDate.getMonth();
    const endY = endDate.getFullYear();
    const endM = endDate.getMonth();
    while (y < endY || (y === endY && m <= endM)) {
        const start = new Date(y, m, 1);
        const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
        const label = start.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        months.push({
            label: label.charAt(0).toUpperCase() + label.slice(1),
            start,
            end
        });
        m++;
        if (m > 11) {
            m = 0;
            y++;
        }
    }
    return months;
}

function sumMovementsInRange(items, rangeStart, rangeEnd) {
    return (items || []).reduce((sum, t) => {
        const d = movementDateToJsDate(t.date);
        if (d >= rangeStart && d <= rangeEnd) return sum + (Number(t.amount) || 0);
        return sum;
    }, 0);
}

/**
 * Total de saídas no mês-calendário — mesma regra do card «Saídas do mês» (dashboard) e do resumo da lista:
 * {@link expenseContributionToCalendarMonth} (cartão/empréstimo por vencimento efetivo no caixa; demais pela data).
 */
function sumOutflowsForCalendarMonth(mo, userExpenses, userAccounts, now, userProfile = null) {
    const accountsById = new Map((userAccounts || []).map((a) => [a.id, a]));
    const mk = `${mo.start.getFullYear()}-${String(mo.start.getMonth() + 1).padStart(2, '0')}`;
    let sum = 0;
    for (const t of userExpenses || []) {
        const acc = accountsById.get(t.accountId);
        const cutoff = isCurrentMonthObj(mo, now) ? now : mo.end;
        // Para o mês atual, mantém a regra "do caixa" que você disse estar correta.
        // Para meses encerrados, conta parcelas por vencimento (pago até o fim do mês).
        sum += isCurrentMonthObj(mo, now)
            ? expenseContributionToCalendarMonth(t, acc, mk, now, userProfile)
            : expenseContributionPaidThroughToMonthKey(t, acc, mk, cutoff, userProfile);
    }
    return sum;
}

function sumInvestmentOutflowsForCalendarMonth(mo, userExpenses, userAccounts, now, userProfile = null) {
    const accountsById = new Map((userAccounts || []).map((a) => [a.id, a]));
    const mk = `${mo.start.getFullYear()}-${String(mo.start.getMonth() + 1).padStart(2, '0')}`;
    let sum = 0;
    for (const t of userExpenses || []) {
        if (!t.isInvestment) continue;
        const acc = accountsById.get(t.accountId);
        const cutoff = isCurrentMonthObj(mo, now) ? now : mo.end;
        sum += isCurrentMonthObj(mo, now)
            ? expenseContributionToCalendarMonth(t, acc, mk, now, userProfile)
            : expenseContributionPaidThroughToMonthKey(t, acc, mk, cutoff, userProfile);
    }
    return sum;
}

/**
 * Saídas projetadas para o mês-calendário:
 * - cartão/empréstimo parcelado: parcelas por vencimento (inclui futuras)
 * - demais: pela data do lançamento
 *
 * Usado apenas na linha de «projeção de sobra», para não parecer que a sobra futura é igual às entradas
 * quando ainda não existem confirmações de parcelas/pagamentos.
 */
function sumOutflowsProjectedForCalendarMonth(mo, userExpenses, userAccounts, now, userProfile = null) {
    const accountsById = new Map((userAccounts || []).map((a) => [a.id, a]));
    const mk = `${mo.start.getFullYear()}-${String(mo.start.getMonth() + 1).padStart(2, '0')}`;
    const allocCache = new Map();

    let sum = 0;
    for (const t of userExpenses || []) {
        const acc = accountsById.get(t.accountId);
        const nInst = Math.max(1, parseInt(String(t.installmentCount ?? '1'), 10) || 1);
        if (acc && isCreditCardType(acc.type)) {
            const cacheKey = t.id || `${t.accountId}|${String(t.date)}|${t.amount}|${t.description || ''}`;
            if (!allocCache.has(cacheKey)) {
                allocCache.set(
                    cacheKey,
                    getCreditInstallmentMonthAllocationsIncludingFuture(t, acc, now, userProfile)
                );
            }
            const allocs = allocCache.get(cacheKey);
            sum += allocs[mk] || 0;
        } else if (isLoanExpense(t) && (!acc || !isCreditCardType(acc.type)) && nInst >= 2) {
            const cacheKey = t.id || `loan|${t.accountId}|${String(t.date)}|${t.amount}`;
            if (!allocCache.has(cacheKey)) {
                allocCache.set(cacheKey, getLoanInstallmentMonthAllocationsIncludingFuture(t));
            }
            const allocs = allocCache.get(cacheKey);
            sum += allocs[mk] || 0;
        } else {
            const d = movementDateToJsDate(t.date);
            if (d >= mo.start && d <= mo.end && expenseCountsAsCashOut(t, acc)) {
                sum += Number(t.amount) || 0;
            }
        }
    }
    return sum;
}

/**
 * Um gráfico: total gasto, total ganhos, investimento (posição atual) e saldo em contas (igual ao card Saldo total).
 */
function renderUnifiedFinancialChart(
    period,
    userExpenses,
    userGains,
    userAccounts,
    userInvestments,
    userCurrency,
    userProfile = null
) {
    const canvas = document.getElementById('financial-progression-chart');
    if (!canvas) return;

    const { startDate, endDate } = getPeriodDateBounds(period);
    const months = enumerateCalendarMonths(startDate, endDate);
    if (months.length === 0) return;

    const expenses = userExpenses || [];
    const gains = userGains || [];
    const investedTotal = getTotalInvestedSum(userInvestments);
    const now = new Date();

    const labels = months.map((mo) => mo.label);
    const projectionFlags = months.map((mo) => isProjectionMonth(mo, now));
    const dataGastos = months.map((mo) =>
        sumOutflowsForCalendarMonth(mo, expenses, userAccounts, now, userProfile)
    );
    const dataGastosProj = months.map((mo) =>
        sumOutflowsProjectedForCalendarMonth(mo, expenses, userAccounts, now, userProfile)
    );
    const dataGanhos = months.map((mo) => sumMovementsInRange(gains, mo.start, mo.end));
    const dataInvest = investmentSeriesNoProjection(months, investedTotal);
    /** Sobra mensal com base nos mesmos totais do gráfico: entradas previstas/registradas menos saídas previstas/registradas. */
    const dataSobraMes = months.map((_, i) =>
        (dataGanhos[i] || 0) - (projectionFlags[i] ? (dataGastosProj[i] || 0) : (dataGastos[i] || 0))
    );

    if (financialProgressionChart) financialProgressionChart.destroy();

    const { tick, grid } = getChartAxisColors();
    // Séries do fluxo: tons “dusty” (baixa saturação), distintos sem parecer material design neon
    const gastosColor = isDarkTheme() ? '#D4A3A3' : '#B07878';
    const ganhosColor = isDarkTheme() ? '#8FD4A8' : '#5F9B7A';
    const invColor = isDarkTheme() ? '#C4B5E8' : '#9588C4';
    const sobraColor = isDarkTheme() ? '#E8D48A' : '#C4A85C';

    const pointRadiusProj = projectionFlags.map((pf) => (pf ? 2 : 3));

    const finTypePref = getChartTypePreference('financialProgression');
    syncChartTypeToggleUI('financialProgression');
    const barMode = finTypePref === 'bar';
    const areaMode = finTypePref === 'area';

    const barFill = (hex) =>
        projectionFlags.map((pf) => (pf ? colorWithAlpha(hex, 0.34) : colorWithAlpha(hex, 0.68)));
    const lineFill = (hex) =>
        projectionFlags.map((pf) => (pf ? colorWithAlpha(hex, 0.14) : colorWithAlpha(hex, 0.32)));

    const datasets = barMode
        ? [
              {
                  type: 'bar',
                  label: 'Saídas',
                  data: dataGastos,
                  yAxisID: 'y',
                  backgroundColor: barFill(gastosColor),
                  borderColor: barFill(gastosColor),
                  borderWidth: 1,
                  borderRadius: 4,
                  order: 2
              },
              {
                  type: 'bar',
                  label: 'Entradas',
                  data: dataGanhos,
                  yAxisID: 'y',
                  backgroundColor: barFill(ganhosColor),
                  borderColor: barFill(ganhosColor),
                  borderWidth: 1,
                  borderRadius: 4,
                  order: 2
              },
              {
                  type: 'bar',
                  label: 'Projeção',
                  data: dataSobraMes,
                  yAxisID: 'y',
                  backgroundColor: barFill(sobraColor),
                  borderColor: barFill(sobraColor),
                  borderWidth: 1,
                  borderRadius: 4,
                  order: 2
              },
              // (Saldo total removido)
          ]
        : [
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
                  // Área empilhada: preencher a pilha (não o "origin"), senão parece só linha.
                  fill: areaMode ? 'stack' : false,
                  tension: 0.35,
                  spanGaps: true,
                  stack: areaMode ? 'main' : undefined
              },
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
                  label: 'Investimentos',
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
              // (Saldo total removido)
              {
                  label: 'Projeção',
                  data: dataSobraMes,
                  yAxisID: 'y',
                  borderColor: sobraColor,
                  segment: {
                      borderColor: segmentBorderColorFactory(sobraColor, projectionFlags)
                  },
                  pointBackgroundColor: pointColorsForProjection(sobraColor, projectionFlags),
                  pointBorderColor: pointBorderColorsForProjection(sobraColor, projectionFlags),
                  pointRadius: pointRadiusProj,
                  backgroundColor: lineFill(sobraColor),
                  // Mantém a sobra separada no eixo direito; não empilha com as demais.
                  fill: false,
                  tension: 0.35,
                  spanGaps: true
              }
          ];

    const minY = Math.min(
        0,
        ...datasets
            .filter((ds) => ds && ds.yAxisID === 'y')
            .flatMap((ds) => (Array.isArray(ds.data) ? ds.data : []))
            .map((v) => (v == null || Number.isNaN(Number(v)) ? 0 : Number(v)))
    );

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
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: tick,
                        boxWidth: 10,
                        boxHeight: 10,
                        padding: 14,
                        usePointStyle: true,
                        font: { size: 11 }
                    }
                },
                tooltip: {
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
                        footer: (tooltipItems) => {
                            if (!tooltipItems.length) return '';
                            const idx = tooltipItems[0].dataIndex;
                            if (!projectionFlags[idx]) return '';
                            return 'Projeção';
                        }
                    }
                }
            },
            scales: {
                x: {
                    // Área empilhada: empilha as séries no eixo principal
                    // Colunas agrupadas: NÃO empilha (clustered)
                    stacked: areaMode,
                    ticks: {
                        color: (ctx) => {
                            const i = ctx.index;
                            const labelsArr = ctx.chart.data.labels;
                            if (i < 0 || i >= labelsArr.length) return tick;
                            return projectionFlags[i] ? colorWithAlpha(tick, 0.55) : tick;
                        },
                        maxRotation: 45
                    },
                    grid: { color: grid }
                },
                y: {
                    position: 'left',
                    min: minY,
                    stacked: areaMode,
                    ticks: {
                        color: tick,
                        callback: (val) => formatCurrency(val, userCurrency)
                    },
                    grid: {
                        color: (ctx) => {
                            // Linha do zero: sólida, mais visível (mas discreta).
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
                        text: 'Valor (inclui negativos quando houver)',
                        color: tick,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

export function refreshReportsChartsForTheme() {
    if (!lastReportsLoadArgs) return;
    loadReportsData(...lastReportsLoadArgs);
}
