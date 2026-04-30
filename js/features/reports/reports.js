// js/reports.js
import { expenseContributionProjectedToMonthKey } from '../../core/expense-calendar-month.js';
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
    isLoanExpense,
    shouldDeferCashOutForMonthlyFixedSeries
} from '../../core/credit-installments.js';
import { getTotalInvestedSum } from '../investments/investments.js';
import {
    getDefaultPeriodValue,
    getPeriodDateBounds,
    getPeriodTitleParts
} from '../../core/period-filters.js';
import {
    enumerateCalendarMonths,
    isProjectionMonth,
    sumOutflowsProjectedForCalendarMonth,
    sumProjectedGainsForCalendarMonth
} from '../../core/projected-period-net.js';
import { fetchDashboardPeriodBalance } from '../../services/firestore.js';
import {
    applySplitNetToContribution,
    isAcceptedSettledSplitRequest,
    isSplitReimbursementGain
} from '../../core/split-net.js';
import { setMovementSummaryMomVariation } from '../../core/movement-summary-variation.js';
let financialProgressionChart = null;
let lastReportsLoadArgs = null;
let reportsListenersBound = false;
const ALL_CATEGORIES_FILTER_VALUE = '__all__';
/** Após o utilizador mudar o período do painel, cartões e gráfico partilham o filtro até recarregar a página. */
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
        if (lastReportsLoadArgs) void loadReportsData(...lastReportsLoadArgs);
    });

    syncChartTypeToggleUI('financialProgression');
}

function ensureReportsListeners() {
    if (reportsListenersBound) return;
    reportsListenersBound = true;
    ensureChartTypeTogglesBound();
    document.getElementById('period-filter')?.addEventListener('change', () => {
        markDashboardPeriodLinked();
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
    userProfile = null,
    expenseSplitRequests = null
) {
    ensureReportsListeners();
    lastReportsLoadArgs = [
        userExpenses,
        userGains,
        userAccounts,
        userCurrency,
        userInvestments,
        userProfile,
        expenseSplitRequests
    ];
    const outgoingAcceptedSplits = (expenseSplitRequests?.outgoing || []).filter((s) =>
        isAcceptedSettledSplitRequest(s)
    );
    const gainsForTotals = (userGains || []).filter((g) => !isSplitReimbursementGain(g));

    const periodFilter = document.getElementById('period-filter');
    if (!periodFilter) return;

    const now = new Date();
    const chartPeriod = periodFilter.value;
    const cardPeriod = isDashboardPeriodLinked() ? chartPeriod : getDefaultPeriodValue(now);

    const allExpensesForCategoryChart = mapExpensesToPeriodContributions(
        chartPeriod,
        userExpenses,
        userAccounts,
        now,
        userProfile,
        outgoingAcceptedSplits
    );
    const selectedCategory = refreshCategoryFilterOptions(allExpensesForCategoryChart);
    const categoryScopedExpenses = filterExpensesByCategory(userExpenses, selectedCategory);

    await updateDashboardCardsAndTitlesForPeriod(
        cardPeriod,
        userExpenses,
        gainsForTotals,
        userAccounts,
        userCurrency,
        userProfile,
        outgoingAcceptedSplits,
        { chartPeriodForTitles: chartPeriod }
    );

    renderUnifiedFinancialChart(
        chartPeriod,
        categoryScopedExpenses,
        gainsForTotals,
        userAccounts,
        userInvestments,
        userCurrency,
        userProfile,
        outgoingAcceptedSplits
    );

    const catSel = document.getElementById('category-filter');
    const dashFiltBtn = document.getElementById('dashboard-filter-open-btn');
    if (dashFiltBtn && catSel) {
        const v = catSel.value;
        dashFiltBtn.classList.toggle('filter-drawer-trigger--active', Boolean(v) && v !== '__all__');
    }
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

/** Limites do mês civil anterior ao de `selStart` (primeiro dia … último segundo). */
function dashboardPrevCalendarMonthBounds(selStart) {
    const prevStart = new Date(selStart.getFullYear(), selStart.getMonth() - 1, 1);
    const prevEnd = new Date(selStart.getFullYear(), selStart.getMonth(), 0, 23, 59, 59, 999);
    return { prevStart, prevEnd };
}

function sumOutflowsClosedRange(startDate, endDate, userExpenses, userAccounts, now, userProfile, splitRequests) {
    if (startDate > endDate) return 0;
    return enumerateCalendarMonths(startDate, endDate).reduce((sum, mo) => {
        const proj = isProjectionMonth(mo, now);
        return (
            sum +
            (proj
                ? sumOutflowsProjectedForCalendarMonth(
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
                      splitRequests
                  ))
        );
    }, 0);
}

/** Entradas − saídas no mês civil (`mo`), mesma regra de projeção de saídas do painel. */
function dashboardLiquidoMesCivil(mo, userGains, userExpenses, userAccounts, now, userProfile, splitRequests) {
    const g = sumMovementsInRange(userGains || [], mo.start, mo.end);
    const o = isProjectionMonth(mo, now)
        ? sumOutflowsProjectedForCalendarMonth(
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
              splitRequests
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
 * Contribuição "paga até a data" por vencimento (cartão/empréstimo):
 * - cartão: parcela conta se o vencimento <= cutoff
 * - empréstimo: parcela conta se o vencimento <= cutoff
 * - demais: conta se a data do lançamento <= cutoff
 *
 * Para totais do mês na UI, `cutoff` é o fim do mês civil (mês completo, inclusive pendente).
 * Não depende de confirmação manual de caixa.
 */
function expenseContributionPaidThroughToMonthKey(
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
            return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
        }

        if (nInst < 2) {
            // Compra à vista no cartão: considera no mês do vencimento da fatura (mesma regra do app)
            const dues = getInstallmentDueDates(purchase, 1, cd, dd);
            const due = dues[0] || purchase;
            if (monthKeyFromDate(due) !== monthKey) return 0;
            if (due.getTime() > cutoffT) return 0;
            return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
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
        return applySplitNetToContribution(t, monthKey, sum, splitRequests, forSplit);
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
        return applySplitNetToContribution(t, monthKey, sum, splitRequests, forSplit);
    }

    const purchasePlain = movementDateToJsDate(t.date);
    if (!Number.isNaN(purchasePlain.getTime()) && acc && shouldDeferCashOutForMonthlyFixedSeries(t, acc, userProfile)) {
        if (monthKeyFromDate(purchasePlain) !== monthKey) return 0;
        if (purchasePlain.getTime() > cutoffT) return 0;
        if (!expenseCountsAsCashOut(t, acc)) return 0;
        return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
    }

    // Demais contas: pela data do lançamento
    const d = movementDateToJsDate(t.date);
    if (Number.isNaN(d.getTime())) return 0;
    if (monthKeyFromDate(d) !== monthKey) return 0;
    if (d.getTime() > cutoffT) return 0;
    if (!expenseCountsAsCashOut(t, acc)) return 0;
    return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
}

/**
 * Converte despesas em "contribuições do período" para usar em agregações por categoria.
 * Meses passados / mês atual: mesma regra dos cards de saída (vencimentos/parcela «pago até» a data de corte).
 * Meses futuros no período: projeção por vencimento/parcelas (`expenseContributionProjectedToMonthKey`)
 * para o gráfico «Distribuição das saídas» mostrar saídas previstas (ex.: parcelas, recorrências).
 */
function mapExpensesToPeriodContributions(
    period,
    userExpenses,
    userAccounts,
    now,
    userProfile = null,
    splitRequests = null
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
                v = expenseContributionProjectedToMonthKey(
                    t,
                    acc,
                    mk,
                    now,
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
                    userExpenses
                );
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
    splitRequests = null
) {
    let { startDate, endDate } = getPeriodDateBounds(period, now);
    if (startDate > endDate) return 0;
    const months = enumerateCalendarMonths(startDate, endDate);
    return months.reduce((sum, mo) => {
        const proj = isProjectionMonth(mo, now);
        return (
            sum +
            (proj
                ? sumOutflowsProjectedForCalendarMonth(
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
                      splitRequests
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
    userGains,
    userAccounts,
    userCurrency,
    userProfile = null,
    splitRequests = null,
    { chartPeriodForTitles } = {}
) {
    const now = new Date();
    const parts = getPeriodTitleParts(period, now);
    const chartTitleParts = getPeriodTitleParts(chartPeriodForTitles ?? period, now);
    const isSingleMonth = /^month-\d+$/.test(period || '');
    const { startDate: dashStart, endDate: dashEnd } = getPeriodDateBounds(period, now);
    const prevBounds = isSingleMonth ? dashboardPrevCalendarMonthBounds(dashStart) : null;

    // Títulos dos cards (período dos cartões)
    if (parts.kind === 'year') {
        setTextIfExists('dashboard-balance-title', `Saldo de ${parts.label}`);
        setTextIfExists('monthly-expenses-title', `Saídas de ${parts.label}`);
        setTextIfExists('monthly-income-title', `Entradas de ${parts.label}`);
        setTextIfExists('dashboard-projection-title', `Projeção de ${parts.label}`);
    } else if (parts.kind === 'month') {
        setTextIfExists('dashboard-balance-title', `Saldo de ${parts.label}`);
        setTextIfExists('monthly-expenses-title', `Saídas de ${parts.label}`);
        setTextIfExists('monthly-income-title', `Entradas de ${parts.label}`);
        setTextIfExists('dashboard-projection-title', `Projeção de ${parts.label}`);
    } else {
        setTextIfExists('dashboard-balance-title', `Saldo · ${parts.label}`);
        setTextIfExists('monthly-expenses-title', `Saídas · ${parts.label}`);
        setTextIfExists('monthly-income-title', `Entradas · ${parts.label}`);
        setTextIfExists('dashboard-projection-title', `Projeção · ${parts.label}`);
    }
    setTextIfExists(
        'financial-progression-title',
        `Fluxo mensal (Entradas, Saídas e Saldo) · ${chartTitleParts.label}`
    );

    // Valores dos cards respondendo ao período do filtro
    const income = sumGainsForPeriod(period, userGains);
    const out = sumOutflowsForPeriod(period, userExpenses, userAccounts, now, userProfile, splitRequests);
    setTextIfExists('monthly-income', formatCurrency(income, userCurrency));
    setTextIfExists('monthly-expenses', formatCurrency(out, userCurrency));

    const incomePrev =
        prevBounds && prevBounds.prevStart <= prevBounds.prevEnd
            ? sumMovementsInRange(userGains || [], prevBounds.prevStart, prevBounds.prevEnd)
            : 0;
    const outPrev =
        prevBounds && prevBounds.prevStart <= prevBounds.prevEnd
            ? sumOutflowsClosedRange(
                  prevBounds.prevStart,
                  prevBounds.prevEnd,
                  userExpenses,
                  userAccounts,
                  now,
                  userProfile,
                  splitRequests
              )
            : 0;

    setMovementSummaryMomVariation(
        document.getElementById('monthly-income-variation'),
        income,
        incomePrev,
        isSingleMonth,
        false
    );
    setMovementSummaryMomVariation(
        document.getElementById('monthly-expenses-variation'),
        out,
        outPrev,
        isSingleMonth,
        true
    );

    // Fluxo líquido (entradas − saídas): meses futuros + mês corrente no filtro; mesma regra do gráfico «Sobra» / dataSobraMes.
    let dashNetProj = 0;
    let dashAnyProj = false;
    {
        let { startDate, endDate } = getPeriodDateBounds(period, now);
        if (startDate > endDate) {
            setTextIfExists('dashboard-projection-total', '—');
        } else {
            for (const mo of enumerateCalendarMonths(startDate, endDate)) {
                const useProj =
                    isProjectionMonth(mo, now) || isCurrentMonthObj(mo, now);
                if (!useProj) continue;
                dashAnyProj = true;
                const gains = sumMovementsInRange(userGains || [], mo.start, mo.end);
                const outflows = isProjectionMonth(mo, now)
                    ? sumOutflowsProjectedForCalendarMonth(
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
                          splitRequests
                      );
                dashNetProj += gains - outflows;
            }
            setTextIfExists(
                'dashboard-projection-total',
                dashAnyProj ? formatCurrency(dashNetProj, userCurrency) : '—'
            );
        }
    }

    const projVarEl = document.getElementById('dashboard-projection-variation');
    if (projVarEl) {
        if (!isSingleMonth) {
            setMovementSummaryMomVariation(projVarEl, 0, 0, false, false);
        } else if (!dashAnyProj || !prevBounds) {
            projVarEl.innerHTML =
                '<span class="card-metric-hint" title="Comparativo quando o card exibe fluxo líquido (mês atual ou futuro).">—</span>';
        } else {
            const selMonths = enumerateCalendarMonths(dashStart, dashEnd);
            const prevMonths = enumerateCalendarMonths(prevBounds.prevStart, prevBounds.prevEnd);
            const selMo = selMonths[0];
            const prevMo = prevMonths[0];
            if (selMo && prevMo) {
                const netCurr = dashboardLiquidoMesCivil(
                    selMo,
                    userGains,
                    userExpenses,
                    userAccounts,
                    now,
                    userProfile,
                    splitRequests
                );
                const netPrev = dashboardLiquidoMesCivil(
                    prevMo,
                    userGains,
                    userExpenses,
                    userAccounts,
                    now,
                    userProfile,
                    splitRequests
                );
                setMovementSummaryMomVariation(projVarEl, netCurr, netPrev, true, false);
            }
        }
    }

    // ── Card Saldo ─────────────────────────────────────────────────────────────
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
                        const inc = sumProjectedGainsForCalendarMonth(mo, userGains);
                        const outMo = sumOutflowsProjectedForCalendarMonth(
                            mo,
                            userExpenses,
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
            balVarEl.innerHTML =
                '<span class="card-metric-hint" title="Saldo indisponível para calcular a variação.">—</span>';
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

/** Faixa suave atrás do mês civil atual (modo colunas). */
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

function sumMovementsInRange(items, rangeStart, rangeEnd) {
    return (items || []).reduce((sum, t) => {
        const d = movementDateToJsDate(t.date);
        if (d >= rangeStart && d <= rangeEnd) return sum + (Number(t.amount) || 0);
        return sum;
    }, 0);
}

/**
 * Total de saídas no mês-calendário — mesma regra do card «Saídas do mês» e da lista:
 * parcelas/vencimentos com competência no mês, até o fim do mês civil (inclui ainda a vencer no mês).
 * {@link expenseContributionPaidThroughToMonthKey}
 */
function sumOutflowsForCalendarMonth(
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
        const cutoff = mo.end;
        sum += expenseContributionPaidThroughToMonthKey(
            t,
            acc,
            mk,
            cutoff,
            userProfile,
            splitRequests,
            userExpenses
        );
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
    userProfile = null,
    splitRequests = null
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
            ? sumOutflowsProjectedForCalendarMonth(
                  mo,
                  expenses,
                  userAccounts,
                  now,
                  userProfile,
                  splitRequests
              )
            : sumOutflowsForCalendarMonth(mo, expenses, userAccounts, now, userProfile, splitRequests)
    );
    const dataGanhos = months.map((mo) => sumMovementsInRange(gains, mo.start, mo.end));
    const dataInvest = investmentSeriesNoProjection(months, investedTotal);
    /** Sobra mensal: entradas do mês menos saídas (realizadas ou projetadas conforme o mês). */
    const dataSobraMes = months.map((_, i) => (dataGanhos[i] || 0) - (dataGastos[i] || 0));

    if (financialProgressionChart) financialProgressionChart.destroy();

    const { tick, grid } = getChartAxisColors();
    const ganhosColor = '#3b82f6';
    const gastosColor = '#fbbf24';
    const invColor = '#14b8a6';
    const sobraPosColor = '#10b981';
    const sobraNegColor = '#f43f5e';

    const currentMonthIdx = months.findIndex((mo) => isCurrentMonthObj(mo, now));

    const pointRadiusProj = projectionFlags.map((pf) => (pf ? 3 : 4));

    const finTypePref = getChartTypePreference('financialProgression');
    syncChartTypeToggleUI('financialProgression');
    const barMode = finTypePref === 'bar';
    const areaMode = finTypePref === 'area';

    const barMonthOpacity = (i) => {
        if (currentMonthIdx >= 0 && i === currentMonthIdx) return 1;
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

    const datasets = barMode
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
                  label: 'Saldo do mês',
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
                  label: 'Saldo do mês',
                  data: dataSobraMes,
                  yAxisID: 'y',
                  borderColor: sobraPosColor,
                  segment: {
                      borderColor: segmentBorderColorFactory(sobraPosColor, projectionFlags)
                  },
                  pointBackgroundColor: pointColorsForProjection(sobraPosColor, projectionFlags),
                  pointBorderColor: pointBorderColorsForProjection(sobraPosColor, projectionFlags),
                  pointRadius: pointRadiusProj,
                  backgroundColor: lineFill(sobraPosColor),
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
                            if (currentMonthIdx >= 0 && i === currentMonthIdx) {
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
                        display: false
                    }
                }
            }
        },
        plugins: [
            createCurrentMonthBandPlugin(barMode, currentMonthIdx, months.length),
            ...(!barMode ? [createFinancialPointValueLabelsPlugin(userCurrency, labels.length)] : [])
        ]
    });
}

export function refreshReportsChartsForTheme() {
    if (!lastReportsLoadArgs) return;
    void loadReportsData(...lastReportsLoadArgs);
}
