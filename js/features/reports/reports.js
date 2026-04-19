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
import { getPeriodDateBounds, getPeriodTitleParts } from '../../core/period-filters.js';
import {
    enumerateCalendarMonths,
    isProjectionMonth,
    sumOutflowsProjectedForCalendarMonth,
    sumProjectedGainsForCalendarMonth
} from '../../core/projected-period-net.js';
import { fetchDashboardPeriodBalance } from '../../services/firestore.js';
let reportsChart = null;
let financialProgressionChart = null;
let lastReportsLoadArgs = null;
let reportsListenersBound = false;
const ALL_CATEGORIES_FILTER_VALUE = '__all__';

/** Rótulos de total no topo das colunas empilhadas (uma categoria por coluna). */
function createStackedBarTotalsPlugin(userCurrency) {
    return {
        id: 'reportsStackedBarCategoryTotals',
        afterDatasetsDraw(chart) {
            if (chart.config.type !== 'bar') return;
            const xScale = chart.scales.x;
            const yScale = chart.scales.y;
            if (!xScale || !yScale) return;
            const { ctx, data } = chart;
            const labels = data.labels || [];
            if (!labels.length) return;

            const { tick } = getChartAxisColors();
            ctx.save();
            ctx.font = '600 11px system-ui, -apple-system, Segoe UI, sans-serif';
            ctx.fillStyle = tick;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            for (let i = 0; i < labels.length; i++) {
                let sum = 0;
                for (const ds of data.datasets) {
                    const v = ds.data[i];
                    if (v != null && !Number.isNaN(Number(v))) sum += Number(v);
                }
                if (sum <= 0) continue;
                const xPos = xScale.getPixelForTick(i);
                const yTop = yScale.getPixelForValue(sum);
                ctx.fillText(formatCurrency(sum, userCurrency), xPos, yTop - 5);
            }
            ctx.restore();
        }
    };
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

            ctx.save();
            ctx.font = '500 10px system-ui, -apple-system, Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            for (let di = 0; di < data.datasets.length; di++) {
                const ds = data.datasets[di];
                const meta = chart.getDatasetMeta(di);
                if (meta.hidden) continue;
                const color =
                    typeof ds.borderColor === 'string'
                        ? ds.borderColor
                        : Array.isArray(ds.borderColor)
                          ? ds.borderColor[0]
                          : tick;
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
        if (lastReportsLoadArgs) void loadReportsData(...lastReportsLoadArgs);
    });

    syncChartTypeToggleUI('expensesByCategory');
    syncChartTypeToggleUI('financialProgression');
}

function ensureReportsListeners() {
    if (reportsListenersBound) return;
    reportsListenersBound = true;
    ensureChartTypeTogglesBound();
    document.getElementById('period-filter')?.addEventListener('change', () => {
        if (lastReportsLoadArgs) void loadReportsData(...lastReportsLoadArgs);
    });
    document.getElementById('category-filter')?.addEventListener('change', () => {
        if (lastReportsLoadArgs) void loadReportsData(...lastReportsLoadArgs);
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
 * Carrega e exibe os dados da página de relatórios.
 */
export async function loadReportsData(
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
    const allExpensesForCategoryChart = mapExpensesToPeriodContributions(
        selectedPeriod,
        userExpenses,
        userAccounts,
        now,
        userProfile
    );
    const selectedCategory = refreshCategoryFilterOptions(allExpensesForCategoryChart);
    const categoryScopedExpenses = filterExpensesByCategory(userExpenses, selectedCategory);
    // Para «Saídas por categoria», o período deve refletir a contribuição no mês (vencimentos)
    // — especialmente importante para cartão parcelado (mês passado não usa a data da compra).
    const expensesForCategoryChart = mapExpensesToPeriodContributions(
        selectedPeriod,
        categoryScopedExpenses,
        userAccounts,
        now,
        userProfile
    );
    const expensesByCategory = aggregateExpensesByCategory(expensesForCategoryChart);

    await updateDashboardCardsAndTitlesForPeriod(
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
        renderReportsChart(expensesForCategoryChart, userCurrency, selectedCategory);
    }

    renderUnifiedFinancialChart(
        selectedPeriod,
        categoryScopedExpenses,
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
 * Meses passados / mês atual: mesma regra dos cards de saída (caixa ou «pago até»).
 * Meses futuros no período: projeção por vencimento/parcelas (`expenseContributionProjectedToMonthKey`)
 * para o gráfico «Distribuição das saídas» mostrar saídas previstas (ex.: parcelas, recorrências).
 */
function mapExpensesToPeriodContributions(period, userExpenses, userAccounts, now, userProfile = null) {
    const { startDate, endDate } = getPeriodDateBounds(period, now);
    const months = enumerateCalendarMonths(startDate, endDate);
    const accountsById = new Map((userAccounts || []).map((a) => [a.id, a]));
    const out = [];

    for (const mo of months) {
        const mk = monthKeyFromMonthObj(mo);
        const projection = isProjectionMonth(mo, now);

        for (const t of userExpenses || []) {
            const acc = accountsById.get(t.accountId);
            const cutoff = isCurrentMonthObj(mo, now) ? now : mo.end;

            let v;
            if (projection) {
                v = expenseContributionProjectedToMonthKey(t, acc, mk, now, userProfile);
            } else if (periodUsesCashCalendarMonthRule(period, mo, now)) {
                v = expenseContributionToCalendarMonth(t, acc, mk, now, userProfile);
            } else {
                v = expenseContributionPaidThroughToMonthKey(t, acc, mk, cutoff, userProfile);
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

/** Mesma regra que «este mês» no filtro antigo: competência no caixa só para o mês civil atual quando o recorte é um único mês (month-N) alinhado a hoje. */
function periodUsesCashCalendarMonthRule(period, mo, now = new Date()) {
    if (period === 'current-month') return isCurrentMonthObj(mo, now);
    const m = /^month-(\d+)$/.exec(period || '');
    if (!m) return false;
    const idx = parseInt(m[1], 10);
    return (
        isCurrentMonthObj(mo, now) &&
        mo.start.getFullYear() === now.getFullYear() &&
        mo.start.getMonth() === idx
    );
}

function setTextIfExists(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function sumOutflowsForPeriod(period, userExpenses, userAccounts, now, userProfile = null) {
    let { startDate, endDate } = getPeriodDateBounds(period, now);
    if (startDate > endDate) return 0;
    const months = enumerateCalendarMonths(startDate, endDate);
    return months.reduce((sum, mo) => {
        const proj = isProjectionMonth(mo, now);
        return (
            sum +
            (proj
                ? sumOutflowsProjectedForCalendarMonth(mo, userExpenses, userAccounts, now, userProfile)
                : sumOutflowsForCalendarMonth(mo, userExpenses, userAccounts, now, userProfile))
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
    userGains,
    userAccounts,
    userCurrency,
    userProfile = null
) {
    const now = new Date();
    const parts = getPeriodTitleParts(period, now);

    // Títulos dos cards e dos gráficos (período alinhado ao filtro)
    if (parts.kind === 'year') {
        setTextIfExists('dashboard-balance-title', `Saldo de ${parts.label}`);
        setTextIfExists('monthly-expenses-title', `Saídas de ${parts.label}`);
        setTextIfExists('monthly-income-title', `Entradas de ${parts.label}`);
        setTextIfExists('dashboard-projection-title', `Projeção de ${parts.label}`);
        setTextIfExists('reports-chart-title', `Distribuição das saídas de ${parts.label}`);
        setTextIfExists('financial-progression-title', `Fluxo mensal e patrimônio de ${parts.label}`);
    } else if (parts.kind === 'month') {
        setTextIfExists('dashboard-balance-title', `Saldo de ${parts.label}`);
        setTextIfExists('monthly-expenses-title', `Saídas de ${parts.label}`);
        setTextIfExists('monthly-income-title', `Entradas de ${parts.label}`);
        setTextIfExists('dashboard-projection-title', `Projeção de ${parts.label}`);
        setTextIfExists('reports-chart-title', `Distribuição das saídas de ${parts.label}`);
        setTextIfExists('financial-progression-title', `Fluxo mensal e patrimônio de ${parts.label}`);
    } else {
        setTextIfExists('dashboard-balance-title', `Saldo · ${parts.label}`);
        setTextIfExists('monthly-expenses-title', `Saídas · ${parts.label}`);
        setTextIfExists('monthly-income-title', `Entradas · ${parts.label}`);
        setTextIfExists('dashboard-projection-title', `Projeção · ${parts.label}`);
        setTextIfExists('reports-chart-title', `Distribuição das saídas de ${parts.label}`);
        setTextIfExists('financial-progression-title', `Fluxo mensal e patrimônio de ${parts.label}`);
    }

    // Valores dos cards respondendo ao período do filtro
    const income = sumGainsForPeriod(period, userGains);
    const out = sumOutflowsForPeriod(period, userExpenses, userAccounts, now, userProfile);
    setTextIfExists('monthly-income', formatCurrency(income, userCurrency));
    setTextIfExists('monthly-expenses', formatCurrency(out, userCurrency));

    // Fluxo líquido (entradas − saídas): meses futuros + mês corrente no filtro; mesma regra do gráfico «Sobra» / dataSobraMes.
    // Mês atual: entradas no intervalo + saídas com regra do caixa (`sumOutflowsForCalendarMonth`). Meses futuros: saídas projetadas.
    {
        let { startDate, endDate } = getPeriodDateBounds(period, now);
        if (startDate > endDate) {
            setTextIfExists('dashboard-projection-total', '—');
        } else {
            let netProj = 0;
            let anyProj = false;
            for (const mo of enumerateCalendarMonths(startDate, endDate)) {
                const useProj =
                    isProjectionMonth(mo, now) || isCurrentMonthObj(mo, now);
                if (!useProj) continue;
                anyProj = true;
                const gains = sumMovementsInRange(userGains || [], mo.start, mo.end);
                const outflows = isProjectionMonth(mo, now)
                    ? sumOutflowsProjectedForCalendarMonth(
                          mo,
                          userExpenses,
                          userAccounts,
                          now,
                          userProfile
                      )
                    : sumOutflowsForCalendarMonth(
                          mo,
                          userExpenses,
                          userAccounts,
                          now,
                          userProfile
                      );
                netProj += gains - outflows;
            }
            setTextIfExists(
                'dashboard-projection-total',
                anyProj ? formatCurrency(netProj, userCurrency) : '—'
            );
        }
    }

    // ── Card Saldo ─────────────────────────────────────────────────────────────
    // Meses passados / atual: saldo real do ledger (servidor).
    // Meses futuros: saldo de hoje (servidor) + Σ fluxo líquido projetado
    //   por mês civil, da mesma forma que os cards de Saídas/Entradas.
    try {
        const { startDate, endDate } = getPeriodDateBounds(period, now);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        if (endDate > endOfToday) {
            // Período ultrapassa hoje → busca saldo atual e projeta meses seguintes no cliente
            const baseBal = await fetchDashboardPeriodBalance(
                new Date(now.getFullYear(), now.getMonth(), 1), // 1º do mês atual
                endOfToday
            );
            if (baseBal != null) {
                // Projeta apenas meses ESTRITAMENTE após o mês atual
                const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                let projected = baseBal;
                if (endDate >= nextMonthStart) {
                    for (const mo of enumerateCalendarMonths(nextMonthStart, endDate)) {
                        const inc = sumProjectedGainsForCalendarMonth(mo, userGains);
                        const outMo = sumOutflowsProjectedForCalendarMonth(
                            mo, userExpenses, userAccounts, now, userProfile
                        );
                        projected += inc - outMo;
                    }
                }
                setTextIfExists('dashboard-balance-total', formatCurrency(projected, userCurrency));
            } else {
                setTextIfExists('dashboard-balance-total', '—');
            }
        } else {
            // Período passado ou mês atual → saldo real do ledger
            const bal = await fetchDashboardPeriodBalance(startDate, endDate);
            if (bal != null) setTextIfExists('dashboard-balance-total', formatCurrency(bal, userCurrency));
            else setTextIfExists('dashboard-balance-total', '—');
        }
    } catch {
        setTextIfExists('dashboard-balance-total', '—');
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

function aggregateExpensesByCategory(transactions) {
    const categories = {};
    transactions.forEach((t) => {
        const category = t.category || 'Sem Categoria';
        if (!categories[category]) categories[category] = 0;
        categories[category] += t.amount;
    });
    return categories;
}

function aggregateExpensesBySubcategory(transactions) {
    const subcategories = {};
    transactions.forEach((t) => {
        const subcategory =
            t.subcategory && String(t.subcategory).trim()
                ? String(t.subcategory).trim()
                : 'Sem subcategoria';
        if (!subcategories[subcategory]) subcategories[subcategory] = 0;
        subcategories[subcategory] += Number(t.amount) || 0;
    });
    return subcategories;
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

function buildTreemapTreeFromSubcategories(filteredExpenses) {
    const totals = aggregateExpensesBySubcategory(filteredExpenses);
    return Object.entries(totals)
        .map(([subcategory, value]) => ({ subcategory, value: Number(value) || 0 }))
        .filter((x) => x.value > 0);
}

/**
 * Paleta de categorias: tons distintos e saturados (bom contraste no card claro/escuro).
 */
function getReportsStackColors() {
    if (isDarkTheme()) {
        return [
            '#5C9EFF', '#FF7A7A', '#4ADE80', '#FBBF24', '#A78BFA',
            '#F472B6', '#22D3EE', '#FB923C', '#34D399', '#F87171',
            '#60A5FA', '#C084FC', '#FACC15', '#2DD4BF'
        ];
    }
    return [
        '#2563EB', '#DC2626', '#059669', '#D97706', '#7C3AED',
        '#DB2777', '#0891B2', '#EA580C', '#16A34A', '#B91C1C',
        '#1D4ED8', '#6D28D9', '#CA8A04', '#0D9488'
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
    const barBorder = isDarkTheme() ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.92)';
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

function aggregateExpensesForBarBySubcategory(transactions) {
    const totals = aggregateExpensesBySubcategory(transactions);
    const entries = Object.entries(totals)
        .map(([subcategory, amount]) => ({ subcategory, amount: Number(amount) || 0 }))
        .filter((x) => x.amount > 0)
        .sort((a, b) => b.amount - a.amount);
    const labels = entries.map((x) => x.subcategory);
    const palette = getReportsStackColors();
    const barBorder = isDarkTheme() ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.92)';
    return {
        labels,
        datasets: [
            {
                label: 'Saídas por subcategoria',
                data: entries.map((x) => x.amount),
                backgroundColor: labels.map((_, i) => palette[i % palette.length]),
                borderColor: barBorder,
                borderWidth: 1
            }
        ]
    };
}

function renderReportsChart(filteredExpenses, userCurrency, selectedCategory = ALL_CATEGORIES_FILTER_VALUE) {
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

    const categoryScopedMode =
        selectedCategory && selectedCategory !== ALL_CATEGORIES_FILTER_VALUE;
    const groupTotals = categoryScopedMode
        ? aggregateExpensesBySubcategory(filteredExpenses)
        : aggregateExpensesByCategory(filteredExpenses);
    const { labels: pieLabels, data: pieData } = normalizePieDataFromCategoryTotals(groupTotals);
    const treemapTree = categoryScopedMode
        ? buildTreemapTreeFromSubcategories(filteredExpenses)
        : buildTreemapTreeFromExpenses(filteredExpenses);
    const treemapTotal = treemapTree.reduce((s, r) => s + (Number(r.value) || 0), 0);
    const barChartData = categoryScopedMode
        ? aggregateExpensesForBarBySubcategory(filteredExpenses)
        : aggregateExpensesForStackedBarByCategory(filteredExpenses);
    const categoryLabels = barChartData.categoryLabels || barChartData.labels || [];
    const datasets = barChartData.datasets || [];
    const { tick, grid } = getChartAxisColors();
    const categoryPalette = getReportsStackColors();
    const pieSliceBorder = isDarkTheme() ? 'rgba(15, 23, 42, 0.55)' : 'rgba(255, 255, 255, 0.96)';
    /* chartjs-chart-treemap defaults captions/labels to black — illegible on dark UI and on saturated slices */
    const treemapTextColor = isDarkTheme() ? '#f1f5f9' : '#0f172a';
    const treemapTextHover = isDarkTheme() ? '#ffffff' : '#020617';

    if (reportsChart) reportsChart.destroy();

    if (chartType === 'bar' && (categoryLabels.length === 0 || datasets.length === 0)) return;
    if (chartType === 'pie' && pieData.length === 0) return;
    if (chartType === 'treemap' && treemapTree.length === 0) return;

    const groupIndex = new Map();
    pieLabels.forEach((lab, idx) => groupIndex.set(lab, idx));

    /* Barras: `index` faz sentido. Pizza/treemap: `index` faz o hover cair no fatia errada (e pior no toque). */
    const interactionOpts =
        chartType === 'bar'
            ? { mode: 'index', intersect: false }
            : { mode: 'nearest', intersect: false };

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
                                borderWidth: 1.5
                            }
                        ]
                    }
                  : {
                        datasets: [
                            {
                                label: 'Saídas por categoria',
                                tree: treemapTree,
                                key: 'value',
                                groups: categoryScopedMode ? ['subcategory'] : ['category', 'subcategory'],
                                spacing: 0.8,
                                borderWidth: 1.5,
                                borderColor: pieSliceBorder,
                                backgroundColor: (ctx) => {
                                    if (ctx.type !== 'data') return 'transparent';
                                    const raw = ctx.raw || {};
                                    const groupLabel = categoryScopedMode
                                        ? (raw?._data?.subcategory || raw?.subcategory)
                                        : (raw?._data?.category || raw?.category);
                                    const i = groupIndex.get(groupLabel) ?? 0;
                                    return categoryPalette[i % categoryPalette.length];
                                },
                                captions: {
                                    color: treemapTextColor,
                                    hoverColor: treemapTextHover
                                },
                                labels: {
                                    color: treemapTextColor,
                                    hoverColor: treemapTextHover
                                }
                            }
                        ]
                    },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: interactionOpts,
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
                              stacked: !categoryScopedMode,
                              ticks: {
                                  color: tick,
                                  maxRotation: 45,
                                  minRotation: 0,
                                  autoSkip: true
                              },
                              grid: { color: grid }
                          },
                          y: {
                              stacked: !categoryScopedMode,
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
                    align: 'center',
                    labels: {
                        color: tick,
                        boxWidth: chartType === 'pie' ? 14 : 12,
                        boxHeight: chartType === 'pie' ? 14 : 12,
                        font: { size: chartType === 'pie' ? 10 : 11, weight: chartType === 'pie' ? '500' : '400' },
                        padding: chartType === 'pie' ? 8 : 10,
                        usePointStyle: chartType !== 'bar',
                        ...(chartType === 'pie'
                            ? {
                                  generateLabels: (chart) => {
                                      const data = chart.data;
                                      const ds = data.datasets[0];
                                      const labels = data.labels || [];
                                      if (!ds || !labels.length) return [];
                                      const total = ds.data.reduce((a, b) => Number(a) + Number(b), 0);
                                      return labels.map((label, i) => ({
                                          text: `${label}: ${formatCurrency(ds.data[i], userCurrency)} · ${total > 0 ? ((Number(ds.data[i]) / total) * 100).toFixed(1) : '0'}%`,
                                          fillStyle: Array.isArray(ds.backgroundColor)
                                              ? ds.backgroundColor[i]
                                              : ds.backgroundColor,
                                          strokeStyle: ds.borderColor,
                                          lineWidth: typeof ds.borderWidth === 'number' ? ds.borderWidth : 1,
                                          fontColor: tick,
                                          hidden: !chart.getDataVisibility(i),
                                          index: i,
                                          datasetIndex: 0
                                      }));
                                  }
                              }
                            : {})
                    }
                },
                tooltip: {
                    position: chartType === 'bar' ? 'average' : 'nearest',
                    backgroundColor: isDarkTheme() ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
                    titleColor: tick,
                    bodyColor: tick,
                    footerColor: isDarkTheme() ? '#cbd5e1' : '#475569',
                    borderColor: isDarkTheme() ? 'rgba(148, 163, 184, 0.35)' : 'rgba(71, 85, 105, 0.18)',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 6,
                    displayColors: true,
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12 },
                    footerFont: { size: 11, weight: '600' },
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
                            if (chartType === 'pie') {
                                const v = ctx.dataset.data[ctx.dataIndex];
                                const total = ctx.dataset.data.reduce((a, b) => Number(a) + Number(b), 0);
                                const pct = total > 0 ? ((Number(v) / total) * 100).toFixed(1) : '0';
                                return `${formatCurrency(v, userCurrency)}  (${pct}% do total)`;
                            }
                            const p = ctx.parsed;
                            const v = typeof p === 'object' && p !== null ? p.y : p;
                            if (chartType === 'treemap') {
                                const raw = ctx.raw || {};
                                const sub = raw?._data?.subcategory || raw?.subcategory || '—';
                                const val = raw?.v ?? raw?.value ?? raw?._data?.value ?? v;
                                const pct =
                                    treemapTotal > 0
                                        ? ((Number(val) / treemapTotal) * 100).toFixed(1)
                                        : '0';
                                if (categoryScopedMode) {
                                    return `${sub}: ${formatCurrency(val, userCurrency)}  (${pct}% do período)`;
                                }
                                const cat = raw?._data?.category || raw?.category || '—';
                                return `${cat} — ${sub}: ${formatCurrency(val, userCurrency)}  (${pct}% do período)`;
                            }
                            return `${ctx.dataset.label}: ${formatCurrency(v, userCurrency)}`;
                        },
                        footer: (tooltipItems) => {
                            if (chartType !== 'bar' || !tooltipItems.length) return '';
                            let sum = 0;
                            for (const it of tooltipItems) {
                                const p = it.parsed;
                                const y = typeof p === 'object' && p !== null ? p.y : p;
                                sum += Number(y) || 0;
                            }
                            return categoryScopedMode
                                ? `Total na subcategoria: ${formatCurrency(sum, userCurrency)}`
                                : `Total na categoria: ${formatCurrency(sum, userCurrency)}`;
                        }
                    }
                }
            }
        },
        plugins: chartType === 'bar' ? [createStackedBarTotalsPlugin(userCurrency)] : []
    });
}

function showEmptyReportsState() {
    if (reportsChart) reportsChart.destroy();
    const chartContainer = document.querySelector('#dashboard-reports-pie .chart-wrapper');
    if (chartContainer) {
        chartContainer.innerHTML = '<p class="empty-state">Nenhuma saída encontrada para o período.</p>';
    }
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

    const now = new Date();
    let { startDate, endDate } = getPeriodDateBounds(period, now);
    if (startDate > endDate) return;
    const months = enumerateCalendarMonths(startDate, endDate);
    if (months.length === 0) return;

    const expenses = userExpenses || [];
    const gains = userGains || [];
    const investedTotal = getTotalInvestedSum(userInvestments);

    const labels = months.map((mo) => mo.label);
    const projectionFlags = months.map((mo) => isProjectionMonth(mo, now));
    const dataGastos = months.map((mo) =>
        isProjectionMonth(mo, now)
            ? sumOutflowsProjectedForCalendarMonth(mo, expenses, userAccounts, now, userProfile)
            : sumOutflowsForCalendarMonth(mo, expenses, userAccounts, now, userProfile)
    );
    const dataGanhos = months.map((mo) => sumMovementsInRange(gains, mo.start, mo.end));
    const dataInvest = investmentSeriesNoProjection(months, investedTotal);
    /** Sobra mensal: entradas do mês menos saídas (realizadas ou projetadas conforme o mês). */
    const dataSobraMes = months.map((_, i) => (dataGanhos[i] || 0) - (dataGastos[i] || 0));

    if (financialProgressionChart) financialProgressionChart.destroy();

    const { tick, grid } = getChartAxisColors();
    const gastosColor = isDarkTheme() ? '#FF7B7B' : '#DC2626';
    const ganhosColor = isDarkTheme() ? '#4ADE80' : '#059669';
    const invColor = isDarkTheme() ? '#C4B5FF' : '#7C3AED';
    const sobraColor = isDarkTheme() ? '#FBBF24' : '#D97706';

    const pointRadiusProj = projectionFlags.map((pf) => (pf ? 3 : 4));

    const finTypePref = getChartTypePreference('financialProgression');
    syncChartTypeToggleUI('financialProgression');
    const barMode = finTypePref === 'bar';
    const areaMode = finTypePref === 'area';

    const barFill = (hex) =>
        projectionFlags.map((pf) => (pf ? colorWithAlpha(hex, 0.5) : colorWithAlpha(hex, 0.9)));
    const lineFill = (hex) =>
        projectionFlags.map((pf) => (pf ? colorWithAlpha(hex, 0.24) : colorWithAlpha(hex, 0.45)));

    const datasets = barMode
        ? [
              {
                  type: 'bar',
                  label: 'Saídas',
                  data: dataGastos,
                  yAxisID: 'y',
                  backgroundColor: barFill(gastosColor),
                  borderColor: barFill(gastosColor),
                  borderWidth: 1.5,
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
                  borderWidth: 1.5,
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
                  borderWidth: 1.5,
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
                        boxWidth: 12,
                        boxHeight: 12,
                        padding: 14,
                        usePointStyle: true,
                        font: { size: 12, weight: '500' }
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
                            return projectionFlags[i] ? colorWithAlpha(tick, 0.72) : tick;
                        },
                        maxRotation: 45,
                        font: { size: 11, weight: '500' }
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
        },
        plugins: !barMode ? [createFinancialPointValueLabelsPlugin(userCurrency, labels.length)] : []
    });
}

export function refreshReportsChartsForTheme() {
    if (!lastReportsLoadArgs) return;
    void loadReportsData(...lastReportsLoadArgs);
}
