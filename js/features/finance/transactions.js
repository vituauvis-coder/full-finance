import {
    canConfirmInstallmentPeriodForCashOut,
    creditCardInvoiceTotalForCycle,
    getDueDatesForExpenseListPeriod,
    getParcelNumberInFullSchedule,
    formatExpenseTableStatusBadgeHtml,
    expenseTableBatchPaidToggleButton,
    formatInstallmentPillsHtml,
    formatInstallmentPopoverHtml,
    formatInstallmentRemainingSummaryHtml,
    formatInstallmentStatusPlain,
    getInstallmentDueDates,
    getCreditInstallmentIndexDueInMonthKey,
    getInstallmentState,
    getExpensePerInstallmentDisplayAmount,
    getLoanInstallmentDueDates,
    isCreditInstallmentFullyPaid,
    isInstallmentDuePaidForCashOut,
    isLoanExpense,
    isMonthlyFixedCashAccountExpense,
    loanInstallmentCashOutForCalendarMonth,
    shouldDeferCashOutForMonthlyFixedSeries
} from '../../core/credit-installments.js';
import {
    expenseContributionProjectedToMonthKey,
    expenseCreditInstallmentScheduledForMonthKey
} from '../../core/expense-calendar-month.js';
import {
    expenseCountsAsCashOut,
    formatCurrency,
    getBillingCycle,
    isCardAccountType,
    isCreditCardType,
    movementAccountPaymentKindLabel,
    movementDateToJsDate,
    movementDateToUnixSeconds
} from '../../core/utils.js';
import {
    applySplitNetToContribution,
    getNetExpenseTotalAmount,
    isAcceptedSettledSplitRequest,
    isSplitReimbursementGain,
    movementMonthKey,
    normalizeSplitScope,
    sumAcceptedSettledInstallmentSplitForExpenseMonth,
    sumAcceptedSettledInstallmentSplitTotalForExpense
} from '../../core/split-net.js';
import { setMovementSummaryMomVariation } from '../../core/movement-summary-variation.js';
import {
    EXPENSES_SUMMARY_COPY,
    GAINS_SUMMARY_COPY,
    expensesMonthTooltip,
    expensesCreditCardTooltip,
    expensesOtherTooltip,
    expensesSummaryTitles,
    gainsSummaryTitles,
    gainsTopCategoryTooltip,
    summaryFilterRequiredHintHtml
} from '../../core/movement-summary-copy.js';
import { setSummaryCardTooltip, setSummaryCardTitle } from '../../components/movement-summary-cards.js';
import {
    getDefaultPeriodValue,
    getMonthKeysInPeriod,
    getPeriodDateBounds,
    getPeriodTitleParts,
    isDefaultPeriodValue,
    syncPeriodFilterSelectsToCurrentMonth
} from '../../core/period-filters.js';
import { buildSyntheticExpectedSplitGainsRows } from '../../core/expected-split-gain-rows.js';
import {
    buildTreemapBlocksForDisplay,
    INCOME_TREEMAP_PALETTE,
    renderSpendingTreemapHost
} from '../../components/spending-treemap.js';
import { populateExpenseCategorySelect, populateExpenseSubcategorySelect, setupExpenseCategoryUi, getSubcategoriesForCategory } from './expense-categories.js';
import {
    populateGainCategorySelect,
    populateGainSubcategorySelect,
    setupGainCategoryUi,
    getGainSubcategoriesForCategory,
    listGainCategoryNamesSorted
} from './gain-categories.js';
import { setupFilterDrawer, closeFilterDrawer } from '../../shared/filter-drawer.js';
import { openModal, closeModal, showMessage, showToast, navigateTo } from '../../shell/app-shell.js';
import {
    saveExpense,
    saveGain,
    saveAccount,
    deleteAccount,
    deleteExpense,
    deleteGain,
    confirmExpenseCashOut,
    patchExpensesBatch,
    patchGainsBatch,
    createExpenseSplitRequest,
    acceptExpenseSplitRequest,
    rejectExpenseSplitRequest,
    cancelExpenseSplitRequest,
    fetchUsersForSplit
} from '../../services/firestore.js';
import { TablePaginationController } from '../../shared/table-pagination.js';
import {
    nextSortState,
    syncSortableTableHeaders,
    sortExpenseRows,
    sortGainRows,
    sortCardPurchaseRows
} from '../../shared/table-sort.js';
import {
    calendarDayKeyFromDate,
    isPeriodConfirmedForDebit,
    monthKeyFromDate,
    parseCashOutConfirmedPeriods
} from '../../core/finance-preferences.js';
import { expenseContributionPaidThroughListMonthKey as expenseContributionPaidThroughMonthKey } from '../../core/expense-list-month-contribution.js';
import {
    runWithButtonLoading,
    setButtonLoading,
    setFormSubmittingState
} from '../../core/button-loading.js';
import { playPingSound } from '../../core/ui-sounds.js';
import { computeCashBalanceTotalAsOf } from '../../core/cash-balance.js';

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
}

function htmlAttrEscape(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

/** Série mensal em conta de caixa + preferência de confirmação mensal — mesma lógica do saldo e do painel de pendentes. */
function expenseUsesMonthlyFixedCashListUi(t, account, userProfile) {
    if (!account) return false;
    return shouldDeferCashOutForMonthlyFixedSeries(t, account, userProfile);
}

function formatMonthlyFixedCashListStatusHtml(t, account, userProfile, now) {
    const d = movementDateToJsDate(t.date);
    const confirmed = parseCashOutConfirmedPeriods(t);
    if (isPeriodConfirmedForDebit(confirmed, d)) {
        const idE = htmlAttrEscape(String(t.id));
        return `<button type="button" class="expense-status-badge expense-status-badge--paid expense-paid-toggle" data-expense-id="${idE}" data-paid-toggle-mode="monthly-fixed-unconfirm" title="Clique para desfazer confirmação no caixa" aria-label="${htmlAttrEscape('Desfazer pagamento registado no caixa')}">Pago</button>`;
    }
    if (
        canConfirmInstallmentPeriodForCashOut(t, account, d, userProfile, now)
    ) {
        const eid = escapeHtml(String(t.id));
        const pkEsc = escapeHtml(monthKeyFromDate(d));
        return `<button type="button" class="expense-status-badge expense-status-badge--pay expense-inst-confirm-btn" data-expense-id="${eid}" data-period-key="${pkEsc}" title="Registrar pagamento no caixa">Pagar</button>`;
    }
    const eidP = escapeHtml(String(t.id));
    const pkPend = escapeHtml(monthKeyFromDate(d));
    return `<button type="button" class="expense-status-badge expense-status-badge--pending expense-inst-confirm-btn" data-expense-id="${eidP}" data-period-key="${pkPend}" title="Confirmar pagamento no caixa (abre confirmação)" aria-label="Confirmar pagamento no caixa para este mês">Pendente</button>`;
}

/** Tooltip do ↻ na coluna Valor — saídas (linha principal). */
function getExpenseRecurrenceBadgeMeta(t, account) {
    const n = Math.max(1, parseInt(String(t.installmentCount ?? '1'), 10) || 1);
    if (t.recurrenceGroupId) {
        return {
            show: true,
            title:
                'Série recorrente no ano: um lançamento por mês até dezembro, mantendo o dia do mês da data inicial.'
        };
    }
    if (account && isCreditCardType(account.type)) {
        if (n >= 2) {
            return {
                show: true,
                title: `Compra parcelada no cartão (${n}x): cada parcela entra na fatura conforme o ciclo de fechamento e vencimento; o caixa da conta vinculada segue essas datas.`
            };
        }
        return {
            show: true,
            title:
                'Compra no cartão (1x): o débito no caixa da conta vinculada ocorre na data de vencimento da fatura (e confirmações manuais, se estiverem ativas).'
        };
    }
    if (isLoanExpense(t) && (!account || !isCreditCardType(account.type))) {
        if (n >= 2) {
            return {
                show: true,
                title: `Empréstimo parcelado (${n}x): cada parcela reduz o saldo da conta de débito na data de vencimento.`
            };
        }
        return {
            show: true,
            title:
                'Empréstimo: o débito no saldo segue a data de vencimento (e confirmações manuais, se estiverem ativas).'
        };
    }
    return { show: false, title: '' };
}

function buildExpenseRecurrenceBadgeSpan(t, account) {
    const meta = getExpenseRecurrenceBadgeMeta(t, account);
    if (!meta.show) return '';
    return `<span class="gain-recurrence-badge" title="${htmlAttrEscape(meta.title)}">↻</span>`;
}

/** Linhas expandidas de parcela (cartão / empréstimo) na tabela. */
function buildExpenseInstallmentRowRecBadgeSpan(t) {
    const total = t.__instParcelTotal != null ? Number(t.__instParcelTotal) : 1;
    const idx = t.__instParcelIndex != null ? Number(t.__instParcelIndex) : 1;
    const title = t.__instEmptyPeriod
        ? 'Neste mês não há parcela com vencimento no período filtrado; o contrato segue nos demais meses.'
        : `Parcela ${idx} de ${total} deste contrato — valor desta competência (data de vencimento na coluna Data).`;
    return `<span class="gain-recurrence-badge" title="${htmlAttrEscape(title)}">↻</span>`;
}

function truncateDisplayHtml(text, max) {
    const raw = String(text ?? '');
    if (raw.length <= max) return escapeHtml(raw);
    return `${escapeHtml(raw.slice(0, Math.max(0, max - 1)))}…`;
}

/** Texto encurtado para células de tabela com tooltip do conteúdo completo. */
const TABLE_CELL_TRUNCATE_LIMIT = 40;
function buildTruncatedTableCellHtml(text, max = TABLE_CELL_TRUNCATE_LIMIT) {
    const raw = String(text ?? '');
    if (raw.length <= max) return escapeHtml(raw);
    const cut = `${raw.slice(0, max).trimEnd()}...`;
    return `<span class="table-cell-truncate" title="${htmlAttrEscape(raw)}">${escapeHtml(cut)}</span>`;
}

/** Chaves YYYY-MM-DD das parcelas marcadas como pagas no formulário (empréstimo ou cartão parcelado). */
function getLoanPaidPeriodKeysFromForm(form) {
    if (!form) return [];
    try {
        const raw = form.dataset.loanPaidPeriodKeys || '[]';
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.map((x) => String(x).trim()).filter(Boolean) : [];
    } catch {
        return [];
    }
}

function setLoanPaidPeriodKeysOnForm(form, keys) {
    if (!form) return;
    form.dataset.loanPaidPeriodKeys = JSON.stringify([...new Set(keys)]);
}

/** Rótulo tipo «jan. de 26» para a tag do mês da parcela. */
function formatLoanMonthTagLabel(d) {
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function buildLoanMonthTagsHtml(dueDates, paidKeys, now, useMonthPeriodKeys = false) {
    const paidSet = new Set(paidKeys);
    const nowMk = monthKeyFromDate(now);
    const parts = ['<div class="expense-loan-month-tags" role="group" aria-label="Parcelas no caixa">'];
    for (const d of dueDates) {
        const pk = useMonthPeriodKeys ? monthKeyFromDate(d) : calendarDayKeyFromDate(d);
        const isPaid =
            paidSet.has(pk) || (!useMonthPeriodKeys && paidSet.has(monthKeyFromDate(d)));
        const dueMk = monthKeyFromDate(d);
        const unpaidDueOrPast = !isPaid && dueMk <= nowMk;
        let cls = 'expense-loan-month-tag';
        if (isPaid) cls += ' expense-loan-month-tag--paid';
        else {
            cls += ' expense-loan-month-tag--pending';
            if (unpaidDueOrPast) cls += ' expense-loan-month-tag--current';
        }
        const lab = formatLoanMonthTagLabel(d);
        parts.push(
            `<button type="button" class="${cls}" data-period-key="${htmlAttrEscape(pk)}" title="Marcar ou desmarcar parcela de ${htmlAttrEscape(lab)}">${escapeHtml(lab)}</button>`
        );
    }
    parts.push('</div>');
    return parts.join('');
}

/** Posiciona o painel fixo no hover (evita corte por overflow da tabela). */
function setupInstallmentPopovers(scopeEl) {
    if (!scopeEl) return;
    scopeEl.querySelectorAll('.installment-ring-popover').forEach((pop) => {
        if (pop.dataset.tooltipBound) return;
        pop.dataset.tooltipBound = '1';
        const panel = pop.querySelector('.installment-tooltip-panel');
        if (!panel) return;
        let hideTimer = null;
        const place = () => {
            const r = pop.getBoundingClientRect();
            const pw = Math.min(380, Math.max(220, panel.offsetWidth || 280));
            let left = r.left + r.width / 2 - pw / 2;
            left = Math.max(10, Math.min(left, window.innerWidth - pw - 10));
            /* Sem folga entre anel e painel: o cursor não “cai no vácuo” e as tags continuam clicáveis */
            const top = r.top;
            panel.style.width = `${pw}px`;
            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
            panel.style.transform = 'translateY(-100%)';
        };
        const show = () => {
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            panel.classList.add('installment-tooltip-panel--visible');
            requestAnimationFrame(place);
        };
        const hide = () => panel.classList.remove('installment-tooltip-panel--visible');
        const scheduleHide = () => {
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(hide, 200);
        };
        pop.addEventListener('mouseenter', show);
        pop.addEventListener('mouseleave', scheduleHide);
        panel.addEventListener('mouseenter', () => {
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
        });
        panel.addEventListener('mouseleave', scheduleHide);
        pop.addEventListener('focus', show);
        pop.addEventListener('blur', hide);
    });
}

let currentUser;
let userAccounts;
let userExpenses;
let userGains;
let onUpdateCallback;
/** Moeda usada na última renderização da página de cartões (modal de compras). */
let lastCardsPageCurrency = 'BRL';

let expensesPagination = null;
let expensesRenderCache = { sorted: [], accounts: [], currency: 'BRL', userProfile: null };
let gainsPagination = null;
let gainsRenderCache = { sorted: [], accounts: [], currency: 'BRL' };
let cardPurchasesPagination = null;
let cardPurchasesCache = { sorted: [], currency: 'BRL', userProfile: null };
/** Texto do filtro do modal de compras (sincronizado com o input). */
let cardPurchasesFilterQ = '';

const expensesFilterState = {
    q: '',
    category: '',
    subcategory: '',
    paymentType: '',
    paymentStatus: /** @type {Set<'paid'|'unpaid'>} */ (new Set()),
    quickExpenseTypes: /** @type {Set<string>} */ (new Set()),
    description: '',
    amountMin: null,
    amountMax: null,
    dateFrom: '',
    dateTo: '',
    accountId: '',
    period: getDefaultPeriodValue()
};
const gainsFilterState = {
    q: '',
    category: '',
    subcategory: '',
    paymentType: '',
    paymentStatus: /** @type {Set<'paid'|'unpaid'>} */ (new Set()),
    description: '',
    amountMin: null,
    amountMax: null,
    dateFrom: '',
    dateTo: '',
    accountId: '',
    period: getDefaultPeriodValue()
};

/** Persistência das tags de status (Saídas / Entradas), alinhada ao painel. */
const PORTAL_QUICK_PAYMENT_STATUS_STORAGE = {
    expenses: 'portal.quickFilters.expenses.paymentStatus',
    gains: 'portal.quickFilters.gains.paymentStatus'
};

function hydratePortalExpensePaymentStatusFromStorage() {
    const paidEl = document.getElementById('expenses-filter-status-paid');
    const pendEl = document.getElementById('expenses-filter-status-pending');
    if (!paidEl || !pendEl) return;
    try {
        const raw = localStorage.getItem(PORTAL_QUICK_PAYMENT_STATUS_STORAGE.expenses);
        if (raw == null) {
            paidEl.checked = false;
            pendEl.checked = false;
            return;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        paidEl.checked = parsed.includes('paid');
        pendEl.checked = parsed.includes('unpaid');
    } catch {
        /* ignore */
    }
}

function persistPortalExpensePaymentStatusToStorage() {
    try {
        const keys = [];
        if (document.getElementById('expenses-filter-status-paid')?.checked) keys.push('paid');
        if (document.getElementById('expenses-filter-status-pending')?.checked) keys.push('unpaid');
        keys.sort();
        localStorage.setItem(PORTAL_QUICK_PAYMENT_STATUS_STORAGE.expenses, JSON.stringify(keys));
    } catch {
        /* ignore */
    }
}

function hydratePortalGainPaymentStatusFromStorage() {
    const recvEl = document.getElementById('gains-filter-status-received');
    const pendEl = document.getElementById('gains-filter-status-pending');
    if (!recvEl || !pendEl) return;
    try {
        const raw = localStorage.getItem(PORTAL_QUICK_PAYMENT_STATUS_STORAGE.gains);
        if (raw == null) {
            recvEl.checked = false;
            pendEl.checked = false;
            return;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        recvEl.checked = parsed.includes('paid');
        pendEl.checked = parsed.includes('unpaid');
    } catch {
        /* ignore */
    }
}

function persistPortalGainPaymentStatusToStorage() {
    try {
        const keys = [];
        if (document.getElementById('gains-filter-status-received')?.checked) keys.push('paid');
        if (document.getElementById('gains-filter-status-pending')?.checked) keys.push('unpaid');
        keys.sort();
        localStorage.setItem(PORTAL_QUICK_PAYMENT_STATUS_STORAGE.gains, JSON.stringify(keys));
    } catch {
        /* ignore */
    }
}

/** Mesmos intervalos do relatório por período — lista de saídas/entradas. */
function getMovementListPeriodBounds(period) {
    return getPeriodDateBounds(period || getDefaultPeriodValue(), new Date());
}

function movementDateInListPeriod(dateField, period) {
    const p = period || getDefaultPeriodValue();
    const { startDate, endDate } = getMovementListPeriodBounds(p);
    const transactionDate = movementDateToJsDate(dateField);
    return transactionDate >= startDate && transactionDate <= endDate;
}

/**
 * Período da lista de saídas:
 * — Cartão de crédito: só entra no mês em que há vencimento de parcela (fatura), não no mês da compra
 *   (ex.: compra 19/04 em 10x com 1ª parcela em maio não aparece em «abril»).
 * — Demais: data do lançamento no intervalo OU (empréstimo parcelado) vencimento no intervalo.
 */
function expenseMatchesListPeriod(t, period) {
    const n = Math.max(1, parseInt(String(t.installmentCount ?? '1'), 10) || 1);
    const { startDate, endDate } = getMovementListPeriodBounds(period);
    const acc = userAccounts?.find((a) => a.id === t.accountId);
    const purchase = movementDateToJsDate(t.date);
    if (Number.isNaN(purchase.getTime())) return false;

    if (acc && isCreditCardType(acc.type)) {
        const cd = acc.closeDay ?? acc.closingDay;
        const dd = acc.dueDay ?? acc.dueDate;
        const dueDates = getInstallmentDueDates(purchase, n, cd, dd);
        if (dueDates.length > 0) {
            return dueDates.some((d) => d >= startDate && d <= endDate);
        }
        return movementDateInListPeriod(t.date, period);
    }

    if (movementDateInListPeriod(t.date, period)) return true;

    if (!acc) return false;

    if (isLoanExpense(t) && !isCreditCardType(acc.type)) {
        if (n < 2) return false;
        const dueDates = getLoanInstallmentDueDates(purchase, n);
        return dueDates.some((d) => d >= startDate && d <= endDate);
    }

    return false;
}

/** Intervalo do filtro «Período» da lista de despesas — usado para mostrar só parcelas desse recorte. */
function getExpensesFilterListPeriod() {
    const period = expensesFilterState.period || getDefaultPeriodValue();
    const { startDate, endDate } = getMovementListPeriodBounds(period);
    return { startDate, endDate };
}

/** Só no mês civil atual (filtro padrão month-N = hoje): anel + tooltip com a parcela do mês. */
function isExpensesInstallmentMonthRingMode() {
    return isDefaultPeriodValue(expensesFilterState.period || getDefaultPeriodValue());
}

/**
 * Pílulas na lista: ano cheio = todas as parcelas do contrato (null);
 * demais períodos amplos = só vencimentos dentro do intervalo do filtro.
 */
function getExpensesInstallmentListPeriodForPills() {
    const period = expensesFilterState.period || getDefaultPeriodValue();
    if (period === 'current-year' || period === 'last-year') return null;
    return getExpensesFilterListPeriod();
}

/** Texto de busca alinhado à mesma lógica das pílulas / anel. */
function getExpensesInstallmentListPeriodForPlainText() {
    const period = expensesFilterState.period || getDefaultPeriodValue();
    if (period === 'current-year' || period === 'last-year') return null;
    return getExpensesFilterListPeriod();
}

/**
 * Fora de «este mês», cada parcela vira uma linha na tabela (data = vencimento).
 */
function expandInstallmentRowsForExpensesTable(list, accounts, userProfile) {
    if (isExpensesInstallmentMonthRingMode()) return list;
    const now = new Date();
    const listPeriodPills = getExpensesInstallmentListPeriodForPills();
    const out = [];
    for (const t of list) {
        const account = accounts.find((a) => a.id === t.accountId);
        const nParc = parseInt(String(t.installmentCount ?? ''), 10);
        const isMulti =
            (account && isCreditCardType(account.type) && Number.isFinite(nParc) && nParc >= 2) ||
            (isLoanExpense(t) &&
                (!account || !isCreditCardType(account.type)) &&
                Number.isFinite(nParc) &&
                nParc >= 2) ||
            (Number.isFinite(nParc) && nParc >= 2);
        if (!isMulti) {
            out.push(t);
            continue;
        }
        const dueDates = getDueDatesForExpenseListPeriod(t, account, now, userProfile, listPeriodPills);
        const totalAmt = Number(t.amount) || 0;
        const nFullTotal = Math.max(1, nParc);
        const per = totalAmt / nFullTotal;

        if (dueDates.length === 0) {
            out.push({
                ...t,
                __instRow: true,
                __instEmptyPeriod: true,
                __instSortDateUnix: movementDateToUnixSeconds(t.date),
                __instParcelAmount: per
            });
            continue;
        }
        for (const d of dueDates) {
            const idx = getParcelNumberInFullSchedule(t, account, d, now, userProfile);
            const paid = isInstallmentDuePaidForCashOut(t, account, d, userProfile, now);
            out.push({
                ...t,
                __instRow: true,
                __instDueDate: d,
                __instSortDateUnix: Math.floor(d.getTime() / 1000),
                __instParcelIndex: idx,
                __instParcelTotal: nFullTotal,
                __instParcelPaid: paid,
                __instPeriodKey: calendarDayKeyFromDate(d),
                __instParcelAmount: per
            });
        }
    }
    return out;
}

/** Na lista de saídas: sufixo « (4 de 12) » para compras parceladas no cartão (`installmentCount` ≥ 2). */
function expenseCreditInstallmentBracketSuffix(t, account, userProfile, now, listPeriod) {
    if (!t || !account || !isCreditCardType(account.type)) return '';
    const nTotal = Math.max(1, parseInt(String(t.installmentCount ?? '1'), 10) || 1);
    if (nTotal < 2) return '';
    const dues = getDueDatesForExpenseListPeriod(t, account, now, userProfile, listPeriod);
    if (!dues.length) return '';
    const idx = getParcelNumberInFullSchedule(t, account, dues[0], now, userProfile);
    if (!idx) return '';
    return ` (${idx} de ${nTotal})`;
}

let expensesFilterDebounce = null;
let gainsFilterDebounce = null;
let cardPurchasesFilterDebounce = null;
let tableFiltersListenersBound = false;

/** Modal de confirmação de parcela (lista de saídas): id + periodKey até confirmar. */
let pendingInstallmentCashOut = null;

/** Evita vários PATCH ao clicar depressa nas pílulas Essencial (mesmo id em várias linhas parcela). */
const expenseFixedTogglePendingIds = new Set();
/** Evita duplo clique no toggle Recebido/Pendente na tabela de entradas. */
const gainReceivedTogglePendingIds = new Set();

/** Evita cliques repetidos nas pílulas Pago/Pendente (PATCH/PUT até concluir). */
const expensePaidTogglePendingKeys = new Set();

/** Ordenação atual das tabelas (cabeçalhos clicáveis). */
let expensesSort = { key: 'date', dir: 'desc' };
let gainsSort = { key: 'date', dir: 'desc' };
let cardPurchasesSort = { key: 'date', dir: 'desc' };
let tableSortClicksBound = false;

/**
 * Inicializa despesas, ganhos, contas e cartões.
 */
/** Preferências do perfil (confirmação manual de caixa) — alinhado ao AppState após cada refresh. */
let financeUserProfile = null;

/** Solicitações de rateio (incoming/outgoing) — espelho do AppState. */
let userExpenseSplitRequests = { incoming: [], outgoing: [] };

function getOutgoingAcceptedSettledSplits() {
    return (userExpenseSplitRequests?.outgoing || []).filter((s) => isAcceptedSettledSplitRequest(s));
}

/** Mantém referências alinhadas ao AppState após cada refresh. */
export function syncFinanceState(
    accounts,
    expenses,
    gains,
    userProfile = undefined,
    expenseSplitRequests = undefined
) {
    userAccounts = accounts;
    userExpenses = expenses;
    userGains = gains;
    if (userProfile !== undefined) {
        financeUserProfile = userProfile ?? null;
    }
    if (expenseSplitRequests !== undefined) {
        userExpenseSplitRequests = expenseSplitRequests || { incoming: [], outgoing: [] };
    }
}

function canSplitExpenseClient(t) {
    if (!t) return false;
    return true;
}

function populateExpenseSplitCreditAccountSelect() {
    const sel = document.getElementById('expense-split-credit-account');
    if (!sel) return;
    const accounts = userAccounts || [];
    sel.innerHTML = '<option value="">Selecione</option>';
    accounts.forEach((a) => {
        const o = document.createElement('option');
        o.value = a.id;
        o.textContent = a.name || 'Conta';
        sel.appendChild(o);
    });
}

function getSplitScopeLabel(scope) {
    return normalizeSplitScope(scope) === 'INSTALLMENT' ? 'Parcela' : 'Lançamento';
}

function sumClientAllocatedSplitForTarget(expenseId, splitScope, targetInstallmentIndex = null) {
    const eid = String(expenseId ?? '');
    const scope = normalizeSplitScope(splitScope);
    return (userExpenseSplitRequests?.outgoing || [])
        .filter((s) => String(s.sourceExpenseId ?? s.sourceExpense?.id ?? '') === eid)
        .filter((s) => ['PENDING', 'ACCEPTED'].includes(String(s.status ?? '').toUpperCase()))
        .filter((s) => normalizeSplitScope(s.splitScope) === scope)
        .filter((s) =>
            scope === 'INSTALLMENT'
                ? Number(s.targetInstallmentIndex || 0) === Number(targetInstallmentIndex || 0)
                : true
        )
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
}

function syncExpenseSplitTargetUi(expense, preferredScope = null) {
    const scopeSel = document.getElementById('expense-split-scope');
    const instRow = document.getElementById('expense-split-installment-row');
    const instSel = document.getElementById('expense-split-installment-index');
    if (!scopeSel || !instRow || !instSel) return { scope: 'FULL_EXPENSE', installmentIndex: null };
    const n = Math.max(1, parseInt(String(expense?.installmentCount ?? '1'), 10) || 1);
    if (n < 2) {
        scopeSel.value = 'FULL_EXPENSE';
        scopeSel.disabled = true;
        instRow.classList.add('hidden');
        instSel.innerHTML = '<option value="">Selecione a parcela</option>';
        return { scope: 'FULL_EXPENSE', installmentIndex: null };
    }
    scopeSel.disabled = false;
    if (preferredScope) scopeSel.value = normalizeSplitScope(preferredScope);
    const useInst = normalizeSplitScope(scopeSel.value) === 'INSTALLMENT';
    instSel.innerHTML = '<option value="">Selecione a parcela</option>';
    for (let i = 1; i <= n; i++) {
        const o = document.createElement('option');
        o.value = String(i);
        o.textContent = `Parcela ${i}/${n}`;
        instSel.appendChild(o);
    }
    instRow.classList.toggle('hidden', !useInst);
    return {
        scope: useInst ? 'INSTALLMENT' : 'FULL_EXPENSE',
        installmentIndex: useInst ? parseInt(String(instSel.value || ''), 10) || null : null
    };
}

/** Contexto de valores do modal «Dividir saída» (alvo, restante, parcelas). */
function computeExpenseSplitFormMoneyContext() {
    const form = document.getElementById('expense-split-form');
    const sourceExpenseId = form?.['expense-split-source-id']?.value?.trim();
    const exp = sourceExpenseId ? userExpenses?.find((e) => String(e.id) === String(sourceExpenseId)) : null;
    if (!exp || !sourceExpenseId) return null;
    const scopeSel = document.getElementById('expense-split-scope');
    const instSel = document.getElementById('expense-split-installment-index');
    const scope = normalizeSplitScope(scopeSel?.value || 'FULL_EXPENSE');
    const total = Number(exp.amount) || 0;
    const n = Math.max(1, parseInt(String(exp.installmentCount ?? '1'), 10) || 1);
    const per = n >= 2 ? total / n : total;
    const targetMax = scope === 'INSTALLMENT' ? per : total;
    let instIdx = null;
    if (scope === 'INSTALLMENT') {
        instIdx = parseInt(String(instSel?.value || ''), 10);
        if (!Number.isFinite(instIdx)) instIdx = null;
    }
    const allocated =
        scope === 'INSTALLMENT' && !Number.isFinite(instIdx)
            ? 0
            : sumClientAllocatedSplitForTarget(sourceExpenseId, scope, instIdx);
    const remaining = Math.max(0.01, targetMax - allocated);
    return { exp, sourceExpenseId, scope, n, total, per, targetMax, allocated, remaining };
}

function isExpenseSplitPerInstallmentAmountMode() {
    const modeRow = document.getElementById('expense-split-amount-mode-row');
    const modeSel = document.getElementById('expense-split-amount-mode');
    if (!modeRow || modeRow.classList.contains('hidden') || !modeSel) return false;
    return modeSel.value === 'per_installment';
}

/** Atualiza modo total vs por parcela, limites e valor sugerido no modal de divisão. */
function refreshExpenseSplitAmountModeUi() {
    const ctx = computeExpenseSplitFormMoneyContext();
    const modeRow = document.getElementById('expense-split-amount-mode-row');
    const modeSel = document.getElementById('expense-split-amount-mode');
    const amtEl = document.getElementById('expense-split-amount');
    const amtLabel = document.querySelector('label[for="expense-split-amount"]');
    const hint = document.getElementById('expense-split-amount-mode-hint');
    if (!amtEl || !modeRow || !modeSel) return;
    const cur = expensesRenderCache.currency || 'BRL';
    if (!ctx) {
        modeRow.classList.add('hidden');
        if (amtLabel) amtLabel.textContent = 'Valor da parte';
        if (hint) hint.textContent = '';
        return;
    }
    const { scope, n, total, per, remaining } = ctx;
    if (scope === 'FULL_EXPENSE' && n >= 2) {
        modeRow.classList.remove('hidden');
        const perMode = isExpenseSplitPerInstallmentAmountMode();
        if (amtLabel) {
            amtLabel.textContent = perMode
                ? 'Valor da parte do outro em cada parcela'
                : 'Valor total da parte do outro';
        }
        if (hint) {
            hint.textContent = perMode
                ? `Compra em ${n} parcelas de ${formatCurrency(per, cur)}. Máximo ${formatCurrency(remaining / n, cur)} por parcela (até ${formatCurrency(remaining, cur)} no total neste alvo).`
                : `Máximo a repassar neste alvo: ${formatCurrency(remaining, cur)}.`;
        }
        if (perMode) {
            const maxPer = remaining / n;
            amtEl.max = String(Math.max(0.01, maxPer).toFixed(2));
            const defPer = Math.min(maxPer, per / 2);
            amtEl.value = String(Math.max(0.01, defPer).toFixed(2));
        } else {
            amtEl.max = String(remaining);
            amtEl.value = String(Math.min(remaining, Math.max(0.01, remaining / 2)).toFixed(2));
        }
    } else {
        modeRow.classList.add('hidden');
        if (amtLabel) amtLabel.textContent = 'Valor da parte';
        if (hint) hint.textContent = '';
        amtEl.max = String(remaining);
        amtEl.value = String(Math.min(remaining, Math.max(0.01, remaining / 2)).toFixed(2));
    }
}

function splitStatusLabel(st) {
    const u = String(st ?? '').toUpperCase();
    if (u === 'PENDING') return 'Pendente';
    if (u === 'ACCEPTED') return 'Aceita';
    if (u === 'REJECTED') return 'Recusada';
    if (u === 'CANCELLED') return 'Cancelada';
    return u || '—';
}

function splitStatusClass(st) {
    const u = String(st ?? '').toUpperCase();
    if (u === 'PENDING') return 'expense-split-status--pending';
    if (u === 'ACCEPTED') return 'expense-split-status--accepted';
    if (u === 'REJECTED') return 'expense-split-status--rejected';
    if (u === 'CANCELLED') return 'expense-split-status--cancelled';
    return '';
}

/** Lista divisões de saída já criadas para a despesa aberta no modal. */
function renderExpenseSplitModalList(expenseId) {
    const el = document.getElementById('expense-split-modal-existing');
    if (!el) return;
    const cur = expensesRenderCache.currency || 'BRL';
    const list = (userExpenseSplitRequests?.outgoing || [])
        .filter((s) => s && String(s.sourceExpenseId ?? s.sourceExpense?.id) === String(expenseId))
        .sort((a, b) => {
            const ta = new Date(a.createdAt ?? 0).getTime();
            const tb = new Date(b.createdAt ?? 0).getTime();
            return tb - ta;
        });
    if (!list.length) {
        el.innerHTML = `
            <div class="expense-split-modal-existing-empty">
                <strong>Divisões desta saída</strong><br>
                Nenhuma divisão associada a esta saída.
            </div>
        `;
        return;
    }
    const rows = list
        .map((s) => {
            const st = String(s.status ?? '').toUpperCase();
            const canRemove = st !== 'ACCEPTED';
            const name = s.recipient?.name || s.recipient?.email || 'Destinatário';
            const scope = getSplitScopeLabel(s.splitScope);
            const instTxt =
                normalizeSplitScope(s.splitScope) === 'INSTALLMENT' && s.targetInstallmentIndex
                    ? ` · ${escapeHtml(`Parcela ${s.targetInstallmentIndex}`)}`
                    : '';
            const removeCtrl = canRemove
                ? `<button type="button" class="btn-secondary expense-split-modal-remove-btn" data-split-id="${escapeHtml(String(s.id))}">Remover</button>`
                : `<span class="expense-split-modal-locked" title="Esta divisão já foi aceita e não pode ser removida."><i class="fas fa-lock" aria-hidden="true"></i></span>`;
            return `<div class="expense-split-modal-existing__row" data-split-id="${escapeHtml(String(s.id))}">
                <div class="expense-split-modal-existing__meta">
                    <span class="expense-split-status ${splitStatusClass(s.status)}">${escapeHtml(splitStatusLabel(s.status))}</span>
                    <strong>${escapeHtml(name)}</strong><span style="opacity:.85;"> · ${escapeHtml(formatCurrency(s.amount, cur))} · ${escapeHtml(scope)}${instTxt}</span>
                </div>
                ${removeCtrl}
            </div>`;
        })
        .join('');
    el.innerHTML = rows;
}

async function populateExpenseSplitRecipientSelect() {
    const sel = document.getElementById('expense-split-recipient-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">Carregando…</option>';
    sel.disabled = true;
    try {
        const data = await fetchUsersForSplit();
        const users = data?.users || [];
        sel.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent =
            users.length === 0 ? 'Nenhum outro usuário cadastrado' : 'Selecione um usuário';
        placeholder.disabled = users.length === 0;
        sel.appendChild(placeholder);
        users.forEach((u) => {
            const o = document.createElement('option');
            o.value = String(u.email || '').trim().toLowerCase();
            const name = String(u.name || '').trim();
            o.textContent = name ? `${name} — ${u.email}` : u.email;
            sel.appendChild(o);
        });
        sel.disabled = users.length === 0;
    } catch (err) {
        console.error(err);
        sel.innerHTML = '<option value="">Erro ao carregar usuários</option>';
        sel.disabled = true;
    }
}

async function openExpenseSplitModal(expenseId, options = null) {
    const exp = userExpenses?.find((e) => e.id === expenseId);
    if (!exp || !canSplitExpenseClient(exp)) {
        showToast('Não disponível', 'Esta saída não pode ser dividida (parcelada ou recorrente).', 'warning');
        return;
    }
    const hid = document.getElementById('expense-split-source-id');
    const sum = document.getElementById('expense-split-modal-summary');
    const form = document.getElementById('expense-split-form');
    if (!hid || !form) return;
    hid.value = expenseId;
    delete form.dataset.targetPeriodKey;
    const recSel = document.getElementById('expense-split-recipient-select');
    if (recSel) recSel.value = '';
    const scopeSel = document.getElementById('expense-split-scope');
    const instSel = document.getElementById('expense-split-installment-index');
    const total = Number(exp.amount) || 0;
    const desc = String(exp.description || '').trim() || 'Saída';
    const prefScope = options?.splitScope || null;
    const targetPeriodKey = options?.targetPeriodKey ? String(options.targetPeriodKey) : null;
    const targetInst = options?.targetInstallmentIndex
        ? parseInt(String(options.targetInstallmentIndex), 10)
        : null;
    if (targetPeriodKey) form.dataset.targetPeriodKey = targetPeriodKey;
    const splitUi = syncExpenseSplitTargetUi(exp, prefScope);
    if (instSel && targetInst && Number.isFinite(targetInst)) instSel.value = String(targetInst);
    const activeScope = normalizeSplitScope(scopeSel?.value || splitUi.scope);
    const perInstallment =
        Math.max(1, parseInt(String(exp.installmentCount ?? '1'), 10) || 1) >= 2
            ? total / Math.max(1, parseInt(String(exp.installmentCount ?? '1'), 10) || 1)
            : total;
    const targetMax = activeScope === 'INSTALLMENT' ? perInstallment : total;
    const allocated = sumClientAllocatedSplitForTarget(
        expenseId,
        activeScope,
        activeScope === 'INSTALLMENT' ? targetInst || instSel?.value : null
    );
    const remaining = Math.max(0.01, targetMax - allocated);
    if (sum) {
        const cur = expensesRenderCache.currency || 'BRL';
        const targetHint =
            activeScope === 'INSTALLMENT' && (targetInst || instSel?.value)
                ? ` · Parcela ${targetInst || instSel?.value}`
                : '';
        sum.innerHTML = `<strong>Saída original</strong><span>${escapeHtml(desc)}${escapeHtml(targetHint)} · ${escapeHtml(formatCurrency(total, cur))} · disponível para dividir: ${escapeHtml(formatCurrency(remaining, cur))}</span>`;
    }
    refreshExpenseSplitAmountModeUi();
    populateExpenseSplitCreditAccountSelect();
    await populateExpenseSplitRecipientSelect();
    renderExpenseSplitModalList(expenseId);
    openModal('expense-split-modal');
}

async function handleExpenseSplitFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const sourceExpenseId = form['expense-split-source-id']?.value?.trim();
    const recipientEmail = form['expense-split-recipient-select']?.value?.trim().toLowerCase();
    const ctxMoney = computeExpenseSplitFormMoneyContext();
    let amount = parseFloat(form['expense-split-amount']?.value);
    const requesterCreditAccountId = form['expense-split-credit-account']?.value?.trim();
    const splitScope = normalizeSplitScope(form['expense-split-scope']?.value || 'FULL_EXPENSE');
    const targetInstallmentIndex =
        splitScope === 'INSTALLMENT'
            ? parseInt(String(form['expense-split-installment-index']?.value || ''), 10) || null
            : null;
    const targetPeriodKey =
        splitScope === 'INSTALLMENT'
            ? String(form.dataset.targetPeriodKey || '').trim() || null
            : null;
    if (!sourceExpenseId || !recipientEmail || !Number.isFinite(amount) || amount <= 0) {
        showToast('Dados incompletos', 'Selecione o destinatário e o valor.', 'warning');
        return;
    }
    if (
        ctxMoney &&
        splitScope === 'FULL_EXPENSE' &&
        ctxMoney.n >= 2 &&
        isExpenseSplitPerInstallmentAmountMode()
    ) {
        amount *= ctxMoney.n;
    }
    if (ctxMoney && amount > ctxMoney.remaining + 0.005) {
        showToast(
            'Valor acima do permitido',
            `O máximo neste alvo é ${formatCurrency(ctxMoney.remaining, expensesRenderCache.currency || 'BRL')}.`,
            'warning'
        );
        return;
    }
    if (splitScope === 'INSTALLMENT' && !targetInstallmentIndex) {
        showToast('Parcela', 'Selecione a parcela alvo.', 'warning');
        return;
    }
    if (!requesterCreditAccountId) {
        showToast('Conta', 'Selecione a conta para receber o estorno.', 'warning');
        return;
    }
    setFormSubmittingState(form, true, 'Enviando solicitação...');
    try {
        const expForSeries = sourceExpenseId
            ? userExpenses?.find((e) => String(e.id) === String(sourceExpenseId))
            : null;
        const gidS = expForSeries?.recurrenceGroupId
            ? String(expForSeries.recurrenceGroupId).trim()
            : '';
        const sibLen = gidS
            ? (userExpenses || []).filter((x) => x && String(x.recurrenceGroupId || '') === gidS)
                  .length
            : 0;
        const nFromSeries = sibLen >= 2 ? Math.min(99, sibLen) : null;
        let nSrc = null;
        if (ctxMoney && ctxMoney.n >= 2) {
            nSrc = Math.min(99, Math.floor(Number(ctxMoney.n)));
        } else if (nFromSeries != null) {
            nSrc = nFromSeries;
        }
        await createExpenseSplitRequest({
            sourceExpenseId,
            recipientEmail,
            amount,
            requesterCreditAccountId,
            splitScope,
            targetInstallmentIndex,
            targetPeriodKey,
            ...(nSrc != null ? { sourceInstallmentCount: nSrc } : {})
        });
        showToast('Solicitação enviada', 'O outro usuário será notificado.', 'success');
        if (onUpdateCallback) await onUpdateCallback();
        renderExpenseSplitModalList(sourceExpenseId);
        const recSel = document.getElementById('expense-split-recipient-select');
        if (recSel) recSel.value = '';
        refreshExpenseSplitAmountModeUi();
    } catch (err) {
        console.error(err);
        showToast('Erro', err.message || 'Não foi possível enviar.', 'error');
    } finally {
        setFormSubmittingState(form, false);
    }
}

function renderOutgoingSplitsPanel(currency) {
    const panel = document.getElementById('expense-splits-outgoing-panel');
    if (!panel) return;
    const outgoing = userExpenseSplitRequests?.outgoing || [];
    const pending = outgoing.filter((s) => s && String(s.status).toUpperCase() === 'PENDING');
    if (!pending.length) {
        panel.classList.add('hidden');
        panel.innerHTML = '';
        return;
    }
    panel.classList.remove('hidden');
    const n = pending.length;
    const headIntro =
        n === 1
            ? 'A outra pessoa pode aceitar ou recusar no app. Você pode cancelar a qualquer momento antes da resposta.'
            : `${n} solicitações aguardando resposta. Cada destinatário pode aceitar ou recusar no app.`;
    const parts = [
        '<div class="expense-splits-panel__hero">',
        '  <div class="expense-splits-panel__hero-icon" aria-hidden="true"><i class="fas fa-paper-plane"></i></div>',
        '  <div class="expense-splits-panel__hero-text">',
        `    <h4 class="expense-splits-panel__title">${escapeHtml(n === 1 ? 'Divisão enviada' : 'Divisões enviadas')}</h4>`,
        `    <p class="expense-splits-panel__lead">${escapeHtml(headIntro)}</p>`,
        '  </div>',
        '</div>',
        '<ul class="expense-splits-panel__list" role="list">'
    ];
    pending.forEach((s) => {
        const name = s.recipient?.name || s.recipient?.email || 'Destinatário';
        const desc = s.sourceExpense?.description || 'Saída';
        const scopeTxt =
            normalizeSplitScope(s.splitScope) === 'INSTALLMENT' && s.targetInstallmentIndex
                ? ` · Parcela ${s.targetInstallmentIndex}`
                : '';
        const amt = escapeHtml(formatCurrency(s.amount, currency));
        parts.push(`<li class="expense-splits-panel__card" data-split-id="${escapeHtml(String(s.id))}">
            <div class="expense-splits-panel__card-body">
                <span class="expense-splits-panel__status-pill" title="Aguardando o outro usuário">Aguardando</span>
                <div class="expense-splits-panel__card-main">
                    <strong class="expense-splits-panel__who">${escapeHtml(name)}</strong>
                    <span class="expense-splits-panel__amount" aria-label="Valor da parte">${amt}</span>
                    <span class="expense-splits-panel__desc">${escapeHtml(`${desc}${scopeTxt}`)}</span>
                </div>
            </div>
            <button type="button" class="btn-secondary expense-splits-panel__cancel expense-split-cancel-btn" data-split-id="${escapeHtml(String(s.id))}">
                <i class="fas fa-times" aria-hidden="true"></i> Cancelar
            </button>
        </li>`);
    });
    parts.push('</ul>');
    panel.innerHTML = parts.join('');

    panel.querySelectorAll('.expense-split-cancel-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const sid = btn.dataset.splitId;
            if (!sid || !confirm('Remover esta solicitação de divisão?')) return;
            try {
                await runWithButtonLoading(
                    btn,
                    () => cancelExpenseSplitRequest(sid),
                    { busyLabel: 'Removendo...' }
                );
                showToast('Removido', 'A divisão foi excluída.', 'info');
                onUpdateCallback?.();
            } catch (err) {
                console.error(err);
                showToast('Erro', err.message || 'Falha ao cancelar.', 'error');
            }
        });
    });
}

function setupExpenseSplitUi() {
    document.getElementById('expense-split-form')?.addEventListener('submit', handleExpenseSplitFormSubmit);
    document.getElementById('expense-split-amount-mode')?.addEventListener('change', () => {
        refreshExpenseSplitAmountModeUi();
    });
    document.getElementById('expense-split-scope')?.addEventListener('change', () => {
        const form = document.getElementById('expense-split-form');
        const sourceExpenseId = form?.['expense-split-source-id']?.value?.trim();
        const exp = sourceExpenseId ? userExpenses?.find((e) => String(e.id) === String(sourceExpenseId)) : null;
        if (!exp) return;
        const scopeSel = document.getElementById('expense-split-scope');
        const instSel = document.getElementById('expense-split-installment-index');
        const splitUi = syncExpenseSplitTargetUi(exp, scopeSel?.value || 'FULL_EXPENSE');
        if (splitUi.scope === 'INSTALLMENT' && !form?.dataset?.targetPeriodKey) {
            const idx = parseInt(String(instSel?.value || ''), 10);
            if (Number.isFinite(idx)) {
                const d = movementDateToJsDate(exp.date);
                d.setMonth(d.getMonth() + Math.max(0, idx - 1));
                form.dataset.targetPeriodKey = monthKeyFromDateObj(d);
            }
        }
        refreshExpenseSplitAmountModeUi();
    });
    document.getElementById('expense-split-installment-index')?.addEventListener('change', () => {
        const form = document.getElementById('expense-split-form');
        const sourceExpenseId = form?.['expense-split-source-id']?.value?.trim();
        const exp = sourceExpenseId ? userExpenses?.find((e) => String(e.id) === String(sourceExpenseId)) : null;
        if (!exp || !form) return;
        const idx = parseInt(
            String(document.getElementById('expense-split-installment-index')?.value || ''),
            10
        );
        if (Number.isFinite(idx)) {
            const d = movementDateToJsDate(exp.date);
            d.setMonth(d.getMonth() + Math.max(0, idx - 1));
            form.dataset.targetPeriodKey = monthKeyFromDateObj(d);
            refreshExpenseSplitAmountModeUi();
        } else {
            delete form.dataset.targetPeriodKey;
            refreshExpenseSplitAmountModeUi();
        }
    });
    document.querySelectorAll('[data-close-modal="expense-split-modal"]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal('expense-split-modal'));
    });
    document.querySelectorAll('[data-close-modal="split-incoming-login-modal"]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal('split-incoming-login-modal'));
    });
    document.getElementById('expense-split-modal-existing')?.addEventListener('click', async (e) => {
        const btn = e.target.closest('.expense-split-modal-remove-btn');
        if (!btn) return;
        const sid = btn.dataset.splitId;
        if (!sid || !confirm('Remover esta divisão? Só é permitido se ainda não foi aceita.')) return;
        try {
            await runWithButtonLoading(
                btn,
                () => cancelExpenseSplitRequest(sid),
                { busyLabel: 'Removendo...' }
            );
            showToast(
                'Divisão removida',
                'Se não houver divisões aceitas, você poderá excluir a saída.',
                'success'
            );
            if (onUpdateCallback) await onUpdateCallback();
            const hid = document.getElementById('expense-split-source-id')?.value?.trim();
            if (hid) renderExpenseSplitModalList(hid);
        } catch (err) {
            console.error(err);
            showToast('Erro', err?.message || 'Não foi possível remover.', 'error');
        }
    });
}

/** Após login: modal com divisões pendentes para o destinatário. */
export function showPendingSplitsLoginModal() {
    const pending = (userExpenseSplitRequests.incoming || []).filter(
        (s) => s && String(s.status).toUpperCase() === 'PENDING'
    );
    const listEl = document.getElementById('split-incoming-login-list');
    if (!pending.length || !listEl) return;

    const currency = expensesRenderCache.currency || 'BRL';
    listEl.innerHTML = pending
        .map((s) => {
            const reqName = s.requester?.name || s.requester?.email || 'Solicitante';
            const desc = s.sourceExpense?.description || 'Compra';
            const amt = formatCurrency(s.amount, currency);
            return `<li class="split-incoming-login-item" data-split-id="${escapeHtml(String(s.id))}">
                <div style="flex:1;min-width:200px;">
                    <strong>${escapeHtml(reqName)}</strong> pediu para dividir <strong>${amt}</strong>
                    <br><small>${escapeHtml(desc)}</small>
                </div>
                <button type="button" class="btn-primary split-incoming-accept-btn" data-split-id="${escapeHtml(String(s.id))}">Aceitar</button>
                <button type="button" class="btn-secondary split-incoming-reject-btn" data-split-id="${escapeHtml(String(s.id))}">Recusar</button>
            </li>`;
        })
        .join('');

    listEl.querySelectorAll('.split-incoming-accept-btn').forEach((btn) => {
        btn.addEventListener('click', () => handleSplitIncomingAccept(btn.dataset.splitId));
    });
    listEl.querySelectorAll('.split-incoming-reject-btn').forEach((btn) => {
        btn.addEventListener('click', () => handleSplitIncomingReject(btn.dataset.splitId, btn));
    });

    openModal('split-incoming-login-modal');
}

async function handleSplitIncomingAccept(splitId) {
    if (!splitId) return;
    try {
        closeModal('split-incoming-login-modal');
        const pending = (userExpenseSplitRequests.incoming || []).find((s) => String(s?.id) === String(splitId));
        const sid = pending?.id || splitId;
        const amt = pending?.amount;
        const src = pending?.sourceExpense;
        if (sid != null && amt != null) {
            navigateTo('expenses');
            const rawIc =
                pending?.sourceInstallmentCount ??
                src?.recurrenceSeriesLength ??
                src?.installmentCount ??
                src?.installment_count;
            const parsedIc = parseInt(String(rawIc ?? ''), 10);
            openExpenseModal(false, {
                splitRequestId: sid,
                splitAmount: Number(amt),
                splitScope: pending?.splitScope,
                sourceExpense: src,
                sourceInstallmentCount: Number.isFinite(parsedIc) && parsedIc >= 2 ? parsedIc : undefined
            });
            showToast(
                'Confirme para aceitar',
                'Preencha e salve sua saída para concluir o aceite e gerar o estorno.',
                'info'
            );
        } else {
            showToast('Erro', 'Não foi possível abrir sua parte da divisão.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro', err.message || 'Não foi possível abrir a divisão.', 'error');
    }
}

async function handleSplitIncomingReject(splitId, btn = null) {
    if (!splitId || !confirm('Recusar esta divisão?')) return;
    try {
        if (btn) {
            await runWithButtonLoading(
                btn,
                () => rejectExpenseSplitRequest(splitId),
                { busyLabel: 'Recusando...' }
            );
        } else {
            await rejectExpenseSplitRequest(splitId);
        }
        showToast('Recusado', 'O solicitante foi notificado pelo status.', 'info');
        closeModal('split-incoming-login-modal');
        onUpdateCallback?.();
    } catch (err) {
        console.error(err);
        showToast('Erro', err.message || 'Falha ao recusar.', 'error');
    }
}

/** Hoje no fuso local (`YYYY-MM-DD`) para `<input type="date">` — evita deslocar o dia com `toISOString()` (UTC). */
function getTodayDateInputValue() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** HTML completo de `#account-type` (todas as contas); preenchido no init. */
let cachedAccountTypeOptionsFull = '';

function cacheAccountTypeOptionsIfNeeded() {
    const sel = document.getElementById('account-type');
    if (sel && !cachedAccountTypeOptionsFull) {
        cachedAccountTypeOptionsFull = sel.innerHTML;
    }
}

/** No cadastro de cartão só Crédito / Débito; em contas normais, lista completa; na Carteira (wizard) só contas não-cartão. */
function setAccountTypeSelectMode(mode) {
    cacheAccountTypeOptionsIfNeeded();
    const sel = document.getElementById('account-type');
    if (!sel || !cachedAccountTypeOptionsFull) return;
    const typeLabel = document.querySelector('label[for="account-type"]');
    const typeGroup = document.getElementById('account-type-group');
    if (mode === 'cardsOnly') {
        sel.innerHTML = `
            <option value="cartao_credito">Cartão de crédito</option>
            <option value="cartao_debito">Cartão de débito</option>
        `;
        if (typeLabel) typeLabel.textContent = 'Tipo de cartão';
        typeGroup?.classList.add('account-type-group--full-width');
    } else if (mode === 'bankOnly') {
        const tmp = document.createElement('select');
        tmp.innerHTML = cachedAccountTypeOptionsFull;
        sel.innerHTML = '';
        Array.from(tmp.options).forEach((opt) => {
            if (opt.value !== 'cartao_credito' && opt.value !== 'cartao_debito') {
                sel.appendChild(opt.cloneNode(true));
            }
        });
        if (typeLabel) typeLabel.textContent = 'Tipo';
        typeGroup?.classList.remove('account-type-group--full-width');
    } else {
        sel.innerHTML = cachedAccountTypeOptionsFull;
        if (typeLabel) typeLabel.textContent = 'Tipo';
        typeGroup?.classList.remove('account-type-group--full-width');
    }
}

export function initFinance(
    user,
    accounts,
    expenses,
    gains,
    onUpdate,
    userProfile = null,
    expenseSplitRequests = null
) {
    currentUser = user;
    syncFinanceState(accounts, expenses, gains, userProfile, expenseSplitRequests);
    onUpdateCallback = onUpdate;
    if (!initFinance._didSyncPeriodFilters) {
        syncPeriodFilterSelectsToCurrentMonth();
        initFinance._didSyncPeriodFilters = true;
    }
    cacheAccountTypeOptionsIfNeeded();
    setupExpenseCategoryUi();
    setupGainCategoryUi();

    document.getElementById('add-expense-btn')?.addEventListener('click', () => openExpenseModal(false));
    document.getElementById('add-gain-btn')?.addEventListener('click', () => openGainModal(false));
    document.getElementById('expense-form')?.addEventListener('submit', handleExpenseFormSubmit);
    document.getElementById('expense-form')?.addEventListener('click', handleLoanMonthTagClick);
    document.getElementById('gain-form')?.addEventListener('submit', handleGainFormSubmit);
    document.getElementById('gain-recurring-mode')?.addEventListener('change', (e) => {
        if (document.getElementById('gain-id')?.value) return;
        const cb = document.getElementById('gain-is-received');
        if (!cb) return;
        cb.checked = e.target.value !== '1';
    });
    document.getElementById('add-wallet-btn')?.addEventListener('click', () => openWalletCreateModal());
    document.getElementById('wallet-institutions-list')?.addEventListener('click', handleWalletInstitutionsLinkClick);
    document.getElementById('account-form')?.addEventListener('submit', handleAccountFormSubmit);
    document.getElementById('accounts-list')?.addEventListener('click', handleAccountActions);
    document.getElementById('wallet-institutions-list')?.addEventListener('click', handleAccountActions);
    document.getElementById('wallet-institutions-list')?.addEventListener('click', handleCreditCardListClick);
    document.getElementById('credit-cards-list')?.addEventListener('click', handleCreditCardListClick);
    document.getElementById('credit-cards-list')?.addEventListener('keydown', handleCreditCardListKeydown);
    initWalletPageUiOnce();
    document.getElementById('card-purchases-modal')?.addEventListener('click', handleCardPurchasesModalActions);
    document.querySelector('#expenses-table tbody')?.addEventListener('click', handleExpenseRowActions);
    document.querySelector('#gains-table tbody')?.addEventListener('click', handleGainRowActions);
    document.getElementById('account-type')?.addEventListener('change', (e) => toggleCreditCardFields(e.target.value));
    document.getElementById('wallet-wizard-add-credit')?.addEventListener('change', syncWalletWizardPanels);
    document.getElementById('wallet-wizard-add-debit')?.addEventListener('change', syncWalletWizardPanels);
    document.getElementById('expense-payment-method')?.addEventListener('change', () => syncExpenseInstallmentsRow());
    document.getElementById('expense-installments')?.addEventListener('input', () => syncExpenseInstallmentsRow());
    document.getElementById('expense-date')?.addEventListener('change', () => syncExpenseInstallmentsRow());
    document.getElementById('expense-recurring-mode')?.addEventListener('change', () => syncExpenseInstallmentsRow());
    document.getElementById('expense-category-select')?.addEventListener('change', () => {
        syncExpensePaymentMethodForLoanCategory();
        syncExpenseInstallmentsRow();
    });
    document.getElementById('expense-loan-debit-account')?.addEventListener('change', (ev) => {
        const form = document.getElementById('expense-form');
        if (form) form.dataset.loanPaymentAccountId = ev.target.value || '';
        syncExpenseInstallmentsRow();
    });

    setupTransactionTableFilters();
    setupFilterDrawer({
        drawerId: 'expenses-filter-drawer',
        openBtnId: 'expenses-filter-open-btn',
        onOpen: () => {
            readExpensesFilterFromDom();
            syncDrawerDateInputsToPeriod('expenses-filter', document.getElementById('expenses-period-filter')?.value);
            populateExpenseFilterSelects();
            readExpensesFilterFromDom();
            syncRangeLabels('expenses-filter', expensesRenderCache.currency);
        }
    });
    setupFilterDrawer({
        drawerId: 'gains-filter-drawer',
        openBtnId: 'gains-filter-open-btn',
        onOpen: () => {
            readGainsFilterFromDom();
            syncDrawerDateInputsToPeriod('gains-filter', document.getElementById('gains-period-filter')?.value);
            populateGainFilterSelects();
            readGainsFilterFromDom();
            syncRangeLabels('gains-filter', gainsRenderCache.currency);
        }
    });
    setupFilterDrawer({
        drawerId: 'dashboard-filter-drawer',
        openBtnId: 'dashboard-filter-open-btn',
        onOpen: () => {}
    });
    document.getElementById('dashboard-filter-clear')?.addEventListener('click', () => {
        const sel = document.getElementById('category-filter');
        if (!sel) return;
        sel.value = '__all__';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        closeFilterDrawer('dashboard-filter-drawer');
    });
    setupInstallmentCashOutConfirmModal();
    setupExpenseSplitUi();
    setupExpenseBatchEditUi();
    setupGainBatchSelectionUi();
}

function setupExpenseBatchEditUi() {
    const tbody = document.querySelector('#expenses-table tbody');
    tbody?.addEventListener('change', (e) => {
        const t = e.target;
        if (!(t instanceof HTMLInputElement)) return;
        if (!t.classList.contains('expense-batch-check')) return;
        syncExpensesBatchToolbar();
    });

    document.getElementById('expenses-table-select-all')?.addEventListener('change', (e) => {
        const master = e.target;
        const on = master instanceof HTMLInputElement && master.checked;
        document.querySelectorAll('#expenses-table tbody .expense-batch-check').forEach((node) => {
            if (node instanceof HTMLInputElement) node.checked = on;
        });
        syncExpensesBatchToolbar();
    });

    document.getElementById('expenses-batch-open-modal-btn')?.addEventListener('click', () => {
        void openExpenseBatchModal();
    });

    document.getElementById('expenses-batch-clear-btn')?.addEventListener('click', () => {
        clearExpenseBatchSelection();
    });

    document.getElementById('expense-batch-category')?.addEventListener('change', () => {
        void fillExpenseBatchSubcategorySelect();
    });

    document.getElementById('expense-batch-cancel-btn')?.addEventListener('click', () => {
        closeModal('expense-batch-modal');
    });

    document.getElementById('expense-batch-form')?.addEventListener('submit', handleExpenseBatchFormSubmit);
}

function setupGainBatchSelectionUi() {
    const tbody = document.querySelector('#gains-table tbody');
    tbody?.addEventListener('change', (e) => {
        const t = e.target;
        if (!(t instanceof HTMLInputElement)) return;
        if (!t.classList.contains('gain-batch-check')) return;
        syncGainsBatchToolbar();
    });

    document.getElementById('gains-table-select-all')?.addEventListener('change', (e) => {
        const master = e.target;
        const on = master instanceof HTMLInputElement && master.checked;
        document.querySelectorAll('#gains-table tbody .gain-batch-check').forEach((node) => {
            if (node instanceof HTMLInputElement) node.checked = on;
        });
        syncGainsBatchToolbar();
    });

    document.getElementById('gains-batch-clear-btn')?.addEventListener('click', () => {
        clearGainBatchSelection();
    });

    document.getElementById('gains-batch-open-modal-btn')?.addEventListener('click', () => {
        void openGainBatchModal();
    });

    document.getElementById('gain-batch-cancel-btn')?.addEventListener('click', () => {
        closeModal('gain-batch-modal');
    });

    document.getElementById('gain-batch-form')?.addEventListener('submit', handleGainBatchFormSubmit);

    document.getElementById('gain-batch-category')?.addEventListener('change', () => {
        void fillGainBatchSubcategorySelect();
    });
}

function getGainBatchSelectedIds() {
    const seen = new Set();
    document.querySelectorAll('#gains-table tbody .gain-batch-check:checked').forEach((c) => {
        if (!(c instanceof HTMLInputElement)) return;
        const id = (c.dataset.gainId || '').trim();
        if (id) seen.add(id);
    });
    return [...seen];
}

/** Ids seleccionados que correspondem a entradas reais guardadas (exclui linhas sintéticas de expectativa). */
function getGainBatchEditableSelectedIds() {
    const selected = getGainBatchSelectedIds();
    const realIds = new Set(
        (userGains || []).filter((g) => g && !g.__syntheticExpectedSplit).map((g) => String(g.id))
    );
    return selected.filter((id) => realIds.has(String(id)));
}

function syncGainsBatchToolbar() {
    const n = getGainBatchSelectedIds().length;
    const bar = document.getElementById('gains-batch-toolbar');
    const txt = document.getElementById('gains-batch-toolbar-text');
    if (!bar) return;

    if (n <= 0) {
        bar.classList.add('hidden');
        const m = document.getElementById('gains-table-select-all');
        if (m instanceof HTMLInputElement) {
            m.checked = false;
            m.indeterminate = false;
        }
        return;
    }

    bar.classList.remove('hidden');
    if (txt) {
        txt.textContent = n === 1 ? '1 entrada selecionada' : `${n} entradas selecionadas`;
    }

    const vis = document.querySelectorAll('#gains-table tbody .gain-batch-check').length;
    const chk = document.querySelectorAll('#gains-table tbody .gain-batch-check:checked').length;
    const master = document.getElementById('gains-table-select-all');
    if (master instanceof HTMLInputElement) {
        master.checked = vis > 0 && chk === vis;
        master.indeterminate = chk > 0 && chk < vis;
    }
}

function clearGainBatchSelection() {
    document.querySelectorAll('#gains-table tbody .gain-batch-check').forEach((c) => {
        if (c instanceof HTMLInputElement) c.checked = false;
    });
    syncGainsBatchToolbar();
}

function getExpenseBatchSelectedIds() {
    const seen = new Set();
    document.querySelectorAll('#expenses-table tbody .expense-batch-check:checked').forEach((c) => {
        if (!(c instanceof HTMLInputElement)) return;
        const id = (c.dataset.expenseId || '').trim();
        if (id) seen.add(id);
    });
    return [...seen];
}

function syncExpensesBatchToolbar() {
    const n = getExpenseBatchSelectedIds().length;
    const bar = document.getElementById('expenses-batch-toolbar');
    const txt = document.getElementById('expenses-batch-toolbar-text');
    if (!bar) return;

    if (n <= 0) {
        bar.classList.add('hidden');
        const m = document.getElementById('expenses-table-select-all');
        if (m instanceof HTMLInputElement) {
            m.checked = false;
            m.indeterminate = false;
        }
        return;
    }

    bar.classList.remove('hidden');
    if (txt) {
        txt.textContent = n === 1 ? '1 saída selecionada' : `${n} saídas selecionadas`;
    }

    const vis = document.querySelectorAll('#expenses-table tbody .expense-batch-check').length;
    const chk = document.querySelectorAll('#expenses-table tbody .expense-batch-check:checked').length;
    const master = document.getElementById('expenses-table-select-all');
    if (master instanceof HTMLInputElement) {
        master.checked = vis > 0 && chk === vis;
        master.indeterminate = chk > 0 && chk < vis;
    }
}

function clearExpenseBatchSelection() {
    document.querySelectorAll('#expenses-table tbody .expense-batch-check').forEach((c) => {
        if (c instanceof HTMLInputElement) c.checked = false;
    });
    syncExpensesBatchToolbar();
}

function populateBatchExpenseAccountSelect() {
    const sel = document.getElementById('expense-batch-account');
    if (!sel) return;
    populatePaymentMethodSelect(sel, undefined);
    const first = sel.options[0];
    if (first) {
        first.value = '';
        first.textContent = 'Manter conta atual';
    }
    sel.value = '';
}

async function fillExpenseBatchCategorySelect() {
    await populateExpenseCategorySelect('', false);
    const src = document.getElementById('expense-category-select');
    const dst = document.getElementById('expense-batch-category');
    if (!dst) return;

    dst.innerHTML = '';
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Manter categoria atual';
    dst.appendChild(ph);

    if (!src) return;
    const skipVals = new Set(['', '__manage_categories__', '__add_new__']);
    for (const opt of [...src.options]) {
        const v = String(opt.value || '');
        if (skipVals.has(v) || opt.disabled) continue;
        dst.appendChild(new Option(opt.textContent, v));
    }
}

async function fillExpenseBatchSubcategorySelect() {
    const catSel = document.getElementById('expense-batch-category');
    const subSel = document.getElementById('expense-batch-subcategory');
    if (!subSel) return;

    const cat = (catSel?.value || '').trim();
    subSel.innerHTML = '';

    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = cat ? 'Manter subcategoria atual' : 'Escolha uma categoria para listar subcategorias';
    subSel.appendChild(ph);

    const clearOpt = document.createElement('option');
    clearOpt.value = '__clear__';
    clearOpt.textContent = 'Limpar subcategoria';
    subSel.appendChild(clearOpt);

    if (!cat) {
        subSel.disabled = true;
        subSel.value = '';
        return;
    }

    subSel.disabled = false;
    const subs = await getSubcategoriesForCategory(cat);
    subs.forEach((s) => subSel.appendChild(new Option(s, s)));
    subSel.value = '';
}

async function openExpenseBatchModal() {
    const ids = getExpenseBatchSelectedIds();
    if (ids.length === 0) {
        showToast('Seleção', 'Marque pelo menos uma saída na tabela.', 'warning');
        return;
    }

    populateBatchExpenseAccountSelect();
    await fillExpenseBatchCategorySelect();
    await fillExpenseBatchSubcategorySelect();

    document.getElementById('expense-batch-fixed').value = '';
    document.getElementById('expense-batch-paid').value = '';
    document.getElementById('expense-batch-investment').value = '';

    const sum = document.getElementById('expense-batch-modal-summary');
    if (sum) {
        sum.textContent = `Serão atualizadas ${ids.length} saída(s) distinta(s). Só os campos que não estiverem em «Manter» serão gravados.`;
    }

    openModal('expense-batch-modal');
}

async function handleExpenseBatchFormSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const ids = getExpenseBatchSelectedIds();
    if (ids.length === 0) {
        showToast('Seleção', 'Nenhuma saída selecionada.', 'warning');
        return;
    }

    const patch = {};
    const acc = document.getElementById('expense-batch-account')?.value?.trim() || '';
    if (acc) patch.accountId = acc;

    const fx = document.getElementById('expense-batch-fixed')?.value;
    if (fx === '1' || fx === '0') patch.isFixed = fx === '1';

    const pd = document.getElementById('expense-batch-paid')?.value;
    if (pd === '1' || pd === '0') patch.isPaid = pd === '1';

    const inv = document.getElementById('expense-batch-investment')?.value;
    if (inv === '1' || inv === '0') patch.isInvestment = inv === '1';

    const cat = document.getElementById('expense-batch-category')?.value?.trim() || '';
    if (cat) patch.category = cat;

    const sub = document.getElementById('expense-batch-subcategory')?.value || '';
    if (sub === '__clear__') patch.subcategory = null;
    else if (sub) {
        if (!cat) {
            showToast(
                'Categoria',
                'Para escolher uma subcategoria, selecione também a categoria. Para só remover subcategorias, use «Limpar subcategoria».',
                'warning'
            );
            return;
        }
        patch.subcategory = sub;
    }

    if (Object.keys(patch).length === 0) {
        showToast('Campos', 'Altere pelo menos um campo ou cancele.', 'warning');
        return;
    }

    setFormSubmittingState(form, true, 'Aplicando…');
    try {
        const r = await patchExpensesBatch(ids, patch);
        closeModal('expense-batch-modal');
        const m = Number(r?.modified) || 0;
        showToast(
            'Edição em lote',
            m === 0 ? 'Nenhuma saída foi atualizada (verifique permissões ou ids).' : `${m} saída(s) atualizadas.`,
            m === 0 ? 'warning' : 'success'
        );
        if (m > 0) playPingSound();
        clearExpenseBatchSelection();
        onUpdateCallback?.();
    } catch (err) {
        console.error(err);
        showToast('Erro', err?.message || 'Não foi possível aplicar as alterações.', 'error');
    } finally {
        setFormSubmittingState(form, false);
    }
}

function populateBatchGainAccountSelect() {
    const sel = document.getElementById('gain-batch-account');
    if (!sel) return;
    sel.innerHTML = '';
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Manter conta atual';
    sel.appendChild(ph);
    sortedBankAccounts().forEach((b) => {
        const o = document.createElement('option');
        o.value = b.id;
        o.textContent = b.name;
        sel.appendChild(o);
    });
    sel.value = '';
}

async function fillGainBatchCategorySelect() {
    const dst = document.getElementById('gain-batch-category');
    if (!dst) return;

    dst.innerHTML = '';
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Manter categoria atual';
    dst.appendChild(ph);

    try {
        const names = await listGainCategoryNamesSorted(false);
        names.forEach((name) => dst.appendChild(new Option(name, name)));
    } catch (err) {
        console.error(err);
    }
}

async function fillGainBatchSubcategorySelect() {
    const catSel = document.getElementById('gain-batch-category');
    const subSel = document.getElementById('gain-batch-subcategory');
    if (!subSel) return;

    const cat = (catSel?.value || '').trim();
    subSel.innerHTML = '';

    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = cat ? 'Manter subcategoria atual' : 'Escolha uma categoria para listar subcategorias';
    subSel.appendChild(ph);

    const clearOpt = document.createElement('option');
    clearOpt.value = '__clear__';
    clearOpt.textContent = 'Limpar subcategoria';
    subSel.appendChild(clearOpt);

    if (!cat) {
        subSel.disabled = true;
        subSel.value = '';
        return;
    }

    subSel.disabled = false;
    const subs = await getGainSubcategoriesForCategory(cat);
    subs.forEach((s) => subSel.appendChild(new Option(s, s)));
    subSel.value = '';
}

async function openGainBatchModal() {
    const ids = getGainBatchEditableSelectedIds();
    if (ids.length === 0) {
        if (getGainBatchSelectedIds().length > 0) {
            showToast(
                'Seleção',
                'Linhas de expectativa de estorno não entram na edição em lote. Selecione apenas entradas guardadas.',
                'warning'
            );
        } else {
            showToast('Seleção', 'Marque pelo menos uma entrada na tabela.', 'warning');
        }
        return;
    }

    populateBatchGainAccountSelect();
    await fillGainBatchCategorySelect();
    await fillGainBatchSubcategorySelect();

    const recv = document.getElementById('gain-batch-received');
    if (recv) recv.value = '';

    const sum = document.getElementById('gain-batch-modal-summary');
    if (sum) {
        sum.textContent = `Serão atualizadas ${ids.length} entrada(s). Conta, categoria, subcategoria e recebido: só gravamos o que não estiver em «Manter». «Limpar subcategoria» remove a subcategoria; para definir uma subcategoria nova, escolha também a categoria correspondente.`;
    }

    openModal('gain-batch-modal');
}

async function handleGainBatchFormSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const ids = getGainBatchEditableSelectedIds();
    if (ids.length === 0) {
        showToast('Seleção', 'Nenhuma entrada elegível selecionada.', 'warning');
        return;
    }

    const patch = {};
    const acc = document.getElementById('gain-batch-account')?.value?.trim() || '';
    if (acc) patch.accountId = acc;

    const cat = document.getElementById('gain-batch-category')?.value?.trim() || '';
    if (cat) patch.category = cat;

    const sub = document.getElementById('gain-batch-subcategory')?.value || '';
    if (sub === '__clear__') patch.subcategory = null;
    else if (sub) {
        if (!cat) {
            showToast(
                'Categoria',
                'Para escolher uma subcategoria de entrada, selecione também a categoria. Para só remover subcategorias, use «Limpar subcategoria».',
                'warning'
            );
            return;
        }
        patch.subcategory = sub;
    }

    const recv = document.getElementById('gain-batch-received')?.value;
    if (recv === '1' || recv === '0') patch.isPaid = recv === '1';

    if (Object.keys(patch).length === 0) {
        showToast('Campos', 'Altere pelo menos um campo ou cancele.', 'warning');
        return;
    }

    setFormSubmittingState(form, true, 'Aplicando…');
    try {
        const r = await patchGainsBatch(ids, patch);
        closeModal('gain-batch-modal');
        const m = Number(r?.modified) || 0;
        showToast(
            'Edição em lote',
            m === 0 ? 'Nenhuma entrada foi atualizada (verifique permissões ou ids).' : `${m} entrada(s) atualizadas.`,
            m === 0 ? 'warning' : 'success'
        );
        if (m > 0) playPingSound();
        clearGainBatchSelection();
        onUpdateCallback?.();
    } catch (err) {
        console.error(err);
        showToast('Erro', err?.message || 'Não foi possível aplicar as alterações.', 'error');
    } finally {
        setFormSubmittingState(form, false);
    }
}

function setupInstallmentCashOutConfirmModal() {
    const modalId = 'confirm-installment-cash-out-modal';
    const ok = document.getElementById('confirm-installment-cash-out-ok');
    const cancel = document.getElementById('confirm-installment-cash-out-cancel');
    ok?.addEventListener('click', async () => {
        if (!pendingInstallmentCashOut?.expenseId || !pendingInstallmentCashOut?.periodKey) return;
        try {
            await runWithButtonLoading(
                ok,
                () =>
                    confirmExpenseCashOut(
                        pendingInstallmentCashOut.expenseId,
                        pendingInstallmentCashOut.periodKey
                    ),
                { busyLabel: 'Confirmando...' }
            );
            pendingInstallmentCashOut = null;
            closeModal(modalId);
            onUpdateCallback?.();
            playPingSound();
            showToast('Pagamento', 'Parcela registrada no saldo.', 'success');
        } catch (err) {
            console.error(err);
            showToast('Erro', 'Não foi possível confirmar o pagamento.', 'error');
        }
    });
    cancel?.addEventListener('click', () => {
        pendingInstallmentCashOut = null;
        closeModal(modalId);
    });
}

function openInstallmentCashOutConfirmModal(expenseId, periodKey) {
    pendingInstallmentCashOut = { expenseId, periodKey };
    openModal('confirm-installment-cash-out-modal');
}

function setNodeListDisabled(root, disabled) {
    if (!root) return;
    root.querySelectorAll('input, select, textarea, button').forEach((el) => {
        el.disabled = disabled;
    });
}

function syncWalletWizardPanels() {
    const creditOn = document.getElementById('wallet-wizard-add-credit')?.checked === true;
    const debitOn = document.getElementById('wallet-wizard-add-debit')?.checked === true;
    const creditPanel = document.getElementById('wallet-wizard-credit-fields');
    const debitPanel = document.getElementById('wallet-wizard-debit-fields');
    creditPanel?.classList.toggle('hidden', !creditOn);
    debitPanel?.classList.toggle('hidden', !debitOn);
    setNodeListDisabled(creditPanel, !creditOn);
    setNodeListDisabled(debitPanel, !debitOn);
}

function hideWalletWizardUi() {
    const modeEl = document.getElementById('account-form-mode');
    if (modeEl) modeEl.value = '';
    const block = document.getElementById('wallet-wizard-block');
    block?.classList.add('hidden');
    const cbC = document.getElementById('wallet-wizard-add-credit');
    const cbD = document.getElementById('wallet-wizard-add-debit');
    if (cbC) {
        cbC.checked = false;
        cbC.disabled = true;
    }
    if (cbD) {
        cbD.checked = false;
        cbD.disabled = true;
    }
    const creditPanel = document.getElementById('wallet-wizard-credit-fields');
    const debitPanel = document.getElementById('wallet-wizard-debit-fields');
    creditPanel?.classList.add('hidden');
    debitPanel?.classList.add('hidden');
    setNodeListDisabled(creditPanel, true);
    setNodeListDisabled(debitPanel, true);
    const sub = document.getElementById('account-modal-subtitle');
    if (sub) {
        sub.textContent = '';
        sub.classList.add('hidden');
    }
}

function handleWalletInstitutionsLinkClick(e) {
    const link = e.target.closest('[data-wallet-link-credit]');
    if (!link) return;
    e.preventDefault();
    const bid = link.getAttribute('data-wallet-link-credit');
    if (bid) openNewCreditCardModal(bid);
}

function openWalletCreateModal() {
    const form = document.getElementById('account-form');
    if (!form) return;
    setAccountTypeSelectMode('bankOnly');
    form.reset();
    form['account-id'].value = '';
    const modeEl = document.getElementById('account-form-mode');
    if (modeEl) modeEl.value = 'wallet_wizard';

    document.getElementById('wallet-wizard-block')?.classList.remove('hidden');
    const cbC = document.getElementById('wallet-wizard-add-credit');
    const cbD = document.getElementById('wallet-wizard-add-debit');
    if (cbC) cbC.disabled = false;
    if (cbD) cbD.disabled = false;
    syncWalletWizardPanels();

    const titleEl = document.getElementById('account-modal-title');
    if (titleEl) titleEl.textContent = 'Nova na carteira';
    const sub = document.getElementById('account-modal-subtitle');
    if (sub) {
        sub.textContent =
            'Primeiro a conta bancária; depois pode marcar cartão de crédito e/ou débito na mesma instituição.';
        sub.classList.remove('hidden');
    }
    document.getElementById('account-message')?.classList.add('hidden');
    toggleCreditCardFields(form['account-type'].value);
    openModal('account-modal');
}

/** Contas não-cartão para vincular cartão de crédito ou débito. */
function populateCardLinkedAccountSelect(selectEl, excludeAccountId) {
    if (!selectEl) return;
    const exclude = excludeAccountId || '';
    selectEl.innerHTML = '<option value="">Selecione a conta</option>';
    (userAccounts || [])
        .filter((acc) => !isCardAccountType(acc.type))
        .filter((acc) => acc.id !== exclude)
        .forEach((acc) => {
            selectEl.innerHTML += `<option value="${acc.id}">${escapeHtml(acc.name)}</option>`;
        });
}

function setCardLinkedHint(type) {
    const hint = document.getElementById('card-linked-hint');
    if (!hint) return;
    if (type === 'cartao_debito') {
        hint.textContent = hint.dataset.hintDebit || '';
    } else if (type === 'cartao_credito') {
        hint.textContent = hint.dataset.hintCredit || '';
    } else {
        hint.textContent = '';
    }
}

function toggleCreditCardFields(type) {
    const creditCardFields = document.getElementById('credit-card-fields');
    const cardLimit = document.getElementById('card-limit');
    const cardClose = document.getElementById('card-closing-day');
    const cardDue = document.getElementById('card-due-day');
    const holderGroup = document.getElementById('card-holder-group');
    const holderInput = document.getElementById('card-holder-name');
    const holderLabel = document.getElementById('account-holder-label');
    const holderHint = document.getElementById('account-holder-hint');
    const nameLabel = document.getElementById('account-name-label');
    const cardLinkedGroup = document.getElementById('card-linked-account-group');
    const cardLinkedSelect = document.getElementById('card-linked-account');
    const accountForm = document.getElementById('account-form');
    const editingAccountId = accountForm?.['account-id']?.value || '';
    const isWalletWizard = document.getElementById('account-form-mode')?.value === 'wallet_wizard';

    holderGroup?.classList.remove('hidden');
    if (isCardAccountType(type)) {
        holderInput?.setAttribute('required', 'required');
        if (nameLabel) nameLabel.textContent = 'Nome do cartão';
        if (holderLabel) holderLabel.textContent = 'Titular (como no cartão)';
        holderHint?.classList.add('hidden');
        if (holderInput) holderInput.placeholder = 'Como impresso no cartão';
    } else {
        holderInput?.removeAttribute('required');
        if (nameLabel) nameLabel.textContent = 'Nome da conta';
        if (holderLabel) holderLabel.textContent = 'Titular da conta';
        holderHint?.classList.add('hidden');
        if (holderInput) holderInput.placeholder = 'Nome completo do titular';
    }

    if (type === 'cartao_credito') {
        creditCardFields.classList.remove('hidden');
        cardLimit?.setAttribute('required', 'required');
        cardClose?.setAttribute('required', 'required');
        cardDue?.setAttribute('required', 'required');
        if (!isWalletWizard) {
            cardLinkedGroup?.classList.remove('hidden');
            populateCardLinkedAccountSelect(cardLinkedSelect, editingAccountId);
            cardLinkedSelect?.setAttribute('required', 'required');
        } else {
            cardLinkedGroup?.classList.add('hidden');
            cardLinkedSelect?.removeAttribute('required');
        }
        setCardLinkedHint(type);
    } else if (type === 'cartao_debito') {
        creditCardFields.classList.add('hidden');
        cardLimit?.removeAttribute('required');
        cardClose?.removeAttribute('required');
        cardDue?.removeAttribute('required');
        if (!isWalletWizard) {
            cardLinkedGroup?.classList.remove('hidden');
            populateCardLinkedAccountSelect(cardLinkedSelect, editingAccountId);
            cardLinkedSelect?.setAttribute('required', 'required');
        } else {
            cardLinkedGroup?.classList.add('hidden');
            cardLinkedSelect?.removeAttribute('required');
        }
        setCardLinkedHint(type);
    } else {
        creditCardFields.classList.add('hidden');
        cardLimit?.removeAttribute('required');
        cardClose?.removeAttribute('required');
        cardDue?.removeAttribute('required');
        cardLinkedGroup?.classList.add('hidden');
        cardLinkedSelect?.removeAttribute('required');
        setCardLinkedHint('');
    }
}

function readExpensesFilterFromDom() {
    expensesFilterState.q = document.getElementById('expenses-filter-q')?.value || '';
    expensesFilterState.category = document.getElementById('expenses-filter-category')?.value || '';
    expensesFilterState.subcategory = document.getElementById('expenses-filter-subcategory')?.value || '';
    expensesFilterState.paymentType = document.getElementById('expenses-filter-payment-type')?.value || '';
    expensesFilterState.paymentStatus = new Set();
    if (document.getElementById('expenses-filter-status-paid')?.checked) expensesFilterState.paymentStatus.add('paid');
    if (document.getElementById('expenses-filter-status-pending')?.checked) expensesFilterState.paymentStatus.add('unpaid');
    expensesFilterState.description = document.getElementById('expenses-filter-description')?.value || '';
    const amin = document.getElementById('expenses-filter-amount-min')?.value;
    const amax = document.getElementById('expenses-filter-amount-max')?.value;
    expensesFilterState.amountMin = amin != null && amin !== '' ? Number(amin) : null;
    expensesFilterState.amountMax = amax != null && amax !== '' ? Number(amax) : null;
    const df = document.getElementById('expenses-filter-date-from');
    const dt = document.getElementById('expenses-filter-date-to');
    const manual = df?.dataset?.manual === '1' || dt?.dataset?.manual === '1';
    expensesFilterState.dateFrom = manual ? df?.value || '' : '';
    expensesFilterState.dateTo = manual ? dt?.value || '' : '';
    expensesFilterState.accountId = document.getElementById('expenses-filter-account')?.value || '';
    expensesFilterState.period =
        document.getElementById('expenses-period-filter')?.value || getDefaultPeriodValue();
    expensesFilterState.quickExpenseTypes = new Set();
    document
        .querySelectorAll('#expenses-page .quick-filter-btn[data-quick-kind="type"][aria-pressed="true"]')
        .forEach((btn) => {
            const f = btn.dataset.filter;
            if (f) expensesFilterState.quickExpenseTypes.add(f);
        });
}

/** Zera filtros do drawer (exceto período) — usado no botão «limpar»; não chamar em todo reload dos dados para não perder filtros ao editar/excluir. */
function resetExpensesDrawerFiltersKeepPeriod() {
    const q = document.getElementById('expenses-filter-q');
    const c = document.getElementById('expenses-filter-category');
    const sc = document.getElementById('expenses-filter-subcategory');
    const pt = document.getElementById('expenses-filter-payment-type');
    const paidSt = document.getElementById('expenses-filter-status-paid');
    const pendSt = document.getElementById('expenses-filter-status-pending');
    const desc = document.getElementById('expenses-filter-description');
    const amin = document.getElementById('expenses-filter-amount-min');
    const amax = document.getElementById('expenses-filter-amount-max');
    const df = document.getElementById('expenses-filter-date-from');
    const dt = document.getElementById('expenses-filter-date-to');
    const a = document.getElementById('expenses-filter-account');
    if (q) q.value = '';
    if (c) c.value = '';
    if (sc) sc.value = '';
    if (pt) pt.value = '';
    if (paidSt) paidSt.checked = false;
    if (pendSt) pendSt.checked = false;
    if (desc) desc.value = '';
    // Não copiar min/max antigos do DOM — após trocar o dataset, os atributos ainda refletem o recorte anterior.
    if (amin) amin.value = '';
    if (amax) amax.value = '';
    if (amin) amin.dataset.manual = '0';
    if (amax) amax.dataset.manual = '0';
    if (df) df.dataset.manual = '0';
    if (dt) dt.dataset.manual = '0';
    if (a) a.value = '';
    clearExpensesQuickTypeButtons();
    syncExpensesQuickStatusButtonsFromCheckboxes();
}

function clearExpensesQuickTypeButtons() {
    document.querySelectorAll('#expenses-page .quick-filter-btn[data-quick-kind="type"]').forEach((btn) => {
        btn.setAttribute('aria-pressed', 'false');
        btn.classList.remove('active');
    });
}

function syncExpensesQuickStatusButtonsFromCheckboxes() {
    const paid = !!document.getElementById('expenses-filter-status-paid')?.checked;
    const pend = !!document.getElementById('expenses-filter-status-pending')?.checked;
    document.querySelectorAll('#expenses-page .quick-filter-btn[data-quick-kind="status"]').forEach((btn) => {
        const on = btn.dataset.filter === 'paid' ? paid : btn.dataset.filter === 'unpaid' ? pend : false;
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.classList.toggle('active', on);
    });
}

function syncGainsQuickStatusButtonsFromCheckboxes() {
    const recv = !!document.getElementById('gains-filter-status-received')?.checked;
    const pend = !!document.getElementById('gains-filter-status-pending')?.checked;
    document.querySelectorAll('#gains-page .quick-filter-btn[data-quick-kind="status"]').forEach((btn) => {
        const on = btn.dataset.filter === 'paid' ? recv : btn.dataset.filter === 'unpaid' ? pend : false;
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.classList.toggle('active', on);
    });
}

/** Filtros rápidos de tipo (essencial / variável / cartão): OR entre opções ativas; nenhuma = sem restrição. */
function expenseMatchesQuickTypeFilters(t, accounts) {
    const typeSet = expensesFilterState.quickExpenseTypes;
    if (!typeSet || typeSet.size === 0) return true;
    const acc = accounts?.find((a) => a.id === t.accountId);
    if (typeSet.has('fixed') && expenseIsMarkedFixed(t)) return true;
    if (typeSet.has('variable') && !expenseIsMarkedFixed(t)) return true;
    if (typeSet.has('credit') && acc && isCreditCardType(acc.type)) return true;
    return false;
}

/**
 * Saída «paga» para o filtro: `isPaid` ou débito no caixa já confirmado para a data do lançamento
 * (`cashOutConfirmedPeriods` — séries mensais, rateio espelhado, etc.).
 */
function expenseIsEffectivelyPaidForFilter(t, accounts) {
    if (!t) return false;
    if (t.isPaid !== false) return true;
    const acc = accounts?.find((a) => a.id === t.accountId);
    if (!acc) return false;
    const d = movementDateToJsDate(t.date);
    if (Number.isNaN(d.getTime())) return false;
    const confirmed = parseCashOutConfirmedPeriods(t);
    if (!confirmed.size) return false;
    return isPeriodConfirmedForDebit(confirmed, d);
}

/**
 * Conjunto `paid`/`unpaid`: OR entre estados; vazio = não exibe linhas (mesma regra das tags do painel).
 * @param {{ kind?: 'expense', accounts?: any[] } | null} expenseCtx — só em saídas; ganhos ignoram.
 */
function movementMatchesPaymentStatus(t, statusSet, expenseCtx = null) {
    if (!statusSet || statusSet.size === 0) return false;
    const paid =
        expenseCtx?.kind === 'expense'
            ? expenseIsEffectivelyPaidForFilter(t, expenseCtx.accounts)
            : t.isPaid !== false;
    return (statusSet.has('paid') && paid) || (statusSet.has('unpaid') && !paid);
}

function sumMovementAmounts(list) {
    return list.reduce((s, t) => s + (Number(t.amount) || 0), 0);
}

function filterMovementsInCurrentMonth(list) {
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth();
    return list.filter((t) => {
        const d = movementDateToJsDate(t.date);
        return d.getFullYear() === y && d.getMonth() === mo;
    });
}

/**
 * Soma saídas no ano calendário para o resumo da página de saídas.
 * — Cartão de crédito: valor integral de cada lançamento cuja data está no ano («registradas no ano»),
 *   não só a parcela do mês nem só o que já entrou no caixa.
 * — Empréstimo parcelado: parcelas com vencimento em cada mês (caixa), como antes.
 * — Demais contas: data do lançamento no ano.
 */
function sumCashOutInCalendarYear(sorted, year, now, userProfile = null) {
    let total = 0;
    for (const t of sorted) {
        const acc = userAccounts?.find((a) => a.id === t.accountId);
        const n = parseInt(String(t.installmentCount ?? '1'), 10) || 1;
        if (acc && isCreditCardType(acc.type)) {
            const d = movementDateToJsDate(t.date);
            if (d.getFullYear() === year) {
                total += Number(t.amount) || 0;
            }
        } else if (isLoanExpense(t) && (!acc || !isCreditCardType(acc.type)) && n >= 2) {
            for (let m = 0; m < 12; m++) {
                const monthKey = `${year}-${String(m + 1).padStart(2, '0')}`;
                total += loanInstallmentCashOutForCalendarMonth(t, monthKey, now, userProfile);
            }
        } else {
            const d = movementDateToJsDate(t.date);
            if (d.getFullYear() === year && expenseCountsAsCashOut(t, acc)) {
                total += Number(t.amount) || 0;
            }
        }
    }
    return total;
}

function expenseDisplayCategory(t) {
    if (t.subcategory) return `${t.category} > ${t.subcategory}`;
    return String(t.category ?? '—');
}

/** Saída marcada pelo usuário como despesa essencial (`isFixed` na API). */
function expenseIsMarkedFixed(t) {
    if (!t) return false;
    return Boolean(
        t.isFixed === true ||
            t.isFixed === 'true' ||
            t.isFixed === 1 ||
            t.isFixed === '1'
    );
}

/** Pílula Sim/Não na coluna Essencial da tabela de saídas (clique alterna `isFixed` via PATCH em lote). */
function expenseFixedCellHtmlForTable(t) {
    const idEsc = htmlAttrEscape(t?.id);
    return expenseIsMarkedFixed(t)
        ? `<button type="button" class="expense-fixed-pill expense-fixed-pill--yes expense-fixed-toggle" data-expense-id="${idEsc}" title="Clique para marcar como não essencial" aria-label="Desmarcar despesa essencial">Sim</button>`
        : `<button type="button" class="expense-fixed-pill expense-fixed-pill--no expense-fixed-toggle" data-expense-id="${idEsc}" title="Clique para marcar como despesa essencial" aria-label="Marcar como despesa essencial">Não</button>`;
}

function periodRemovalKeysFromDayAndMonth(dayKey, monthKey) {
    return new Set([String(dayKey ?? '').trim(), String(monthKey ?? '').trim()].filter(Boolean));
}

function periodRemovalKeysFromInstPeriodKey(primaryKey) {
    const pk = String(primaryKey ?? '').trim();
    const set = new Set([pk]);
    const m = pk.match(/^(\d{4}-\d{2})-\d{2}$/);
    if (m) set.add(m[1]);
    return set;
}

function filterCashOutConfirmedJsonAfterRemoval(expense, removalKeys) {
    const kept = [...parseCashOutConfirmedPeriods(expense)].filter((k) => !removalKeys.has(k));
    return kept.length ? JSON.stringify(kept) : null;
}

function expensePutPayloadFromRow(exp, overrides = {}) {
    const rawCop =
        'cashOutConfirmedPeriods' in overrides ? overrides.cashOutConfirmedPeriods : expense.cashOutConfirmedPeriods;
    let installmentCount = null;
    const icRaw = expense.installmentCount;
    if (icRaw != null && icRaw !== '') {
        const n = parseInt(String(icRaw), 10);
        if (Number.isFinite(n) && n >= 1) installmentCount = Math.min(99, n);
    }
    return {
        userId: currentUser.uid,
        description: String(expense.description ?? '').trim(),
        amount: Number(expense.amount),
        date: movementDateToJsDate(expense.date),
        accountId: expense.accountId,
        category: String(expense.category ?? '').trim(),
        subcategory:
            expense.subcategory != null && String(expense.subcategory).trim() !== ''
                ? String(expense.subcategory).trim()
                : null,
        isPaid:
            'isPaid' in overrides ? Boolean(overrides.isPaid) : expense.isPaid !== false,
        isInvestment: Boolean(expense.isInvestment),
        installmentCount,
        recurringMonthly: Boolean(expense.recurringMonthly),
        isFixed: expenseIsMarkedFixed(expense),
        cashOutConfirmedPeriods: rawCop ?? null
    };
}

function expensePaidToggleSnapshotsFromButton(btn) {
    const id = String(btn.dataset.expenseId ?? '').trim();
    const mode = String(btn.dataset.paidToggleMode ?? '');
    const day = String(btn.dataset.periodDay ?? '');
    const month = String(btn.dataset.periodMonth ?? '');
    const ik = String(btn.dataset.instPeriodKey ?? '');
    const toggles = [...document.querySelectorAll('#expenses-table tbody button.expense-paid-toggle')].filter(
        (b) => {
            if (String(b.dataset.expenseId ?? '').trim() !== id || String(b.dataset.paidToggleMode ?? '') !== mode)
                return false;
            if (mode === 'period-keys-unconfirm') {
                return String(b.dataset.periodDay ?? '') === day && String(b.dataset.periodMonth ?? '') === month;
            }
            if (mode === 'inst-row-period-unconfirm') {
                return String(b.dataset.instPeriodKey ?? '') === ik;
            }
            return true;
        }
    );
    const pendingKey = `${id}|${mode}|${day}|${month}|${ik}`;
    return { pendingKey, snapshots: toggles.map((b) => ({ btn: b, html: b.innerHTML })) };
}

function gainTopLevelCategory(t) {
    const c = String(t.category ?? '').trim();
    return c || '—';
}

function gainCountsInTotals(t) {
    return Boolean(t && !t.referenceOnly);
}

function monthKeyFromDateObj(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Fim do mês YYYY-MM (23:59:59) — totais de saídas batem com o mês completo, inclusive parcelas ainda a vencer. */
function endOfMonthFromMonthKey(mk) {
    const y = Number(mk.slice(0, 4));
    const m = Number(mk.slice(5, 7));
    return new Date(y, m, 0, 23, 59, 59, 999);
}

/** Datas de cada mês da série «até dezembro» (mesmo dia do mês que a data inicial). */
function getRecurringSeriesDueDatesFromPurchase(purchase) {
    const p = purchase instanceof Date ? new Date(purchase.getTime()) : movementDateToJsDate(purchase);
    if (Number.isNaN(p.getTime())) return [];
    const y = p.getFullYear();
    const startM = p.getMonth();
    const dayW = p.getDate();
    const out = [];
    for (let m = startM; m <= 11; m++) {
        const lastDay = new Date(y, m + 1, 0).getDate();
        const day = Math.min(dayW, lastDay);
        out.push(new Date(y, m, day, 12, 0, 0, 0));
    }
    return out;
}

function updateExpensesSummaryCards() {
    const cache = expensesRenderCache;
    if (!cache?.sorted) return;
    readExpensesFilterFromDom();
    const ps = expensesFilterState.paymentStatus;
    const dashHint = summaryFilterRequiredHintHtml(EXPENSES_SUMMARY_COPY.filterRequiredHint);
    if (!ps || ps.size === 0) {
        ['expenses-summary-month', 'expenses-summary-projection', 'expenses-summary-top-cat', 'expenses-summary-other'].forEach(
            (id) => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = dashHint;
            }
        );
        [
            'expenses-summary-variation',
            'expenses-summary-projection-variation',
            'expenses-summary-top-cat-variation',
            'expenses-summary-other-variation'
        ].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = dashHint;
        });
        return;
    }
    const { sorted, currency, userProfile } = cache;
    const now = new Date();
    const period = expensesFilterState?.period || getDefaultPeriodValue();
    const isSingleMonth = /^month-\d+$/.test(period);
    const acceptedSplits = getOutgoingAcceptedSettledSplits();

    // Determina quais meses entram pelo filtro («este ano» = jan–dez; meses futuros no ano ainda sem caixa = 0)
    const currentMonthKey = monthKeyFromDateObj(now);
    let months = getMonthKeysInPeriod(period, now);

    // Total do período (soma de contribuições por mês)
    let totalPeriod = 0;
    let totalPending = 0;
    let fixedTotalPeriod = 0;
    let creditCardPeriod = 0;
    let otherExpensesPeriod = 0;
    for (const mk of months) {
        if (period === 'current-year' && mk > currentMonthKey) continue;
        const cutoff = endOfMonthFromMonthKey(mk);
        sorted.forEach((t) => {
            const acc = userAccounts?.find((a) => a.id === t.accountId);
            // Sempre o mês civil completo (vencimentos até o último dia), não só «até hoje».
            const contrib = expenseContributionPaidThroughMonthKey(
                t,
                acc,
                mk,
                cutoff,
                userProfile,
                acceptedSplits,
                sorted
            );
            totalPeriod += contrib;
            if (expenseIsMarkedFixed(t)) fixedTotalPeriod += contrib;
            if (acc && isCreditCardType(acc.type)) creditCardPeriod += contrib;
            if (!expenseIsMarkedFixed(t) && !(acc && isCreditCardType(acc.type))) otherExpensesPeriod += contrib;

            // Cálculo do pendente: se a contribuição projetada para o mês for maior que a paga
            const projected = expenseContributionProjectedToMonthKey(
                t,
                acc,
                mk,
                now,
                userProfile,
                acceptedSplits,
                sorted
            );
            if (projected > contrib) {
                totalPending += projected - contrib;
            }
        });
    }

    // Cálculo do mês anterior para variação %
    let totalPrevMonth = 0;
    let fixedPrevMonth = 0;
    let creditCardPrevMonth = 0;
    let otherExpensesPrevMonth = 0;
    const firstMonthParts = months[0].split('-');
    const prevMonthDate = new Date(Number(firstMonthParts[0]), Number(firstMonthParts[1]) - 1 - 1, 1);
    const prevMonthKey = monthKeyFromDateObj(prevMonthDate);
    const prevMonthCutoff = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);
    
    {
        sorted.forEach((t) => {
            const acc = userAccounts?.find((a) => a.id === t.accountId);
            const contrib = expenseContributionPaidThroughMonthKey(
                t,
                acc,
                prevMonthKey,
                prevMonthCutoff,
                userProfile,
                acceptedSplits,
                sorted
            );
            totalPrevMonth += contrib;
            if (expenseIsMarkedFixed(t)) fixedPrevMonth += contrib;
            if (acc && isCreditCardType(acc.type)) creditCardPrevMonth += contrib;
            if (!expenseIsMarkedFixed(t) && !(acc && isCreditCardType(acc.type))) otherExpensesPrevMonth += contrib;
        });
    }

    // Atualiza a UI
    const elTop = document.getElementById('expenses-summary-top-cat');
    if (elTop) {
        elTop.textContent = formatCurrency(creditCardPeriod, currency);
    }
    setSummaryCardTooltip('expenses-summary-top-cat', expensesCreditCardTooltip(creditCardPeriod > 0));
    setSummaryCardTooltip('expenses-summary-other', expensesOtherTooltip(otherExpensesPeriod > 0));

    const elMonth = document.getElementById('expenses-summary-month');
    if (elMonth) elMonth.textContent = formatCurrency(totalPeriod, currency);

    setMovementSummaryMomVariation(
        document.getElementById('expenses-summary-variation'),
        totalPeriod,
        totalPrevMonth,
        isSingleMonth,
        true
    );
    setMovementSummaryMomVariation(
        document.getElementById('expenses-summary-projection-variation'),
        fixedTotalPeriod,
        fixedPrevMonth,
        isSingleMonth,
        true
    );
    setMovementSummaryMomVariation(
        document.getElementById('expenses-summary-top-cat-variation'),
        creditCardPeriod,
        creditCardPrevMonth,
        isSingleMonth,
        true
    );
    setMovementSummaryMomVariation(
        document.getElementById('expenses-summary-other-variation'),
        otherExpensesPeriod,
        otherExpensesPrevMonth,
        isSingleMonth,
        true
    );

    // Cards
    const elProjection = document.getElementById('expenses-summary-projection');
    if (elProjection) elProjection.textContent = formatCurrency(fixedTotalPeriod, currency);

    const elOther = document.getElementById('expenses-summary-other');
    if (elOther) elOther.textContent = formatCurrency(otherExpensesPeriod, currency);

    const tParts = getPeriodTitleParts(period, now);
    setSummaryCardTooltip('expenses-summary-month', expensesMonthTooltip(tParts));

    const titles = expensesSummaryTitles(tParts.label);
    setSummaryCardTitle('expenses-summary-month', titles.month);
    setSummaryCardTitle('expenses-summary-top-cat', titles.creditCard);
    setSummaryCardTitle('expenses-summary-projection', titles.projection);
    setSummaryCardTitle('expenses-summary-other', titles.other);

    // Atualiza o Mapa de Gastos (Treemap)
    renderExpensesTreemap(sorted, currency, tParts.label);

    syncExpensesFilterButtonHighlight();
}

/**
 * Agrega despesas por categoria/subcategoria na mesma base dos cards de resumo de saídas
 * (parcelas de cartão/empréstimo pelo vencimento no mês, demais pela data do lançamento).
 */
function buildSortedExpenseCategoriesForTreemapPeriod(sorted, period, now, userProfile, acceptedSplits) {
    const currentMonthKey = monthKeyFromDateObj(now);
    const months = getMonthKeysInPeriod(period, now);
    const categoryTotals = {};
    const categorySubcategories = {};

    for (const mk of months) {
        if (period === 'current-year' && mk > currentMonthKey) continue;
        const cutoff = endOfMonthFromMonthKey(mk);
        for (const t of sorted) {
            const acc = userAccounts?.find((a) => a.id === t.accountId);
            const contrib = expenseContributionPaidThroughMonthKey(
                t,
                acc,
                mk,
                cutoff,
                userProfile,
                acceptedSplits,
                sorted
            );
            if (contrib <= 0) continue;
            const catName = t.category || 'Sem categoria';
            const subcatName = t.subcategory || 'Geral';
            if (!categoryTotals[catName]) {
                categoryTotals[catName] = 0;
                categorySubcategories[catName] = {};
            }
            categoryTotals[catName] += contrib;
            categorySubcategories[catName][subcatName] =
                (categorySubcategories[catName][subcatName] || 0) + contrib;
        }
    }

    return Object.entries(categoryTotals)
        .map(([name, total]) => ({
            name,
            total,
            subcategories: Object.entries(categorySubcategories[name])
                .map(([subName, subTotal]) => ({ name: subName, total: subTotal }))
                .sort((a, b) => b.total - a.total)
        }))
        .sort((a, b) => b.total - a.total);
}

/**
 * Agrega entradas por categoria/subcategoria no período do filtro (mesma base do card «Principal categoria»).
 */
function buildSortedGainCategoriesForTreemapPeriod(sorted, period) {
    const categoryTotals = {};
    const categorySubcategories = {};
    for (const t of sorted || []) {
        if (!movementDateInListPeriod(t.date, period)) continue;
        if (!gainCountsInTotals(t)) continue;
        const top = gainTopLevelCategory(t);
        const catName = top === '—' ? 'Sem categoria' : top;
        const subcatName =
            t.subcategory && String(t.subcategory).trim() ? String(t.subcategory).trim() : 'Geral';
        const amt = Number(t.amount) || 0;
        if (amt <= 0) continue;
        if (!categoryTotals[catName]) {
            categoryTotals[catName] = 0;
            categorySubcategories[catName] = {};
        }
        categoryTotals[catName] += amt;
        categorySubcategories[catName][subcatName] =
            (categorySubcategories[catName][subcatName] || 0) + amt;
    }
    return Object.entries(categoryTotals)
        .map(([name, total]) => ({
            name,
            total,
            subcategories: Object.entries(categorySubcategories[name])
                .map(([subName, subTotal]) => ({ name: subName, total: subTotal }))
                .sort((a, b) => b.total - a.total)
        }))
        .sort((a, b) => b.total - a.total);
}

/**
 * Renderiza o Mapa de Gastos na página de Saídas (Chart.js treemap, mesmo estilo do painel).
 * @param {Array} sorted - Cache completo de despesas (período aplicado na agregação).
 * @param {string} currency - Moeda
 * @param {string} periodLabel - Label do período (título)
 */
function renderExpensesTreemap(sorted, currency, periodLabel) {
    const container = document.getElementById('expenses-treemap');
    const periodLabelEl = document.getElementById('treemap-period-label');

    if (!container) return;

    if (periodLabelEl) {
        periodLabelEl.textContent = periodLabel;
    }

    const period = expensesFilterState?.period || getDefaultPeriodValue();
    const now = new Date();
    const userProfile = expensesRenderCache?.userProfile ?? null;
    const acceptedSplits = getOutgoingAcceptedSettledSplits();
    const sortedCategories = buildSortedExpenseCategoriesForTreemapPeriod(
        sorted,
        period,
        now,
        userProfile,
        acceptedSplits
    );

    const { blocks: displayCategories, mergedCount } = buildTreemapBlocksForDisplay(sortedCategories);

    renderSpendingTreemapHost({
        container,
        displayCategories,
        mergedCount,
        currency,
        formatCurrency,
        escapeHtml,
        ui: {
            canvasId: 'expenses-spending-treemap-canvas',
            ariaLabel: 'Mapa de gastos por categoria',
            emptyMessage: 'Nenhuma despesa no período selecionado.',
            chartErrorMessage: 'Gráfico indisponível (Chart.js não carregado).',
            datasetLabel: 'Saídas por categoria'
        }
    });
}

/**
 * Mapa de Entradas (treemap verde), alinhado ao período do filtro de entradas.
 */
function renderGainsTreemap(sorted, currency, periodLabel) {
    const container = document.getElementById('gains-treemap');
    const periodLabelEl = document.getElementById('gains-treemap-period-label');
    if (!container) return;

    if (periodLabelEl) periodLabelEl.textContent = periodLabel;

    const period = gainsFilterState?.period || getDefaultPeriodValue();
    const sortedCategories = buildSortedGainCategoriesForTreemapPeriod(sorted, period);
    const { blocks: displayCategories, mergedCount } = buildTreemapBlocksForDisplay(sortedCategories);

    renderSpendingTreemapHost({
        container,
        displayCategories,
        mergedCount,
        currency,
        formatCurrency,
        escapeHtml,
        ui: {
            palette: INCOME_TREEMAP_PALETTE,
            canvasId: 'gains-income-treemap-canvas',
            ariaLabel: 'Mapa de entradas por categoria',
            emptyMessage: 'Nenhuma entrada no período selecionado.',
            chartErrorMessage: 'Gráfico indisponível (Chart.js não carregado).',
            datasetLabel: 'Entradas por categoria'
        }
    });
}

// Exposto para depuração rápida no console quando um total mensal parece errado.
// Uso: `window.__debugExpensesMonthContrib('2026-05')` ou sem args para usar o mês do filtro atual.
if (typeof window !== 'undefined') {
    window.__debugExpensesMonthContrib = function __debugExpensesMonthContrib(monthKey = null) {
        try {
            const cache = expensesRenderCache;
            if (!cache?.sorted) return [];
            const { sorted, userProfile } = cache;
            const now = new Date();
            const acceptedSplits = getOutgoingAcceptedSettledSplits();
            const currentMonthKey = monthKeyFromDateObj(now);
            const mk =
                monthKey ||
                (() => {
                    const period = expensesFilterState?.period || getDefaultPeriodValue();
                    const months = getMonthKeysInPeriod(period, now);
                    return months?.[0] || currentMonthKey;
                })();
            const cutoff = endOfMonthFromMonthKey(mk);
            const rows = [];
            for (const t of sorted) {
                const acc = userAccounts?.find((a) => a.id === t.accountId);
                const contrib = expenseContributionPaidThroughMonthKey(
                    t,
                    acc,
                    mk,
                    cutoff,
                    userProfile,
                    acceptedSplits,
                    sorted
                );
                const projected = expenseContributionProjectedToMonthKey(
                    t,
                    acc,
                    mk,
                    now,
                    userProfile,
                    acceptedSplits,
                    sorted
                );
                if (contrib || projected) {
                    rows.push({
                        id: t.id,
                        date: t.date,
                        description: t.description,
                        category: t.category,
                        subcategory: t.subcategory ?? null,
                        accountId: t.accountId,
                        accountName: acc?.name || null,
                        installmentCount: t.installmentCount ?? null,
                        amount: Number(t.amount) || 0,
                        contrib: Number(contrib) || 0,
                        projected: Number(projected) || 0,
                        pending: Math.max(0, (Number(projected) || 0) - (Number(contrib) || 0))
                    });
                }
            }
            rows.sort((a, b) => (b.contrib - a.contrib) || (b.projected - a.projected));
            return rows;
        } catch (e) {
            console.error(e);
            return [];
        }
    };
}

/**
 * Linhas sintéticas de expectativa de estorno/rateio aceito ainda sem `Gain` vinculado no pedido.
 * Inclui cartão (o caixa não gera `Gain` no aceite, mas a expectativa ainda é útil na lista “Entradas”).
 * FULL com várias parcelas em conta não cartão: estorno fica por parcela (INSTALLMENT) — exclui FULL nesse caso.
 */
function computeExpectedSplitGainsRows(period, now = new Date()) {
    return buildSyntheticExpectedSplitGainsRows(
        period,
        now,
        userExpenses || [],
        userAccounts || [],
        userExpenseSplitRequests?.outgoing || [],
        gainsRenderCache?.sorted || []
    );
}

function filterSyntheticGainsForCurrentFilters(synthetics, { omitPaymentStatus = false } = {}) {
    if (!synthetics?.length) return [];
    const {
        category,
        subcategory,
        accountId,
        paymentStatus,
        description,
        q,
        amountMin,
        amountMax,
        dateFrom,
        dateTo,
        paymentType
    } = gainsFilterState;
    const { accounts, currency } = gainsRenderCache;
    return synthetics.filter((t) => {
        if (category && t.category !== category) return false;
        if (category && subcategory && String(t.subcategory ?? '') !== String(subcategory)) return false;
        if (accountId && t.accountId !== accountId) return false;
        if (!omitPaymentStatus && !movementMatchesPaymentStatus(t, paymentStatus)) return false;
        if (description && description.trim()) {
            const nd = description.trim().toLowerCase();
            if (!String(t.description ?? '').toLowerCase().includes(nd)) return false;
        }
        if (paymentType) {
            const a = accounts.find((x) => x.id === t.accountId);
            if (accountPaymentType(a) !== paymentType) return false;
        }
        if (amountMin != null || amountMax != null) {
            const v = Number(t.amount) || 0;
            if (amountMin != null && v < amountMin) return false;
            if (amountMax != null && v > amountMax) return false;
        }
        if (dateFrom || dateTo) {
            if (!movementMatchesDateRange(t, dateFrom, dateTo)) return false;
        }
        const needle = (q || '').trim().toLowerCase();
        if (needle) {
            const acc = accounts.find((a) => a.id === t.accountId);
            const dateStr = movementDateToJsDate(t.date).toLocaleDateString('pt-BR');
            const categoryDisplay = t.subcategory ? `${t.category} > ${t.subcategory}` : t.category;
            const hay = [
                dateStr,
                String(t.description ?? ''),
                categoryDisplay,
                String(t.category ?? ''),
                String(acc?.name ?? ''),
                formatCurrency(t.amount, currency),
                'a receber',
                'expectativa'
            ]
                .join(' ')
                .toLowerCase();
            if (!hay.includes(needle)) return false;
        }
        return true;
    });
}

function expandExpectedSplitGainsForTable(list, period, now = new Date()) {
    const extra = filterSyntheticGainsForCurrentFilters(computeExpectedSplitGainsRows(period, now));
    if (!extra.length) return list;
    const ids = new Set((list || []).map((t) => String(t.id)));
    const add = extra.filter((r) => !ids.has(String(r.id)));
    return add.length ? [...list, ...add] : list;
}

/** Lista de entradas no período com filtros da página, exceto status Recebido/Pendente. */
function getFilteredGainsListForPendingSummary(period = gainsFilterState.period) {
    return applyGainsFiltersToList(buildGainsListForPeriod(period), { omitPaymentStatus: true });
}

/** Soma entradas ainda não marcadas como recebidas (inclui expectativas de estorno no período). */
function sumPendingGainsForSummary(period, now = new Date()) {
    let list = getFilteredGainsListForPendingSummary(period);
    const extra = filterSyntheticGainsForCurrentFilters(
        computeExpectedSplitGainsRows(period, now),
        { omitPaymentStatus: true }
    );
    const ids = new Set(list.map((t) => String(t.id)));
    const add = extra.filter((r) => !ids.has(String(r.id)));
    if (add.length) list = [...list, ...add];

    let sum = 0;
    for (const t of list) {
        if (!gainCountsInTotals(t)) continue;
        if (t.isPaid !== false) continue;
        sum += Number(t.amount) || 0;
    }
    return sum;
}

function buildGainsListForPeriod(period) {
    const { sorted } = gainsRenderCache;
    const { dateFrom, dateTo } = gainsFilterState;
    return (dateFrom || dateTo)
        ? [...sorted]
        : sorted.filter((t) => movementDateInListPeriod(t.date, period));
}

function buildGainsListForCurrentFilters() {
    return buildGainsListForPeriod(gainsFilterState.period || getDefaultPeriodValue());
}

function applyGainsFiltersToList(list, { omitPaymentStatus = false } = {}) {
    const { accounts, currency } = gainsRenderCache;
    const {
        q,
        category,
        subcategory,
        paymentType,
        paymentStatus,
        description,
        amountMin,
        amountMax,
        dateFrom,
        dateTo,
        accountId
    } = gainsFilterState;
    let out = list;
    if (category) {
        out = out.filter((t) => t.category === category);
    }
    if (category && subcategory) {
        out = out.filter((t) => String(t.subcategory ?? '') === String(subcategory));
    }
    if (accountId) {
        out = out.filter((t) => t.accountId === accountId);
    }
    if (paymentType) {
        out = out.filter(
            (t) => accountPaymentType(accounts.find((a) => a.id === t.accountId)) === paymentType
        );
    }
    if (!omitPaymentStatus) {
        out = out.filter((t) => movementMatchesPaymentStatus(t, paymentStatus));
    }
    if (description && description.trim()) {
        const needleDesc = description.trim().toLowerCase();
        out = out.filter((t) => String(t.description ?? '').toLowerCase().includes(needleDesc));
    }
    if (amountMin != null || amountMax != null) {
        const min = amountMin != null ? Number(amountMin) : null;
        const max = amountMax != null ? Number(amountMax) : null;
        out = out.filter((t) => {
            const v = Number(t.amount) || 0;
            if (min != null && v < min) return false;
            if (max != null && v > max) return false;
            return true;
        });
    }
    if (dateFrom || dateTo) {
        out = out.filter((t) => movementMatchesDateRange(t, dateFrom, dateTo));
    }
    const needle = (q || '').trim().toLowerCase();
    if (needle) {
        out = out.filter((t) => {
            const acc = accounts.find((a) => a.id === t.accountId);
            const dateStr = movementDateToJsDate(t.date).toLocaleDateString('pt-BR');
            const categoryDisplay = t.subcategory
                ? `${t.category} > ${t.subcategory}`
                : t.category;
            const hay = [
                dateStr,
                String(t.description ?? ''),
                categoryDisplay,
                String(t.category ?? ''),
                String(t.subcategory ?? ''),
                String(acc?.name ?? ''),
                formatCurrency(t.amount, currency),
                t.isPaid === false ? 'a receber' : 'recebido',
                t.recurrenceGroupId ? 'recorrente série' : '',
                movementAccountPaymentKindLabel(acc)
            ]
                .join(' ')
                .toLowerCase();
            return hay.includes(needle);
        });
    }
    return out;
}

function updateGainsSummaryCards() {
    const cache = gainsRenderCache;
    if (!cache?.sorted) return;
    readGainsFilterFromDom();
    const ps = gainsFilterState.paymentStatus;
    const { sorted, currency } = cache;
    const now = new Date();
    const period = gainsFilterState.period || getDefaultPeriodValue();
    const isSingleMonth = /^month-\d+$/.test(period);
    const label = getPeriodTitleParts(period, now).label;

    const dashHint = summaryFilterRequiredHintHtml(GAINS_SUMMARY_COPY.filterRequiredHint);

    const gainTitles = gainsSummaryTitles(label);
    setSummaryCardTitle('gains-summary-total', gainTitles.total);
    setSummaryCardTitle('gains-summary-projection', gainTitles.projection);
    setSummaryCardTitle('gains-summary-top-cat', gainTitles.topCategory);

    if (!ps || ps.size === 0) {
        ['gains-summary-total', 'gains-summary-projection'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = dashHint;
        });
        const elTopEmpty = document.getElementById('gains-summary-top-cat');
        if (elTopEmpty) elTopEmpty.textContent = '—';
        ['gains-summary-variation', 'gains-summary-projection-variation', 'gains-summary-top-cat-variation'].forEach(
            (id) => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = dashHint;
            }
        );
        renderGainsTreemap([], currency, label);
        syncGainsFilterButtonHighlight();
        return;
    }

    const months = getMonthKeysInPeriod(period, now);
    const rowsForSummary = getSortedFilteredGainsList();

    let receivedTotal = 0;
    rowsForSummary.forEach((t) => {
        if (!gainCountsInTotals(t)) return;
        const amt = Number(t.amount) || 0;
        if (t.isPaid !== false) receivedTotal += amt;
    });
    const pendingTotal = sumPendingGainsForSummary(period, now);

    const firstMonthParts = months[0].split('-');
    const prevMonthDate = new Date(Number(firstMonthParts[0]), Number(firstMonthParts[1]) - 1 - 1, 1);
    const prevMonthKey = monthKeyFromDateObj(prevMonthDate);
    const periodPrev = `month-${prevMonthDate.getMonth()}`;

    let totalPrevMonthReceived = 0;
    let topCatPrevMonthAmt = 0;
    let totalPrevMonthPending = 0;
    {
        const byCatPrev = new Map();
        sorted.forEach((t) => {
            const d = movementDateToJsDate(t.date);
            if (monthKeyFromDateObj(d) !== prevMonthKey) return;
            if (!gainCountsInTotals(t)) return;
            if (!movementMatchesPaymentStatus(t, ps)) return;
            const amt = Number(t.amount) || 0;
            if (t.isPaid !== false) totalPrevMonthReceived += amt;
            const k = gainTopLevelCategory(t);
            byCatPrev.set(k, (byCatPrev.get(k) || 0) + amt);
        });
        byCatPrev.forEach((amt) => {
            if (amt > topCatPrevMonthAmt) topCatPrevMonthAmt = amt;
        });
    }
    if (isSingleMonth) {
        totalPrevMonthPending = sumPendingGainsForSummary(periodPrev, now);
    }

    const byCat = new Map();
    rowsForSummary.forEach((t) => {
        if (!gainCountsInTotals(t)) return;
        const key = gainTopLevelCategory(t);
        byCat.set(key, (byCat.get(key) || 0) + (Number(t.amount) || 0));
    });
    let topCat = '';
    let topCatAmt = 0;
    byCat.forEach((amt, lbl) => {
        if (amt > topCatAmt) {
            topCatAmt = amt;
            topCat = lbl;
        }
    });

    const elTotal = document.getElementById('gains-summary-total');
    const elProjection = document.getElementById('gains-summary-projection');
    const elTop = document.getElementById('gains-summary-top-cat');
    if (elTotal) elTotal.textContent = formatCurrency(receivedTotal, currency);
    if (elProjection) elProjection.textContent = formatCurrency(pendingTotal, currency);

    if (elTop) {
        elTop.textContent = topCatAmt > 0 && topCat ? topCat : '—';
    }
    setSummaryCardTooltip(
        'gains-summary-top-cat',
        gainsTopCategoryTooltip(topCat, topCatAmt > 0 ? formatCurrency(topCatAmt, currency) : '')
    );

    setMovementSummaryMomVariation(
        document.getElementById('gains-summary-variation'),
        receivedTotal,
        totalPrevMonthReceived,
        isSingleMonth,
        false
    );
    setMovementSummaryMomVariation(
        document.getElementById('gains-summary-projection-variation'),
        pendingTotal,
        totalPrevMonthPending,
        isSingleMonth,
        false
    );
    setMovementSummaryMomVariation(
        document.getElementById('gains-summary-top-cat-variation'),
        topCatAmt,
        topCatPrevMonthAmt,
        isSingleMonth,
        false
    );

    renderGainsTreemap(rowsForSummary, currency, label);

    setSummaryCardTooltip('gains-summary-projection', GAINS_SUMMARY_COPY.projection);

    syncGainsFilterButtonHighlight();
}

function syncExpensesFilterButtonHighlight() {
    readExpensesFilterFromDom();
    const ps = expensesFilterState.paymentStatus;
    const active =
        Boolean(expensesFilterState.q?.trim()) ||
        Boolean(expensesFilterState.category) ||
        Boolean(expensesFilterState.subcategory) ||
        Boolean(expensesFilterState.paymentType) ||
        Boolean(expensesFilterState.description?.trim()) ||
        Boolean(expensesFilterState.accountId) ||
        (ps && ps.size > 0) ||
        (expensesFilterState.quickExpenseTypes && expensesFilterState.quickExpenseTypes.size > 0) ||
        (expensesFilterState.period && !isDefaultPeriodValue(expensesFilterState.period));
    document.getElementById('expenses-filter-open-btn')?.classList.toggle('filter-drawer-trigger--active', active);
}

function syncGainsFilterButtonHighlight() {
    readGainsFilterFromDom();
    const ps = gainsFilterState.paymentStatus;
    const active =
        Boolean(gainsFilterState.q?.trim()) ||
        Boolean(gainsFilterState.category) ||
        Boolean(gainsFilterState.subcategory) ||
        Boolean(gainsFilterState.paymentType) ||
        Boolean(gainsFilterState.description?.trim()) ||
        Boolean(gainsFilterState.accountId) ||
        (ps && ps.size > 0) ||
        (gainsFilterState.period && !isDefaultPeriodValue(gainsFilterState.period));
    document.getElementById('gains-filter-open-btn')?.classList.toggle('filter-drawer-trigger--active', active);
}

function getFilteredExpensesList() {
    const { sorted, accounts, currency, userProfile } = expensesRenderCache;
    const {
        q,
        category,
        subcategory,
        paymentType,
        paymentStatus,
        description,
        amountMin,
        amountMax,
        dateFrom,
        dateTo,
        accountId,
        period
    } = expensesFilterState;
    // Período é o filtro principal; só é ignorado quando o usuário seleciona Data (de/até).
    let list = (dateFrom || dateTo)
        ? [...sorted]
        : sorted.filter((t) => expenseMatchesListPeriod(t, period));
    if (category) {
        list = list.filter((t) => t.category === category);
    }
    if (category && subcategory) {
        list = list.filter((t) => String(t.subcategory ?? '') === String(subcategory));
    }
    if (accountId) {
        list = list.filter((t) => t.accountId === accountId);
    }
    if (paymentType) {
        list = list.filter((t) => accountPaymentType(accounts.find((a) => a.id === t.accountId)) === paymentType);
    }
    list = list.filter((t) =>
        movementMatchesPaymentStatus(t, paymentStatus, {
            kind: 'expense',
            accounts
        })
    );
    list = list.filter((t) => expenseMatchesQuickTypeFilters(t, accounts));
    if (description && description.trim()) {
        const needleDesc = description.trim().toLowerCase();
        list = list.filter((t) => String(t.description ?? '').toLowerCase().includes(needleDesc));
    }
    if (amountMin != null || amountMax != null) {
        const min = amountMin != null ? Number(amountMin) : null;
        const max = amountMax != null ? Number(amountMax) : null;
        list = list.filter((t) => {
            const acc = accounts.find((a) => a.id === t.accountId);
            const v = getExpenseAmountForFilter(t, acc);
            if (min != null && v < min) return false;
            if (max != null && v > max) return false;
            return true;
        });
    }
    if (dateFrom || dateTo) {
        list = list.filter((t) => movementMatchesDateRange(t, dateFrom, dateTo));
    }
    const needle = q.trim().toLowerCase();
    if (needle) {
        const listPeriodPlain = getExpensesInstallmentListPeriodForPlainText();
        list = list.filter((t) => {
            const acc = accounts.find((a) => a.id === t.accountId);
            const dateStr = movementDateToJsDate(t.date).toLocaleDateString('pt-BR');
            const ic = t.installmentCount;
            const parcelasLbl = ic != null && Number(ic) >= 1 ? `${Number(ic)}x` : '';
            const statusTxt = formatInstallmentStatusPlain(t, acc, new Date(), userProfile, listPeriodPlain);
            const categoryDisplay = t.subcategory 
                ? `${t.category} > ${t.subcategory}` 
                : t.category;
            const displayAmt = getExpensePerInstallmentDisplayAmount(t, acc);
            const bracketCredit =
                acc && isCreditCardType(acc.type) && listPeriodPlain
                    ? expenseCreditInstallmentBracketSuffix(t, acc, userProfile, new Date(), listPeriodPlain)
                    : '';
            const hay = [
                dateStr,
                String(t.description ?? ''),
                categoryDisplay,
                String(t.category ?? ''),
                String(t.subcategory ?? ''),
                String(acc?.name ?? ''),
                formatCurrency(t.amount, currency),
                formatCurrency(displayAmt, currency),
                t.isInvestment ? 'investimento' : '',
                t.isPaid ? 'pago' : 'parcelado',
                parcelasLbl,
                statusTxt,
                movementAccountPaymentKindLabel(acc),
                expenseIsMarkedFixed(t) ? 'sim essencial despesa essencial' : 'não variável não essencial',
                bracketCredit.trim()
            ]
                .join(' ')
                .toLowerCase();
            return hay.includes(needle);
        });
    }
    return list;
}

function populateExpenseFilterSelects() {
    const { sorted, accounts } = expensesRenderCache;
    const catSel = document.getElementById('expenses-filter-category');
    const subSel = document.getElementById('expenses-filter-subcategory');
    const subRow = document.getElementById('expenses-filter-subcategory-row');
    const accSel = document.getElementById('expenses-filter-account');
    if (!catSel || !accSel) return;
    const prevCat = catSel.value;
    const prevSub = subSel?.value || '';
    const prevAcc = accSel.value;
    const period = expensesFilterState.period || getDefaultPeriodValue();
    const inPeriod = sorted.filter((t) => expenseMatchesListPeriod(t, period));
    const dfEl = document.getElementById('expenses-filter-date-from');
    const dtEl = document.getElementById('expenses-filter-date-to');
    const manual = dfEl?.dataset?.manual === '1' || dtEl?.dataset?.manual === '1';
    const dateFrom = manual ? dfEl?.value || '' : '';
    const dateTo = manual ? dtEl?.value || '' : '';
    const baseList = (dateFrom || dateTo) ? sorted.filter((t) => movementMatchesDateRange(t, dateFrom, dateTo)) : inPeriod;
    const cats = [
        ...new Set(baseList.map((t) => String(t.category ?? '').trim()).filter((c) => c))
    ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
    catSel.innerHTML = '<option value="">Todas as categorias</option>';
    cats.forEach((c) => {
        const o = document.createElement('option');
        o.value = c;
        o.textContent = c;
        catSel.appendChild(o);
    });
    if (cats.includes(prevCat)) catSel.value = prevCat;

    if (subSel && subRow) {
        const cat = catSel.value;
        const subs = cat
            ? [
                  ...new Set(
                      baseList
                          .filter((t) => String(t.category ?? '') === cat)
                          .map((t) => String(t.subcategory ?? '').trim())
                          .filter((s) => s)
                  )
              ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
            : [];
        subSel.innerHTML = '<option value="">Todas as subcategorias</option>';
        subs.forEach((s) => {
            const o = document.createElement('option');
            o.value = s;
            o.textContent = s;
            subSel.appendChild(o);
        });
        subRow.classList.toggle('hidden', !cat || subs.length === 0);
        if (subs.includes(prevSub)) subSel.value = prevSub;
        else subSel.value = '';
    }

    const accIds = [...new Set(baseList.map((t) => t.accountId).filter(Boolean))];
    const accList = accIds
        .map((id) => accounts.find((a) => a.id === id))
        .filter(Boolean)
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
    accSel.innerHTML = '<option value="">Todas as contas</option>';
    accList.forEach((a) => {
        const o = document.createElement('option');
        o.value = a.id;
        o.textContent = a.name;
        accSel.appendChild(o);
    });
    if (accIds.includes(prevAcc)) accSel.value = prevAcc;

    // Bounds do slider de valor (baseado no conjunto atual: período OU data de/até)
    initAmountRangeBounds('expenses-filter', baseList, expensesRenderCache.currency, accounts);
}

function applyExpensesFilters() {
    readExpensesFilterFromDom();
    populateExpenseFilterSelects();
    readExpensesFilterFromDom();
    syncRangeLabels('expenses-filter', expensesRenderCache.currency);
    persistPortalExpensePaymentStatusToStorage();
    if (!expensesPagination) return;
    expensesPagination.setTotal(getSortedFilteredExpensesList().length, { resetPage: true });
    renderExpensesBodySlice();
    updateExpensesSummaryCards();
    syncExpensesQuickStatusButtonsFromCheckboxes();
    syncExpensesFilterButtonHighlight();
}

function getSortedFilteredExpensesList() {
    const filtered = getFilteredExpensesList();
    const { accounts, userProfile } = expensesRenderCache;
    const expanded = expandInstallmentRowsForExpensesTable(filtered, accounts, userProfile);
    return sortExpenseRows(expanded, expensesSort, accounts);
}

function renderExpensesBodySlice() {
    const list = getSortedFilteredExpensesList();
    renderExpensesBodySliceWithList(list);
}

function renderExpensesBodySliceWithList(list) {
    const tbody = document.querySelector('#expenses-table tbody');
    if (!tbody || !expensesPagination) return;
    const { accounts, currency, userProfile, sorted: allExpensesForSplit } = expensesRenderCache;
    const { start, end } = expensesPagination.getSliceRange();
    const monthRing = isExpensesInstallmentMonthRingMode();
    const listPeriodMonth = monthRing ? getExpensesFilterListPeriod() : null;
    const now = new Date();
    const acceptedSplits = getOutgoingAcceptedSettledSplits();
    const acceptedSplitById = new Map(
        ([
            ...(userExpenseSplitRequests?.incoming || []),
            ...(userExpenseSplitRequests?.outgoing || [])
        ] || [])
            .filter((s) => s && String(s.status ?? '').toUpperCase() === 'ACCEPTED')
            .map((s) => [String(s.id), s])
    );
    const splitRequestIdByRecGroup = new Map();
    for (const row of list) {
        if (row && row.recurrenceGroupId && row.splitRequestId) {
            splitRequestIdByRecGroup.set(String(row.recurrenceGroupId), String(row.splitRequestId));
        }
    }
    tbody.innerHTML = '';
    list.slice(start, end).forEach((t) => {
        const account = accounts.find((acc) => acc.id === t.accountId);
        const tr = document.createElement('tr');
        if (t.__instRow) tr.classList.add('expense-tr-installment');
        const rowCls = t.isInvestment ? 'investimento' : 'despesa';
        const splitRidForRow =
            t.splitRequestId ||
            (t.recurrenceGroupId
                ? splitRequestIdByRecGroup.get(String(t.recurrenceGroupId))
                : null) ||
            null;
        const relatedSplit = splitRidForRow ? acceptedSplitById.get(String(splitRidForRow)) : null;
        const grossForRelatedSplit = relatedSplit?.sourceExpense?.amount;

        if (t.__instRow) {
            const dateStr = t.__instEmptyPeriod
                ? movementDateToJsDate(t.date).toLocaleDateString('pt-BR')
                : t.__instDueDate.toLocaleDateString('pt-BR');
            const descSuffix = (() => {
                if (t.__instEmptyPeriod) return '';
                if (account && isCreditCardType(account.type)) {
                    return ` (${t.__instParcelIndex} de ${t.__instParcelTotal})`;
                }
                return ` · Parcela ${t.__instParcelIndex}/${t.__instParcelTotal}`;
            })();
            let statusCell;
            if (t.__instEmptyPeriod) {
                statusCell = '<span class="expense-status-badge expense-status-badge--pending">Pendente</span>';
            } else if (t.__instParcelPaid) {
                const eidP = htmlAttrEscape(String(t.id));
                const ik = htmlAttrEscape(String(t.__instPeriodKey ?? ''));
                statusCell = `<button type="button" class="expense-status-badge expense-status-badge--paid expense-paid-toggle" data-expense-id="${eidP}" data-paid-toggle-mode="inst-row-period-unconfirm" data-inst-period-key="${ik}" title="${htmlAttrEscape('Clique para desfazer confirmação no caixa para esta parcela')}" aria-label="${htmlAttrEscape('Desfazer pagamento registado no caixa desta parcela')}">Pago</button>`;
            } else if (
                t.__instDueDate &&
                canConfirmInstallmentPeriodForCashOut(t, account, t.__instDueDate, userProfile, now)
            ) {
                const eid = escapeHtml(String(t.id));
                const pk = escapeHtml(String(t.__instPeriodKey));
                statusCell = `<button type="button" class="expense-status-badge expense-status-badge--pay expense-inst-confirm-btn" data-expense-id="${eid}" data-period-key="${pk}" title="Registrar pagamento no caixa">Pagar</button>`;
            } else if (t.__instDueDate && t.__instPeriodKey) {
                const eid = escapeHtml(String(t.id));
                const pk = escapeHtml(String(t.__instPeriodKey));
                statusCell = `<button type="button" class="expense-status-badge expense-status-badge--pending expense-inst-confirm-btn" data-expense-id="${eid}" data-period-key="${pk}" title="Confirmar pagamento no caixa (abre confirmação)" aria-label="Confirmar pagamento no caixa desta parcela">Pendente</button>`;
            } else {
                statusCell = '<span class="expense-status-badge expense-status-badge--pending">Pendente</span>';
            }
            const categoryDisplay = t.subcategory ? `${t.category} > ${t.subcategory}` : t.category;
            const paymentKindText = escapeHtml(movementAccountPaymentKindLabel(account));
            const displayAmt = applySplitNetToContribution(
                t,
                t.__instPeriodKey,
                t.__instParcelAmount,
                acceptedSplits,
                allExpensesForSplit
            );
            const totalAmt = Number(t.amount) || 0;
            const amountTitle = totalAmt > 0 ? ` title="Total do contrato: ${formatCurrency(totalAmt, currency)}"` : '';
            const instRecBadge = buildExpenseInstallmentRowRecBadgeSpan(t);
            const amountHtmlInstBase = `<span class="movement-amount-with-rec-inner">${instRecBadge}${formatCurrency(displayAmt, currency)}</span>`;
            const instGross =
                grossForRelatedSplit != null && Number.isFinite(Number(grossForRelatedSplit)) && t.__instParcelTotal >= 2
                    ? Number(grossForRelatedSplit) / Number(t.__instParcelTotal)
                    : Number(t.__instParcelAmount) || 0;
            const showSplitStrike = displayAmt < instGross - 0.0001;
            const amountHtmlInst = showSplitStrike
                ? `<span class="expense-split-amount-stack"><span class="expense-split-net-amount">${amountHtmlInstBase}</span><span class="expense-split-gross-strike" title="Valor original antes do rateio">${formatCurrency(instGross, currency)}</span></span>`
                : amountHtmlInstBase;
            const eidAttr = htmlAttrEscape(String(t.id));
            tr.innerHTML = `
            <td class="expenses-td-batch"><label class="expense-batch-row-hit"><span class="sr-only">Selecionar para edição em lote</span><input type="checkbox" class="expense-batch-check" data-expense-id="${eidAttr}"></label></td>
            <td>${dateStr}</td>
            <td>${buildTruncatedTableCellHtml(`${t.description ?? ''}${descSuffix ?? ''}`)}</td>
            <td>${escapeHtml(categoryDisplay)}</td>
            <td>${escapeHtml(account?.name || 'N/A')}</td>
            <td>${paymentKindText}</td>
            <td class="expenses-td-fixed">${expenseFixedCellHtmlForTable(t)}</td>
            <td class="expenses-td-status">${statusCell}</td>
            <td class="${rowCls}"${amountTitle}>${amountHtmlInst}</td>
            <td class="transaction-actions">
                <div class="transaction-actions__inner">
                    <button type="button" class="btn-action btn-split" data-id="${t.id}" data-split-scope="INSTALLMENT" data-target-installment-index="${t.__instParcelIndex}" data-target-period-key="${escapeHtml(String(t.__instPeriodKey || ''))}" title="Dividir esta parcela"><i class="fas fa-users"></i></button>
                    <button class="btn-action btn-edit" data-id="${t.id}" title="Editar lançamento completo"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-action btn-delete" data-id="${t.id}" title="Excluir"><i class="fas fa-trash-alt"></i></button>
                </div>
            </td>`;
            tbody.appendChild(tr);
            return;
        }

        const splitBtn = canSplitExpenseClient(t)
            ? `<button type="button" class="btn-action btn-split" data-id="${t.id}" data-split-scope="FULL_EXPENSE" title="Dividir com outro usuário"><i class="fas fa-users"></i></button>`
            : '';

        const ic = t.installmentCount;
        const nParc = parseInt(String(ic ?? ''), 10);
        const cardOrLoanInstallment =
            (account && isCreditCardType(account.type)) ||
            (isLoanExpense(t) && (!account || !isCreditCardType(account.type)) && Number.isFinite(nParc) && nParc >= 2);

        let statusCell;
        if (expenseUsesMonthlyFixedCashListUi(t, account, userProfile)) {
            statusCell = formatMonthlyFixedCashListStatusHtml(t, account, userProfile, now);
        } else if (
            monthRing &&
            (cardOrLoanInstallment || (Number.isFinite(nParc) && nParc >= 2))
        ) {
            statusCell = formatExpenseTableStatusBadgeHtml(t, account, userProfile, now, listPeriodMonth);
        } else {
            statusCell = expenseTableBatchPaidToggleButton(t);
        }
        const creditInstallSuffix =
            monthRing && listPeriodMonth
                ? expenseCreditInstallmentBracketSuffix(t, account, userProfile, now, listPeriodMonth)
                : '';
        const descriptionHtml = buildTruncatedTableCellHtml(
            `${t.description ?? ''}${creditInstallSuffix ?? ''}`
        );
        const displayAmt = applySplitNetToContribution(
            t,
            movementMonthKey(t.date),
            getExpensePerInstallmentDisplayAmount(t, account),
            acceptedSplits,
            allExpensesForSplit
        );
        const totalAmt = Number(t.amount) || 0;
        const netTotalAmt = getNetExpenseTotalAmount(t, acceptedSplits, allExpensesForSplit);
        // Mostra "total riscado + líquido" tanto para quem pagou (split líquido) quanto para quem recebeu (splitRequestId).
        const showSplitNet =
            (netTotalAmt < totalAmt - 0.0001) ||
            (grossForRelatedSplit != null &&
                Number.isFinite(Number(grossForRelatedSplit)) &&
                Number(grossForRelatedSplit) > totalAmt + 0.0001);
        const amountTitle =
            displayAmt !== totalAmt && totalAmt > 0
                ? ` title="Total da compra/contrato: ${formatCurrency(totalAmt, currency)}"`
                : '';
        const recMeta = getExpenseRecurrenceBadgeMeta(t, account);
        const recBadge = buildExpenseRecurrenceBadgeSpan(t, account);
        const amountHtmlBase = recMeta.show
            ? `<span class="movement-amount-with-rec-inner">${recBadge}${formatCurrency(displayAmt, currency)}</span>`
            : formatCurrency(displayAmt, currency);
        const grossShown =
            grossForRelatedSplit != null && Number.isFinite(Number(grossForRelatedSplit)) && Number(grossForRelatedSplit) > 0
                ? Number(grossForRelatedSplit)
                : totalAmt;
        const amountHtml = showSplitNet
            ? `<span class="expense-split-amount-stack"><span class="expense-split-net-amount">${amountHtmlBase}</span><span class="expense-split-gross-strike" title="Valor bruto / original">${formatCurrency(grossShown, currency)}</span></span>`
            : amountHtmlBase;
        const eidAttrNorm = htmlAttrEscape(String(t.id));
        const categoryDisplay = t.subcategory ? `${t.category} > ${t.subcategory}` : t.category;
        const paymentKindText = escapeHtml(movementAccountPaymentKindLabel(account));
        tr.innerHTML = `
            <td class="expenses-td-batch"><label class="expense-batch-row-hit"><span class="sr-only">Selecionar para edição em lote</span><input type="checkbox" class="expense-batch-check" data-expense-id="${eidAttrNorm}"></label></td>
            <td>${movementDateToJsDate(t.date).toLocaleDateString('pt-BR')}</td>
            <td>${descriptionHtml}</td>
            <td>${escapeHtml(categoryDisplay)}</td>
            <td>${escapeHtml(account?.name || 'N/A')}</td>
            <td>${paymentKindText}</td>
            <td class="expenses-td-fixed">${expenseFixedCellHtmlForTable(t)}</td>
            <td class="expenses-td-status">${statusCell}</td>
            <td class="${rowCls}"${amountTitle}>${amountHtml}</td>
            <td class="transaction-actions">
                <div class="transaction-actions__inner">
                    ${splitBtn}
                    <button class="btn-action btn-edit" data-id="${t.id}" title="Editar"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-action btn-delete" data-id="${t.id}" title="Excluir"><i class="fas fa-trash-alt"></i></button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
    syncExpensesBatchToolbar();
}

export function loadExpensesData(expenses, accounts, currency, userProfile = null) {
    const sorted = [...(expenses || [])].sort(
        (a, b) => movementDateToUnixSeconds(b.date) - movementDateToUnixSeconds(a.date)
    );
    expensesRenderCache = { sorted, accounts, currency, userProfile: userProfile ?? null };
    hydratePortalExpensePaymentStatusFromStorage();
    syncDrawerDateInputsToPeriod('expenses-filter', document.getElementById('expenses-period-filter')?.value);
    readExpensesFilterFromDom();
    populateExpenseFilterSelects();
    readExpensesFilterFromDom();

    const bar = document.getElementById('expenses-pagination');
    if (!expensesPagination && bar) {
        expensesPagination = new TablePaginationController(bar, {
            storageKey: 'expenses',
            onChange: () => renderExpensesBodySlice()
        });
    }
    if (expensesPagination) {
        expensesPagination.setTotal(getSortedFilteredExpensesList().length);
    }
    syncSortableTableHeaders(document.getElementById('expenses-table'), expensesSort, [
        'date',
        'amount',
        'payment',
        'isFixed',
        'status'
    ]);
    renderExpensesBodySlice();
    updateExpensesSummaryCards();
    renderOutgoingSplitsPanel(currency);
    syncExpensesQuickStatusButtonsFromCheckboxes();
    syncExpensesFilterButtonHighlight();
}

function readGainsFilterFromDom() {
    gainsFilterState.q = document.getElementById('gains-filter-q')?.value || '';
    gainsFilterState.category = document.getElementById('gains-filter-category')?.value || '';
    gainsFilterState.subcategory = document.getElementById('gains-filter-subcategory')?.value || '';
    gainsFilterState.paymentType = document.getElementById('gains-filter-payment-type')?.value || '';
    gainsFilterState.paymentStatus = new Set();
    if (document.getElementById('gains-filter-status-received')?.checked) gainsFilterState.paymentStatus.add('paid');
    if (document.getElementById('gains-filter-status-pending')?.checked) gainsFilterState.paymentStatus.add('unpaid');
    gainsFilterState.description = document.getElementById('gains-filter-description')?.value || '';
    const amin = document.getElementById('gains-filter-amount-min')?.value;
    const amax = document.getElementById('gains-filter-amount-max')?.value;
    gainsFilterState.amountMin = amin != null && amin !== '' ? Number(amin) : null;
    gainsFilterState.amountMax = amax != null && amax !== '' ? Number(amax) : null;
    const df = document.getElementById('gains-filter-date-from');
    const dt = document.getElementById('gains-filter-date-to');
    const manual = df?.dataset?.manual === '1' || dt?.dataset?.manual === '1';
    gainsFilterState.dateFrom = manual ? df?.value || '' : '';
    gainsFilterState.dateTo = manual ? dt?.value || '' : '';
    gainsFilterState.accountId = document.getElementById('gains-filter-account')?.value || '';
    gainsFilterState.period = document.getElementById('gains-period-filter')?.value || getDefaultPeriodValue();
}

/** Zera filtros do drawer (exceto período) — botão «limpar». */
function resetGainsDrawerFiltersKeepPeriod() {
    const q = document.getElementById('gains-filter-q');
    const c = document.getElementById('gains-filter-category');
    const sc = document.getElementById('gains-filter-subcategory');
    const pt = document.getElementById('gains-filter-payment-type');
    const recvSt = document.getElementById('gains-filter-status-received');
    const pendSt = document.getElementById('gains-filter-status-pending');
    const desc = document.getElementById('gains-filter-description');
    const amin = document.getElementById('gains-filter-amount-min');
    const amax = document.getElementById('gains-filter-amount-max');
    const df = document.getElementById('gains-filter-date-from');
    const dt = document.getElementById('gains-filter-date-to');
    const a = document.getElementById('gains-filter-account');
    if (q) q.value = '';
    if (c) c.value = '';
    if (sc) sc.value = '';
    if (pt) pt.value = '';
    if (recvSt) recvSt.checked = false;
    if (pendSt) pendSt.checked = false;
    if (desc) desc.value = '';
    if (amin) amin.value = '';
    if (amax) amax.value = '';
    if (amin) amin.dataset.manual = '0';
    if (amax) amax.dataset.manual = '0';
    if (df) df.dataset.manual = '0';
    if (dt) dt.dataset.manual = '0';
    if (a) a.value = '';
    syncGainsQuickStatusButtonsFromCheckboxes();
}

function toLocalDateInputValue(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function syncDrawerDateInputsToPeriod(prefix, periodValue) {
    const df = document.getElementById(`${prefix}-date-from`);
    const dt = document.getElementById(`${prefix}-date-to`);
    if (!df || !dt) return;
    const manual = df.dataset.manual === '1' || dt.dataset.manual === '1';
    if (manual) return; // usuário assumiu controle do filtro de data
    const now = new Date();
    const { startDate, endDate } = getPeriodDateBounds(periodValue || getDefaultPeriodValue(), now);
    // Não usar toISOString() — em fusos como America/Sao_Paulo o dia pode “voltar” um dia.
    df.value = toLocalDateInputValue(startDate);
    dt.value = toLocalDateInputValue(endDate);
    df.dataset.manual = '0';
    dt.dataset.manual = '0';
}

function movementMatchesDateRange(t, fromStr, toStr) {
    if (!fromStr && !toStr) return true;
    const d = movementDateToJsDate(t.date);
    if (fromStr) {
        const from = new Date(fromStr + 'T00:00:00');
        if (d.getTime() < from.getTime()) return false;
    }
    if (toStr) {
        const to = new Date(toStr + 'T23:59:59');
        if (d.getTime() > to.getTime()) return false;
    }
    return true;
}

function accountPaymentType(acc) {
    const t = String(acc?.type ?? '').toLowerCase();
    if (!t) return 'other';
    if (isCreditCardType(t)) return 'credit';
    if (t.includes('debito')) return 'debit';
    if (t.includes('dinheiro') || t.includes('cash')) return 'cash';
    if (t.includes('conta') || t.includes('banco') || t.includes('corrente') || t.includes('poup')) return 'bank';
    return 'other';
}

function clampRangePair(minV, maxV) {
    const a = Number(minV);
    const b = Number(maxV);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return { min: minV, max: maxV };
    if (a <= b) return { min: a, max: b };
    return { min: b, max: a };
}

function syncRangeLabels(prefix, currency) {
    const minEl = document.getElementById(`${prefix}-amount-min`);
    const maxEl = document.getElementById(`${prefix}-amount-max`);
    const minLbl = document.getElementById(`${prefix}-amount-min-label`);
    const maxLbl = document.getElementById(`${prefix}-amount-max-label`);
    if (!minEl || !maxEl || !minLbl || !maxLbl) return;
    const { min, max } = clampRangePair(minEl.value, maxEl.value);
    if (Number.isFinite(min)) minEl.value = String(min);
    if (Number.isFinite(max)) maxEl.value = String(max);
    minLbl.textContent = Number.isFinite(min) ? formatCurrency(min, currency) : '';
    maxLbl.textContent = Number.isFinite(max) ? formatCurrency(max, currency) : '';
}

function getFilteredGainsList() {
    return applyGainsFiltersToList(buildGainsListForCurrentFilters());
}

function populateGainFilterSelects() {
    const { sorted, accounts } = gainsRenderCache;
    const catSel = document.getElementById('gains-filter-category');
    const subSel = document.getElementById('gains-filter-subcategory');
    const subRow = document.getElementById('gains-filter-subcategory-row');
    const accSel = document.getElementById('gains-filter-account');
    if (!catSel || !accSel) return;
    const prevCat = catSel.value;
    const prevSub = subSel?.value || '';
    const prevAcc = accSel.value;
    const period = gainsFilterState.period || getDefaultPeriodValue();
    const inPeriod = sorted.filter((t) => movementDateInListPeriod(t.date, period));
    const dfEl = document.getElementById('gains-filter-date-from');
    const dtEl = document.getElementById('gains-filter-date-to');
    const manual = dfEl?.dataset?.manual === '1' || dtEl?.dataset?.manual === '1';
    const dateFrom = manual ? dfEl?.value || '' : '';
    const dateTo = manual ? dtEl?.value || '' : '';
    const baseList = (dateFrom || dateTo) ? sorted.filter((t) => movementMatchesDateRange(t, dateFrom, dateTo)) : inPeriod;
    const cats = [
        ...new Set(baseList.map((t) => String(t.category ?? '').trim()).filter((c) => c))
    ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
    catSel.innerHTML = '<option value="">Todas as categorias</option>';
    cats.forEach((c) => {
        const o = document.createElement('option');
        o.value = c;
        o.textContent = c;
        catSel.appendChild(o);
    });
    if (cats.includes(prevCat)) catSel.value = prevCat;

    if (subSel && subRow) {
        const cat = catSel.value;
        const subs = cat
            ? [
                  ...new Set(
                      baseList
                          .filter((t) => String(t.category ?? '') === cat)
                          .map((t) => String(t.subcategory ?? '').trim())
                          .filter((s) => s)
                  )
              ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
            : [];
        subSel.innerHTML = '<option value="">Todas as subcategorias</option>';
        subs.forEach((s) => {
            const o = document.createElement('option');
            o.value = s;
            o.textContent = s;
            subSel.appendChild(o);
        });
        subRow.classList.toggle('hidden', !cat || subs.length === 0);
        if (subs.includes(prevSub)) subSel.value = prevSub;
        else subSel.value = '';
    }

    const accIds = [...new Set(baseList.map((t) => t.accountId).filter(Boolean))];
    const accList = accIds
        .map((id) => accounts.find((a) => a.id === id))
        .filter(Boolean)
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
    accSel.innerHTML = '<option value="">Todas as contas</option>';
    accList.forEach((a) => {
        const o = document.createElement('option');
        o.value = a.id;
        o.textContent = a.name;
        accSel.appendChild(o);
    });
    if (accIds.includes(prevAcc)) accSel.value = prevAcc;

    initAmountRangeBounds('gains-filter', baseList, gainsRenderCache.currency, accounts);
}

function parseNumericAmount(v) {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s0 = String(v).trim();
    if (!s0) return null;
    // pt-BR: "1.234,56" → 1234.56
    const hasComma = s0.includes(',');
    const s = hasComma ? s0.replace(/\./g, '').replace(',', '.') : s0;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

function roundMoney2(v) {
    return Math.round((Number(v) || 0) * 100) / 100;
}

/** Mesmo critério usado na lista e no filtro por faixa de valor. */
function getExpenseAmountForFilter(t, account) {
    let v = getExpensePerInstallmentDisplayAmount(t, account);
    if (!Number.isFinite(v)) v = parseNumericAmount(t.amount);
    if (!Number.isFinite(v)) v = Number(t.amount) || 0;
    const splits = getOutgoingAcceptedSettledSplits();
    return roundMoney2(
        applySplitNetToContribution(
            t,
            movementMonthKey(t.date),
            v,
            splits,
            userExpenses || expensesRenderCache?.sorted
        )
    );
}

function initAmountRangeBounds(prefix, list, currency, accounts) {
    const minEl = document.getElementById(`${prefix}-amount-min`);
    const maxEl = document.getElementById(`${prefix}-amount-max`);
    if (!minEl || !maxEl) return;
    const isExpense = prefix.startsWith('expenses-');
    const accList = accounts || userAccounts || [];
    const values = (list || [])
        .map((t) => {
            if (isExpense) {
                const acc = accList.find((a) => a.id === t.accountId);
                return getExpenseAmountForFilter(t, acc);
            }
            return roundMoney2((parseNumericAmount(t.amount) ?? Number(t.amount)) || 0);
        })
        .filter((v) => Number.isFinite(v));

    if (!values.length) {
        minEl.min = '0';
        minEl.max = '0';
        maxEl.min = '0';
        maxEl.max = '0';
        minEl.step = '0.01';
        maxEl.step = '0.01';
        minEl.value = '0';
        maxEl.value = '0';
        syncRangeLabels(prefix, currency);
        return;
    }

    let minV = Math.min(...values);
    let maxV = Math.max(...values);
    minV = roundMoney2(minV);
    maxV = roundMoney2(maxV);
    if (minV === maxV) {
        const pad = minV > 0 ? Math.min(0.01, minV) : 0.01;
        minV = roundMoney2(Math.max(0, minV - pad));
        maxV = roundMoney2(maxV + pad);
    }

    const minBound = minV;
    const maxBound = maxV;

    minEl.min = String(minBound);
    minEl.max = String(maxBound);
    maxEl.min = String(minBound);
    maxEl.max = String(maxBound);
    minEl.step = '0.01';
    maxEl.step = '0.01';

    const manual = minEl.dataset.manual === '1' || maxEl.dataset.manual === '1';
    let curMin = parseNumericAmount(minEl.value);
    let curMax = parseNumericAmount(maxEl.value);

    if (!manual || curMin == null || curMax == null) {
        // Estado inicial: range completo.
        minEl.value = String(minBound);
        maxEl.value = String(maxBound);
    } else {
        // Preserva a interação do usuário e apenas limita ao novo bound.
        curMin = Math.min(maxBound, Math.max(minBound, curMin));
        curMax = Math.min(maxBound, Math.max(minBound, curMax));
        const pair = clampRangePair(curMin, curMax);
        minEl.value = String(pair.min);
        maxEl.value = String(pair.max);
    }
    syncRangeLabels(prefix, currency);
}

function applyGainsFilters() {
    readGainsFilterFromDom();
    populateGainFilterSelects();
    readGainsFilterFromDom();
    syncRangeLabels('gains-filter', gainsRenderCache.currency);
    persistPortalGainPaymentStatusToStorage();
    if (!gainsPagination) return;
    gainsPagination.setTotal(getSortedFilteredGainsList().length, { resetPage: true });
    renderGainsBodySlice();
    updateGainsSummaryCards();
    syncGainsQuickStatusButtonsFromCheckboxes();
    syncGainsFilterButtonHighlight();
}

function initMovementFilterDrawerEvents() {
    const exp = [
        'expenses-filter-q',
        'expenses-filter-category',
        'expenses-filter-subcategory',
        'expenses-filter-payment-type',
        'expenses-filter-status-paid',
        'expenses-filter-status-pending',
        'expenses-filter-description',
        'expenses-filter-amount-min',
        'expenses-filter-amount-max',
        'expenses-filter-account'
    ];
    exp.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener(id.includes('q') || id.includes('description') ? 'input' : 'change', () => {
            applyExpensesFilters();
        });
        if (id.includes('amount-')) {
            el.addEventListener('input', () => {
                const minEl = document.getElementById('expenses-filter-amount-min');
                const maxEl = document.getElementById('expenses-filter-amount-max');
                if (minEl) minEl.dataset.manual = '1';
                if (maxEl) maxEl.dataset.manual = '1';
                applyExpensesFilters();
            });
        }
    });
    // Período global controla o default do filtro de data (visual); ao mudar o período, volta a seguir o global
    document.getElementById('expenses-period-filter')?.addEventListener('change', () => {
        const df = document.getElementById('expenses-filter-date-from');
        const dt = document.getElementById('expenses-filter-date-to');
        if (df) df.dataset.manual = '0';
        if (dt) dt.dataset.manual = '0';
        syncDrawerDateInputsToPeriod('expenses-filter', document.getElementById('expenses-period-filter')?.value);
    });
    // Quando usuário muda date-from/to, ativa filtro manual de data
    const expDf = document.getElementById('expenses-filter-date-from');
    const expDt = document.getElementById('expenses-filter-date-to');
    const markExpManual = () => {
        if (expDf) expDf.dataset.manual = '1';
        if (expDt) expDt.dataset.manual = '1';
    };
    expDf?.addEventListener('change', () => {
        markExpManual();
        applyExpensesFilters();
    });
    expDt?.addEventListener('change', () => {
        markExpManual();
        applyExpensesFilters();
    });

    const gains = [
        'gains-filter-q',
        'gains-filter-category',
        'gains-filter-subcategory',
        'gains-filter-payment-type',
        'gains-filter-status-received',
        'gains-filter-status-pending',
        'gains-filter-description',
        'gains-filter-amount-min',
        'gains-filter-amount-max',
        'gains-filter-account'
    ];
    gains.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener(id.includes('q') || id.includes('description') ? 'input' : 'change', () => {
            applyGainsFilters();
        });
        if (id.includes('amount-')) {
            el.addEventListener('input', () => {
                const minEl = document.getElementById('gains-filter-amount-min');
                const maxEl = document.getElementById('gains-filter-amount-max');
                if (minEl) minEl.dataset.manual = '1';
                if (maxEl) maxEl.dataset.manual = '1';
                applyGainsFilters();
            });
        }
    });
    document.getElementById('gains-period-filter')?.addEventListener('change', () => {
        const df = document.getElementById('gains-filter-date-from');
        const dt = document.getElementById('gains-filter-date-to');
        if (df) df.dataset.manual = '0';
        if (dt) dt.dataset.manual = '0';
        syncDrawerDateInputsToPeriod('gains-filter', document.getElementById('gains-period-filter')?.value);
    });
    const gainDf = document.getElementById('gains-filter-date-from');
    const gainDt = document.getElementById('gains-filter-date-to');
    const markGainsManual = () => {
        if (gainDf) gainDf.dataset.manual = '1';
        if (gainDt) gainDt.dataset.manual = '1';
    };
    gainDf?.addEventListener('change', () => {
        markGainsManual();
        applyGainsFilters();
    });
    gainDt?.addEventListener('change', () => {
        markGainsManual();
        applyGainsFilters();
    });
}

function getSortedFilteredGainsList() {
    const period = gainsFilterState.period || getDefaultPeriodValue();
    const base = getFilteredGainsList();
    const now = new Date();
    const expanded = expandExpectedSplitGainsForTable(base, period, now);
    return sortGainRows(expanded, gainsSort, gainsRenderCache.accounts);
}

function renderGainsBodySlice() {
    const list = getSortedFilteredGainsList();
    renderGainsBodySliceWithList(list);
}

function renderGainsBodySliceWithList(list) {
    const tbody = document.querySelector('#gains-table tbody');
    if (!tbody || !gainsPagination) return;
    const { accounts, currency } = gainsRenderCache;
    const { start, end } = gainsPagination.getSliceRange();
    tbody.innerHTML = '';
    list.slice(start, end).forEach((t) => {
        const account = accounts.find((acc) => acc.id === t.accountId);
        const tr = document.createElement('tr');
        const categoryDisplay = t.subcategory 
            ? `${t.category} > ${t.subcategory}` 
            : t.category;
        const gainRecTitle = t.recurrenceGroupId
            ? 'Série recorrente no ano: um lançamento por mês até dezembro, mantendo o dia do mês da data inicial.'
            : '';
        const recBadge = t.recurrenceGroupId
            ? `<span class="gain-recurrence-badge" title="${htmlAttrEscape(gainRecTitle)}">↻</span>`
            : '';
        const amountHtml = t.recurrenceGroupId
            ? `<span class="movement-amount-with-rec-inner">${recBadge}${formatCurrency(t.amount, currency)}</span>`
            : formatCurrency(t.amount, currency);
        const paymentKindText = escapeHtml(
            isSplitReimbursementGain(t) || t.__syntheticExpectedSplit
                ? 'PIX'
                : movementAccountPaymentKindLabel(account)
        );
        const gidForAttr = htmlAttrEscape(String(t.id));
        const isSynthSplit = Boolean(t.__syntheticExpectedSplit);
        const receivedCell = isSynthSplit
            ? t.isPaid === false
                ? `<span class="expense-status-badge expense-status-badge--pending">Pendente</span>`
                : `<span class="expense-status-badge expense-status-badge--paid">Recebido</span>`
            : t.isPaid === false
              ? `<button type="button" class="expense-status-badge expense-status-badge--pending gain-received-toggle" data-gain-id="${gidForAttr}" title="Marcar como recebido" aria-label="Marcar entrada como recebida">Pendente</button>`
              : `<button type="button" class="expense-status-badge expense-status-badge--paid gain-received-toggle" data-gain-id="${gidForAttr}" title="Marcar como pendente" aria-label="Marcar entrada como pendente (a receber)">Recebido</button>`;
        const actionBtns = isSynthSplit
            ? ''
            : `<button class="btn-action btn-edit" data-id="${String(t.id)}" title="Editar"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-action btn-delete" data-id="${String(t.id)}" title="Excluir"><i class="fas fa-trash-alt"></i></button>`;
        if (isSynthSplit) tr.classList.add('gain-tr-expected-split');
        // Não exibe subtítulo/“hint” abaixo da descrição do ganho.
        tr.innerHTML = `
            <td class="gains-td-batch"><label class="gain-batch-row-hit"><span class="sr-only">Selecionar para seleção em lote</span><input type="checkbox" class="gain-batch-check" data-gain-id="${gidForAttr}"></label></td>
            <td>${movementDateToJsDate(t.date).toLocaleDateString('pt-BR')}</td>
            <td>${buildTruncatedTableCellHtml(t.description)}</td>
            <td>${escapeHtml(categoryDisplay)}</td>
            <td>${escapeHtml(account?.name || 'N/A')}</td>
            <td>${paymentKindText}</td>
            <td class="receita">${amountHtml}</td>
            <td class="gains-td-received">${receivedCell}</td>
            <td class="transaction-actions">
                <div class="transaction-actions__inner">
                    ${actionBtns}
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
    syncGainsBatchToolbar();
}

export function loadGainsData(gains, accounts, currency) {
    const sorted = [...(gains || [])].sort(
        (a, b) => movementDateToUnixSeconds(b.date) - movementDateToUnixSeconds(a.date)
    );
    gainsRenderCache = { sorted, accounts, currency };
    hydratePortalGainPaymentStatusFromStorage();
    syncDrawerDateInputsToPeriod('gains-filter', document.getElementById('gains-period-filter')?.value);
    readGainsFilterFromDom();
    populateGainFilterSelects();
    readGainsFilterFromDom();

    const bar = document.getElementById('gains-pagination');
    if (!gainsPagination && bar) {
        gainsPagination = new TablePaginationController(bar, {
            storageKey: 'gains',
            onChange: () => renderGainsBodySlice()
        });
    }
    if (gainsPagination) {
        gainsPagination.setTotal(getSortedFilteredGainsList().length);
    }
    syncSortableTableHeaders(document.getElementById('gains-table'), gainsSort, ['date', 'amount', 'payment', 'received']);
    renderGainsBodySlice();
    updateGainsSummaryCards();
    syncGainsQuickStatusButtonsFromCheckboxes();
}

function setupTransactionTableFilters() {
    if (tableFiltersListenersBound) return;
    tableFiltersListenersBound = true;

    initMovementFilterDrawerEvents();

    document.getElementById('expenses-filter-q')?.addEventListener('input', () => {
        clearTimeout(expensesFilterDebounce);
        expensesFilterDebounce = setTimeout(() => applyExpensesFilters(), 200);
    });
    document.getElementById('expenses-filter-category')?.addEventListener('change', () => applyExpensesFilters());
    document.getElementById('expenses-filter-account')?.addEventListener('change', () => applyExpensesFilters());
    document.getElementById('expenses-period-filter')?.addEventListener('change', () => applyExpensesFilters());
    document.getElementById('expenses-filter-clear')?.addEventListener('click', () => {
        const p = document.getElementById('expenses-period-filter');
        resetExpensesDrawerFiltersKeepPeriod();
        if (p) p.value = getDefaultPeriodValue();
        syncDrawerDateInputsToPeriod('expenses-filter', getDefaultPeriodValue());
        applyExpensesFilters();
        closeFilterDrawer('expenses-filter-drawer');
    });

    document.getElementById('gains-filter-q')?.addEventListener('input', () => {
        clearTimeout(gainsFilterDebounce);
        gainsFilterDebounce = setTimeout(() => applyGainsFilters(), 200);
    });
    document.getElementById('gains-filter-category')?.addEventListener('change', () => applyGainsFilters());
    document.getElementById('gains-filter-account')?.addEventListener('change', () => applyGainsFilters());
    document.getElementById('gains-period-filter')?.addEventListener('change', () => applyGainsFilters());
    document.getElementById('gains-filter-clear')?.addEventListener('click', () => {
        const p = document.getElementById('gains-period-filter');
        resetGainsDrawerFiltersKeepPeriod();
        if (p) p.value = getDefaultPeriodValue();
        syncDrawerDateInputsToPeriod('gains-filter', getDefaultPeriodValue());
        applyGainsFilters();
        closeFilterDrawer('gains-filter-drawer');
    });

    document.getElementById('card-purchases-filter-q')?.addEventListener('input', () => {
        clearTimeout(cardPurchasesFilterDebounce);
        cardPurchasesFilterDebounce = setTimeout(() => applyCardPurchasesFilters(), 200);
    });
    document.getElementById('card-purchases-filter-clear')?.addEventListener('click', () => {
        const q = document.getElementById('card-purchases-filter-q');
        if (q) q.value = '';
        cardPurchasesFilterQ = '';
        applyCardPurchasesFilters();
    });

    setupTableSortClicks();
    setupQuickFilters();
}

function setupQuickFilters() {
    document.querySelectorAll('#expenses-page .quick-filter-btn[data-quick-kind="type"]').forEach((btn) => {
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => {
            const on = btn.getAttribute('aria-pressed') !== 'true';
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            btn.classList.toggle('active', on);
            applyExpensesFilters();
        });
    });
    document.querySelectorAll('#expenses-page .quick-filter-btn[data-quick-kind="status"]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            if (filter === 'paid') {
                const el = document.getElementById('expenses-filter-status-paid');
                if (el) {
                    el.checked = !el.checked;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else if (filter === 'unpaid') {
                const el = document.getElementById('expenses-filter-status-pending');
                if (el) {
                    el.checked = !el.checked;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
    });

    document.querySelectorAll('#gains-page .quick-filter-btn[data-quick-kind="status"]').forEach((btn) => {
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            if (filter === 'paid') {
                const el = document.getElementById('gains-filter-status-received');
                if (el) {
                    el.checked = !el.checked;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else if (filter === 'unpaid') {
                const el = document.getElementById('gains-filter-status-pending');
                if (el) {
                    el.checked = !el.checked;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
    });
}

function setupTableSortClicks() {
    if (tableSortClicksBound) return;
    tableSortClicksBound = true;

    document.getElementById('expenses-table')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.sortable-th__btn');
        if (!btn) return;
        const th = btn.closest('[data-sort-key]');
        if (!th || !document.getElementById('expenses-table')?.contains(th)) return;
        e.preventDefault();
        const key = th.dataset.sortKey;
        if (!key) return;
        expensesSort = nextSortState(expensesSort, key, ['date', 'amount', 'status']);
        if (!expensesPagination) return;
        expensesPagination.setTotal(getSortedFilteredExpensesList().length, { resetPage: true });
        syncSortableTableHeaders(document.getElementById('expenses-table'), expensesSort, [
            'date',
            'amount',
            'payment',
            'isFixed',
            'status'
        ]);
        renderExpensesBodySlice();
    });

    document.getElementById('gains-table')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.sortable-th__btn');
        if (!btn) return;
        const th = btn.closest('[data-sort-key]');
        if (!th || !document.getElementById('gains-table')?.contains(th)) return;
        e.preventDefault();
        const key = th.dataset.sortKey;
        if (!key) return;
        gainsSort = nextSortState(gainsSort, key, ['date', 'amount', 'received']);
        if (!gainsPagination) return;
        gainsPagination.setTotal(getSortedFilteredGainsList().length, { resetPage: true });
        syncSortableTableHeaders(document.getElementById('gains-table'), gainsSort, ['date', 'amount', 'payment', 'received']);
        renderGainsBodySlice();
    });

    document.getElementById('card-purchases-table')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.sortable-th__btn');
        if (!btn) return;
        const th = btn.closest('[data-sort-key]');
        if (!th || !document.getElementById('card-purchases-table')?.contains(th)) return;
        e.preventDefault();
        const key = th.dataset.sortKey;
        if (!key) return;
        cardPurchasesSort = nextSortState(cardPurchasesSort, key, [
            'date',
            'amount',
            'installments',
            'lastInstallment',
            'status'
        ]);
        if (!cardPurchasesPagination) return;
        cardPurchasesPagination.setTotal(getSortedFilteredCardPurchasesList().length, { resetPage: true });
        syncSortableTableHeaders(document.getElementById('card-purchases-table'), cardPurchasesSort, [
            'date',
            'amount',
            'installments',
            'lastInstallment',
            'status'
        ]);
        renderCardPurchasesBodySlice();
    });
}

/** Valor do &lt;select&gt; quando a categoria é Empréstimo (conta real em `dataset.loanPaymentAccountId`). */
const EXPENSE_LOAN_PAYMENT_VALUE = '__expense_loan__';

function sortedBankAccounts() {
    return (userAccounts || [])
        .filter((a) => !isCardAccountType(a.type))
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
}

/** Conta usada para parcelas / preview (Empréstimo usa `dataset`, senão o valor do select). */
function getSelectedExpensePaymentAccount() {
    const form = document.getElementById('expense-form');
    if (isExpenseLoanCategorySelected() && form?.dataset?.loanPaymentAccountId) {
        const id = form.dataset.loanPaymentAccountId;
        return userAccounts?.find((a) => a.id === id) ?? null;
    }
    const v = document.getElementById('expense-payment-method')?.value;
    return v && v !== EXPENSE_LOAN_PAYMENT_VALUE ? userAccounts?.find((a) => a.id === v) ?? null : null;
}

function applyLoanExpensePaymentMethodUi(accountId) {
    const form = document.getElementById('expense-form');
    const sel = document.getElementById('expense-payment-method');
    const loanDebitSel = document.getElementById('expense-loan-debit-account');
    if (!form || !sel) return;
    const banks = sortedBankAccounts();
    const resolved =
        accountId && banks.some((b) => b.id === accountId) ? accountId : '';
    form.dataset.loanPaymentAccountId = resolved;
    if (loanDebitSel) {
        loanDebitSel.innerHTML = '';
        const z = document.createElement('option');
        z.value = '';
        z.textContent = 'Selecione a conta debitada';
        loanDebitSel.appendChild(z);
        banks.forEach((b) => {
            const o = document.createElement('option');
            o.value = b.id;
            o.textContent = b.name;
            loanDebitSel.appendChild(o);
        });
        loanDebitSel.value = resolved;
    }
    sel.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = EXPENSE_LOAN_PAYMENT_VALUE;
    opt.textContent = 'Empréstimo';
    sel.appendChild(opt);
    sel.value = EXPENSE_LOAN_PAYMENT_VALUE;
    sel.disabled = true;
}

function syncExpenseLoanDebitAccountRowVisibility() {
    const row = document.getElementById('expense-loan-debit-account-row');
    if (row) row.classList.toggle('hidden', !isExpenseLoanCategorySelected());
}

/**
 * Categoria Empréstimo: forma de pagamento travada em «Empréstimo»; conta em `dataset.loanPaymentAccountId`.
 * @param {string|null|undefined} preselectWhenLeavingLoan — ao sair do modo empréstimo, reabre o select com essa conta
 */
function syncExpensePaymentMethodForLoanCategory(preselectWhenLeavingLoan) {
    const form = document.getElementById('expense-form');
    const sel = document.getElementById('expense-payment-method');
    if (!form || !sel) return;

    if (!isExpenseLoanCategorySelected()) {
        const wasLoan = sel.value === EXPENSE_LOAN_PAYMENT_VALUE;
        sel.disabled = false;
        delete form.dataset.loanPaymentAccountId;
        if (wasLoan) {
            populateExpensePaymentMethodSelect(
                preselectWhenLeavingLoan === undefined ? null : preselectWhenLeavingLoan
            );
        }
        syncExpenseLoanDebitAccountRowVisibility();
        return;
    }

    const accId = form.dataset.loanPaymentAccountId || '';
    applyLoanExpensePaymentMethodUi(accId);
    syncExpenseLoanDebitAccountRowVisibility();
}

function sortedCardAccounts() {
    return (userAccounts || [])
        .filter((a) => isCardAccountType(a.type))
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
}

/**
 * Monta select de forma de pagamento (PIX por banco + cartões) — modal de despesa.
 * @param {HTMLSelectElement|null} sel
 * @param {string|null|undefined} preselectAccountId — `undefined` só monta opções; `null` limpa seleção.
 */
function populatePaymentMethodSelect(sel, preselectAccountId) {
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione</option>';

    const banks = sortedBankAccounts();
    if (banks.length > 0) {
        const pixGroup = document.createElement('optgroup');
        pixGroup.label = 'PIX';
        banks.forEach((b) => {
            const o = document.createElement('option');
            o.value = b.id;
            o.textContent = `PIX — ${b.name}`;
            pixGroup.appendChild(o);
        });
        sel.appendChild(pixGroup);
    }

    const cards = sortedCardAccounts();
    if (cards.length > 0) {
        const og = document.createElement('optgroup');
        og.label = 'Cartões';
        cards.forEach((acc) => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            const kind = isCreditCardType(acc.type) ? 'crédito' : 'débito';
            opt.textContent = `${acc.name} (${kind})`;
            og.appendChild(opt);
        });
        sel.appendChild(og);
    }

    if (preselectAccountId === undefined) return;

    if (preselectAccountId === null || preselectAccountId === '') {
        sel.value = '';
        return;
    }

    const acc = userAccounts?.find((a) => a.id === preselectAccountId);
    if (!acc) {
        const o = document.createElement('option');
        o.value = preselectAccountId;
        o.textContent = 'Conta indisponível';
        sel.appendChild(o);
        sel.value = preselectAccountId;
        return;
    }

    if (isCardAccountType(acc.type)) {
        sel.value = preselectAccountId;
        return;
    }

    const bankOpt = [...sel.options].find((o) => o.value === acc.id);
    if (bankOpt) {
        sel.value = acc.id;
        return;
    }
    const o = document.createElement('option');
    o.value = acc.id;
    o.textContent = `PIX — ${acc.name}`;
    sel.appendChild(o);
    sel.value = acc.id;
}

function populateExpensePaymentMethodSelect(preselectAccountId) {
    populatePaymentMethodSelect(document.getElementById('expense-payment-method'), preselectAccountId);
}

/**
 * Select de ganho: apenas contas bancárias (saldo); cartões não aparecem.
 * @param {string|null|undefined} preselectAccountId — `undefined` só monta opções; `null` limpa seleção.
 */
function populateGainAccountSelect(preselectAccountId) {
    const sel = document.getElementById('gain-account');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione uma conta</option>';
    sortedBankAccounts().forEach((b) => {
        const o = document.createElement('option');
        o.value = b.id;
        o.textContent = b.name;
        sel.appendChild(o);
    });

    if (preselectAccountId === undefined) return;

    if (preselectAccountId === null || preselectAccountId === '') {
        sel.value = '';
        return;
    }

    const acc = userAccounts?.find((a) => a.id === preselectAccountId);
    if (!acc) {
        const o = document.createElement('option');
        o.value = preselectAccountId;
        o.textContent = 'Conta indisponível';
        sel.appendChild(o);
        sel.value = preselectAccountId;
        return;
    }

    if (isCardAccountType(acc.type)) {
        sel.value = '';
        return;
    }

    const match = [...sel.options].find((o) => o.value === acc.id);
    if (match) sel.value = acc.id;
}

/** Conta e status (pago/recebido vs pendente) a partir do valor do select — igual despesa e ganho. */
function resolvePaymentMethodSelection(value, formEl) {
    if (!value) return null;
    if (value === EXPENSE_LOAN_PAYMENT_VALUE) {
        const form = formEl || document.getElementById('expense-form');
        const id = form?.dataset?.loanPaymentAccountId;
        if (!id) return null;
        const acc = userAccounts?.find((a) => a.id === id);
        if (!acc) return null;
        return { accountId: acc.id, isPaid: true };
    }
    const acc = userAccounts?.find((a) => a.id === value);
    if (!acc) return null;
    if (isCreditCardType(acc.type)) {
        return { accountId: acc.id, isPaid: false };
    }
    return { accountId: acc.id, isPaid: true };
}

function isExpenseLoanCategorySelected() {
    const cat = document.getElementById('expense-category-select');
    const sub = document.getElementById('expense-subcategory-select');
    return isLoanExpense({
        category: cat?.value ?? '',
        subcategory: sub?.value ?? ''
    });
}

/** Parcelas para cartão de crédito (ciclo da fatura) ou categoria Empréstimo (parcelas mensais). */
function syncExpenseInstallmentsRow() {
    const form = document.getElementById('expense-form');
    const row = document.getElementById('expense-installments-row');
    const input = document.getElementById('expense-installments');
    const sel = document.getElementById('expense-payment-method');
    if (!row || !input || !sel) return;
    if (form?.dataset.splitFromRateio === '1') {
        const splitN = parseInt(String(form.dataset.splitSourceInstallmentCount || ''), 10);
        if (!Number.isFinite(splitN) || splitN < 2) {
            input.readOnly = false;
            input.classList.remove('input-readonly-locked');
            row.classList.add('hidden');
            updateExpenseInstallmentPreview();
            syncExpenseRecurringModeVisibility();
            return;
        }
        const acc = getSelectedExpensePaymentAccount();
        const loan = isExpenseLoanCategorySelected();
        const credit = Boolean(acc && isCreditCardType(acc.type));
        // Compra parcelada na divisão: mostrar N parcelas mesmo antes de escolher o cartão
        // (antes ficava oculto com "Selecione" e o utilizador gravava sem parcelas).
        row.classList.remove('hidden');
        input.value = String(splitN);
        input.readOnly = true;
        input.classList.add('input-readonly-locked');
        const label = row.querySelector('label[for="expense-installments"]');
        const small = row.querySelector('small');
        if (label) {
            label.textContent = credit
                ? 'Parcelas no cartão de crédito'
                : loan
                  ? 'Parcelas do empréstimo'
                  : 'Parcelas (espelho da divisão)';
        }
        if (small) {
            if (credit) {
                small.innerHTML =
                    'Mesmo número de parcelas da compra original. Os vencimentos seguem o <strong>seu</strong> cartão (fechamento e vencimento).';
                small.classList.remove('hidden');
            } else if (loan && acc && !credit) {
                small.innerHTML =
                    'Mesmo número de parcelas da compra original; vencimentos mensais a partir da data da compra.';
                small.classList.remove('hidden');
            } else {
                small.innerHTML =
                    'Para gravar com estas parcelas, escolha <strong>cartão de crédito</strong> ou categoria <strong>Empréstimo</strong> debitada em conta corrente/poupança (não use PIX/cartão de débito).';
                small.classList.remove('hidden');
            }
        }
        updateExpenseInstallmentPreview();
        syncExpenseRecurringModeVisibility();
        return;
    }
    input.readOnly = false;
    input.classList.remove('input-readonly-locked');
    const acc = getSelectedExpensePaymentAccount();
    const loan = isExpenseLoanCategorySelected();
    const credit = Boolean(acc && isCreditCardType(acc.type));
    const show = Boolean(credit || (loan && acc && !credit));
    row.classList.toggle('hidden', !show);
    const label = row.querySelector('label[for="expense-installments"]');
    const small = row.querySelector('small');
    if (label) {
        label.textContent = credit ? 'Parcelas no cartão de crédito' : 'Parcelas do empréstimo';
    }
    if (small) {
        if (credit) {
            small.innerHTML =
                'Total de parcelas. Os vencimentos seguem a <strong>data da compra</strong>, o <strong>fechamento</strong> e o <strong>vencimento</strong> do cartão. No preview abaixo, marque as parcelas que já saíram do caixa (igual ao empréstimo); só essas entram no saldo e aparecem como pagas.';
            small.classList.remove('hidden');
        } else {
            small.innerHTML = '';
            small.classList.add('hidden');
        }
    }
    if (show) {
        let n = parseInt(String(input.value), 10);
        if (!Number.isFinite(n) || n < 1) {
            input.value = '1';
            n = 1;
        }
    }
    updateExpenseInstallmentPreview();
    syncExpenseRecurringModeVisibility();
}

/**
 * Recorrência mensal na conta (RECORRENTE) não se aplica a empréstimo nem a pagamento com cartão — o fluxo é por parcelas / fatura.
 */
function syncExpenseRecurringModeVisibility() {
    const grid = document.getElementById('expense-date-recurring-grid');
    const row = document.getElementById('expense-recurring-mode-row');
    const rec = document.getElementById('expense-recurring-mode');
    const form = document.getElementById('expense-form');
    if (form?.dataset.splitFromRateio === '1') {
        if (row) row.classList.add('hidden');
        if (rec) {
            rec.value = '0';
            rec.disabled = true;
        }
        return;
    }
    const acc = getSelectedExpensePaymentAccount();
    const loan = isExpenseLoanCategorySelected();
    const cardPayment = Boolean(acc && isCardAccountType(acc.type));
    const hide = loan || cardPayment;
    const inSeries = Boolean(form?.dataset?.expenseRecurrenceGroupId?.trim());
    if (grid) grid.classList.toggle('expense-date-recurring-grid--recurring-off', hide);
    if (row) row.classList.toggle('hidden', hide);
    if (rec) {
        rec.disabled = hide || inSeries;
        if (hide) rec.value = '0';
        else if (inSeries) rec.value = '1';
    }
}

function syncExpenseFixedPaidGridLayout() {
    const grid = document.getElementById('expense-fixed-paid-grid');
    const paidRow = document.getElementById('expense-paid-row');
    if (!grid || !paidRow) return;
    grid.classList.toggle(
        'expense-fixed-paid-grid--single',
        paidRow.classList.contains('hidden')
    );
}

function updateExpenseInstallmentPreview() {
    const prev = document.getElementById('expense-installment-preview');
    const sel = document.getElementById('expense-payment-method');
    const dateEl = document.getElementById('expense-date');
    const instEl = document.getElementById('expense-installments');
    const amtInput = document.getElementById('expense-amount');
    const previewAmount = parseFloat(String(amtInput?.value ?? '0')) || 0;
    if (!prev || !sel || !dateEl) return;
    const acc = getSelectedExpensePaymentAccount();
    const n = parseInt(String(instEl?.value ?? '1'), 10) || 1;
    const loan = isExpenseLoanCategorySelected();
    const credit = Boolean(acc && isCreditCardType(acc.type));

    if (credit) {
        if (!acc) {
            prev.classList.add('hidden');
            prev.innerHTML = '';
            return;
        }
        if (n < 2) {
            prev.classList.add('hidden');
            prev.innerHTML = '';
            return;
        }
        const cd = acc.closeDay ?? acc.closingDay;
        const dd = acc.dueDay ?? acc.dueDate;
        if (!cd || !dd) {
            prev.classList.remove('hidden');
            prev.innerHTML =
                '<p class="form-hint">Defina o fechamento e o vencimento do cartão no cadastro para ver o cronograma das parcelas.</p>';
            return;
        }
        const purchase = new Date(dateEl.value + 'T12:00:00');
        if (Number.isNaN(purchase.getTime())) {
            prev.classList.add('hidden');
            return;
        }
        const now = new Date();
        const form = document.getElementById('expense-form');
        const dueDates = getInstallmentDueDates(purchase, n, cd, dd);
        const validPk = new Set(dueDates.map((d) => calendarDayKeyFromDate(d)));
        const curKeys = getLoanPaidPeriodKeysFromForm(form).filter((k) => validPk.has(k));
        setLoanPaidPeriodKeysOnForm(form, curKeys);
        const paidKeys = getLoanPaidPeriodKeysFromForm(form);
        const fake = {
            date: purchase.toISOString(),
            installmentCount: n,
            isPaid: false,
            amount: previewAmount,
            category: 'Outros',
            createdAt: now.toISOString(),
            cashOutConfirmedPeriods: JSON.stringify(paidKeys)
        };
        const st = getInstallmentState(fake, acc, now, financeUserProfile);
        prev.classList.remove('hidden');
        prev.innerHTML = formatInstallmentRemainingSummaryHtml(st, {
            appendHtml: buildLoanMonthTagsHtml(dueDates, paidKeys, now)
        });
        return;
    }

    // Empréstimo parcelado: não depende de cartão; podemos mostrar o cronograma mesmo antes de
    // escolher a conta (útil no fluxo de divisão), pois as datas são mensais a partir da data inicial.
    if (loan && !credit && n >= 2) {
        const purchase = new Date(dateEl.value + 'T12:00:00');
        if (Number.isNaN(purchase.getTime())) {
            prev.classList.add('hidden');
            return;
        }
        const now = new Date();
        const form = document.getElementById('expense-form');
        const dueDates = getLoanInstallmentDueDates(purchase, n);
        const validPk = new Set(dueDates.map((d) => calendarDayKeyFromDate(d)));
        const curKeys = getLoanPaidPeriodKeysFromForm(form).filter((k) => validPk.has(k));
        setLoanPaidPeriodKeysOnForm(form, curKeys);
        const paidKeys = getLoanPaidPeriodKeysFromForm(form);
        const fake = {
            date: purchase.toISOString(),
            installmentCount: n,
            isPaid: false,
            amount: previewAmount,
            category: 'Empréstimo',
            createdAt: now.toISOString(),
            cashOutConfirmedPeriods: JSON.stringify(paidKeys)
        };
        const st = getInstallmentState(fake, acc, now, financeUserProfile);
        prev.classList.remove('hidden');
        prev.innerHTML = formatInstallmentRemainingSummaryHtml(st, {
            loan: true,
            appendHtml: buildLoanMonthTagsHtml(dueDates, paidKeys, now)
        });
        return;
    }

    const form = document.getElementById('expense-form');
    const recMode = document.getElementById('expense-recurring-mode')?.value === '1';
    const inSeries = Boolean(form?.dataset?.expenseRecurrenceGroupId?.trim());
    if ((recMode || inSeries) && acc && !credit && !loan) {
        const purchase = new Date(dateEl.value + 'T12:00:00');
        if (Number.isNaN(purchase.getTime())) {
            prev.classList.add('hidden');
            prev.innerHTML = '';
            return;
        }
        const dueDates = getRecurringSeriesDueDatesFromPurchase(purchase);
        if (dueDates.length < 2) {
            prev.classList.add('hidden');
            prev.innerHTML = '';
            return;
        }
        const now = new Date();
        const validMk = new Set(dueDates.map((d) => monthKeyFromDate(d)));
        const curKeys = getLoanPaidPeriodKeysFromForm(form).filter(
            (k) =>
                validMk.has(k) ||
                dueDates.some((d) => calendarDayKeyFromDate(d) === k)
        );
        setLoanPaidPeriodKeysOnForm(form, curKeys);
        const paidKeys = getLoanPaidPeriodKeysFromForm(form);
        const total = dueDates.length;
        const paidCount = dueDates.filter((d) => {
            const mk = monthKeyFromDate(d);
            const dk = calendarDayKeyFromDate(d);
            return paidKeys.includes(mk) || paidKeys.includes(dk);
        }).length;
        const remaining = total - paidCount;
        const year = purchase.getFullYear();
        const st = { applies: true, total, paidCount, remaining, allPaid: remaining === 0 };
        const tags = buildLoanMonthTagsHtml(dueDates, paidKeys, now, true);
        prev.classList.remove('hidden');
        if (remaining === 0) {
            prev.innerHTML = `<div class="installment-remaining-summary installment-remaining-summary--recurring-year installment-remaining-summary--with-append" role="status" aria-label="${htmlAttrEscape(
                `Recorrência mensal ${year}: todos os meses confirmados no caixa`
            )}">
  <div class="installment-remaining-copy">
    <span class="installment-remaining-title">${escapeHtml(`Recorrência mensal em ${year}`)}</span>
    <span class="installment-remaining-line">Os <strong>${total}</strong> meses previstos para este ano já foram confirmados no caixa.</span>
    <span class="installment-remaining-hint">Despesa recorrente: um lançamento por mês até dezembro. Use as tags abaixo para revisar cada mês.</span>
  </div>
  <div class="installment-remaining-append">${tags}</div>
</div>`;
            return;
        }
        const summary = formatInstallmentRemainingSummaryHtml(st, {
            loan: true,
            summaryVariant: 'recurringYear',
            summaryTitle: `Recorrência mensal em ${year}`,
            summaryLineHtml: `Faltam <strong>${remaining}</strong> de <strong>${total}</strong> meses neste ano a confirmar no caixa.`,
            ariaLabel: `Recorrência mensal em ${year}: faltam ${remaining} de ${total} meses a confirmar no caixa`,
            hint: 'É uma despesa mensal recorrente na conta, não uma compra parcelada: um lançamento por mês até dezembro. Toque no mês quando o pagamento sair da conta.',
            appendHtml: tags
        });
        prev.innerHTML =
            summary ||
            `<div class="installment-remaining-summary installment-remaining-summary--recurring-year installment-remaining-summary--with-append" role="status"><div class="installment-remaining-append">${tags}</div></div>`;
        return;
    }

    prev.classList.add('hidden');
    prev.innerHTML = '';
}

function handleLoanMonthTagClick(e) {
    const btn = e.target.closest('.expense-loan-month-tag');
    if (!btn) return;
    e.preventDefault();
    const pk = btn.dataset.periodKey;
    if (!pk) return;
    const form = document.getElementById('expense-form');
    if (!form) return;
    const keys = [...getLoanPaidPeriodKeysFromForm(form)];
    const i = keys.indexOf(pk);
    if (i >= 0) keys.splice(i, 1);
    else keys.push(pk);
    setLoanPaidPeriodKeysOnForm(form, keys);
    updateExpenseInstallmentPreview();
}

function openExpenseModal(forEdit, options = null) {
    const form = document.getElementById('expense-form');
    const newRow = document.getElementById('expense-category-new-row');
    const subNewRow = document.getElementById('expense-subcategory-new-row');
    const splitOpts =
        options && options.splitRequestId != null && options.splitAmount != null ? options : null;
    const src = splitOpts?.sourceExpense;

    const recRow = document.getElementById('expense-recurring-mode-row');
    const instRow = document.getElementById('expense-installments-row');
    const paidRow = document.getElementById('expense-paid-row');
    const paidInput = document.getElementById('expense-is-paid');
    const amtInput = document.getElementById('expense-amount');

    if (newRow) newRow.classList.add('hidden');
    if (subNewRow) subNewRow.classList.add('hidden');

    const finishOpen = () => {
        document.getElementById('expense-modal-title').textContent = splitOpts
            ? 'Sua parte da divisão'
            : forEdit
              ? 'Editar saída'
              : 'Nova saída';
        populateExpensePaymentMethodSelect(forEdit ? undefined : null);
        syncExpensePaymentMethodForLoanCategory();
        syncExpenseInstallmentsRow();
        if (!forEdit) {
            if (src?.date) {
                try {
                    form['expense-date'].value = movementDateToJsDate(src.date).toISOString().split('T')[0];
                } catch {
                    form['expense-date'].value = getTodayDateInputValue();
                }
            } else {
                form['expense-date'].value = getTodayDateInputValue();
            }
        }
        syncExpenseFixedPaidGridLayout();
        openModal('expense-modal');
    };

    if (!forEdit) {
        form.reset();
        form['expense-id'].value = '';
        delete form.dataset.loanPaymentAccountId;
        delete form.dataset.expenseRecurrenceGroupId;
        form.dataset.loanPaidPeriodKeys = '[]';
        const inst = document.getElementById('expense-installments');
        if (inst) inst.value = '1';
        const recMode = document.getElementById('expense-recurring-mode');
        if (recMode) recMode.value = '0';
        const isFixedSel = document.getElementById('expense-is-fixed');
        if (isFixedSel) isFixedSel.value = '0';
        delete form.dataset.splitRequestId;
        delete form.dataset.splitFromRateio;
        delete form.dataset.splitSourceIsInvestment;
        delete form.dataset.splitSourceInstallmentCount;
        const dateInpUnlock = form['expense-date'];
        if (dateInpUnlock) {
            dateInpUnlock.readOnly = false;
            dateInpUnlock.classList.remove('input-readonly-locked');
            dateInpUnlock.removeAttribute('title');
        }
        if (amtInput) {
            amtInput.readOnly = false;
            amtInput.classList.remove('input-readonly-locked');
        }
        if (recRow) recRow.classList.remove('hidden');
        if (instRow) instRow.classList.remove('hidden');
        if (paidRow) paidRow.classList.add('hidden');
        if (paidInput) paidInput.value = '0';

        if (splitOpts) {
            form.dataset.splitRequestId = String(splitOpts.splitRequestId);
            form.dataset.splitFromRateio = '1';
            if (src?.isInvestment) form.dataset.splitSourceIsInvestment = '1';
            const splitScope = normalizeSplitScope(splitOpts.splitScope || 'FULL_EXPENSE');
            const rawIc =
                splitOpts.sourceInstallmentCount ??
                src?.recurrenceSeriesLength ??
                src?.installmentCount ??
                src?.installment_count;
            const parsedIc = parseInt(String(rawIc ?? ''), 10);
            const srcInst = Number.isFinite(parsedIc) && parsedIc >= 2 ? Math.min(99, parsedIc) : 1;
            if (splitScope === 'FULL_EXPENSE' && srcInst >= 2) {
                form.dataset.splitSourceInstallmentCount = String(srcInst);
            }
            // Espelha "recorrência mensal em YYYY" / tags mensais quando a origem é uma série recorrente.
            const srcRecurring = Boolean(src?.recurrenceGroupId && String(src.recurrenceGroupId).trim());
            const srcRecurringMonthly = src?.recurringMonthly === true;
            if (srcRecurring || srcRecurringMonthly) {
                form.dataset.expenseRecurrenceGroupId = String(src.recurrenceGroupId || 'split-series');
                // Não herdar pagamentos confirmados do solicitante; é um espelho para o destinatário.
                form.dataset.loanPaidPeriodKeys = '[]';
                const recModeEl = document.getElementById('expense-recurring-mode');
                if (recModeEl) recModeEl.value = '1';
            }
            if (amtInput) {
                amtInput.value = String(splitOpts.splitAmount);
                amtInput.readOnly = true;
                amtInput.classList.add('input-readonly-locked');
            }
            if (recRow) recRow.classList.add('hidden');
        }

        if (splitOpts && src) {
            form['expense-description'].value = String(src.description ?? '').trim();
            const fx = document.getElementById('expense-is-fixed');
            if (fx) fx.value = Boolean(src.isFixed) ? '1' : '0';
        }

        const catToLoad = splitOpts && src ? String(src.category ?? '').trim() : '';
        const subToLoad = splitOpts && src ? String(src.subcategory ?? '').trim() : '';

        populateExpenseCategorySelect(catToLoad).then(() => {
            populateExpenseSubcategorySelect(subToLoad);
            syncExpensePaymentMethodForLoanCategory();
            syncExpenseInstallmentsRow();
            finishOpen();
            if (splitOpts) {
                const dateInpLock = form['expense-date'];
                if (dateInpLock) {
                    dateInpLock.readOnly = true;
                    dateInpLock.classList.add('input-readonly-locked');
                    dateInpLock.title = 'Data da compra original (inalterável nesta divisão).';
                }
            }
        });
        return;
    }

    if (amtInput) {
        amtInput.readOnly = false;
        amtInput.classList.remove('input-readonly-locked');
    }
    if (paidRow) paidRow.classList.add('hidden');

    finishOpen();
}

function openGainModal(forEdit) {
    const form = document.getElementById('gain-form');
    const recurringRow = document.getElementById('gain-recurring-row');
    const grid = document.getElementById('gain-date-recurring-grid');
    const recMode = document.getElementById('gain-recurring-mode');
    const isReceived = document.getElementById('gain-is-received');
    if (!forEdit) {
        form.reset();
        form['gain-id'].value = '';
        populateGainCategorySelect('');
        if (recMode) recMode.value = '0';
        if (isReceived) isReceived.checked = true;
    }
    if (recurringRow) recurringRow.classList.toggle('hidden', Boolean(forEdit));
    if (grid) grid.classList.toggle('expense-date-recurring-grid--recurring-off', Boolean(forEdit));
    const receivedRow = document.getElementById('gain-is-received-row');
    if (receivedRow) receivedRow.classList.remove('hidden');
    document.getElementById('gain-modal-title').textContent = forEdit ? 'Editar entrada' : 'Nova entrada';
    populateGainAccountSelect(forEdit ? undefined : null);
    if (!forEdit) {
        form['gain-date'].value = getTodayDateInputValue();
    }
    openModal('gain-modal');
}

function markFieldError(input, message) {
    const formGroup = input.closest('.form-group');
    if (formGroup) {
        formGroup.classList.add('error');
        let errorText = formGroup.querySelector('.error-text');
        if (!errorText) {
            errorText = document.createElement('span');
            errorText.className = 'error-text';
            formGroup.appendChild(errorText);
        }
        errorText.textContent = message;
    }
}

async function handleExpenseFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.dataset.submitting === '1') return;
    const id = form['expense-id'].value;
    const isSplitRateio = form.dataset.splitFromRateio === '1';

    let hasErrors = false;
    form.querySelectorAll('.form-group').forEach((g) => g.classList.remove('error'));

    const description = form['expense-description'].value.trim();
    if (!description) {
        markFieldError(form['expense-description'], 'Informe uma descrição');
        hasErrors = true;
    }

    const amount = parseFloat(form['expense-amount'].value);
    if (!amount || amount <= 0) {
        markFieldError(form['expense-amount'], 'Informe um valor válido');
        hasErrors = true;
    }

    const paymentMethod = form['expense-payment-method']?.value?.trim() || '';
    if (!paymentMethod) {
        markFieldError(form['expense-payment-method'], 'Selecione a forma de pagamento');
        hasErrors = true;
    }

    const categorySelect = form['expense-category-select'];
    const category = categorySelect?.value?.trim() || '';
    if (!category) {
        markFieldError(categorySelect, 'Selecione ou crie uma categoria');
        hasErrors = true;
    }

    const subcategorySelect = form['expense-subcategory-select'];
    const subcategory = subcategorySelect?.value?.trim() || '';
    // Subcategoria é opcional, então não validamos se está vazia

    const resolved = paymentMethod ? resolvePaymentMethodSelection(paymentMethod, form) : null;
    if (paymentMethod && !resolved) {
        if (isExpenseLoanCategorySelected()) {
            const loanSel = document.getElementById('expense-loan-debit-account');
            if (loanSel) {
                markFieldError(loanSel, 'Escolha a conta em que as parcelas reduzem o saldo.');
            }
        } else {
            markFieldError(form['expense-payment-method'], 'Forma de pagamento inválida');
        }
        hasErrors = true;
    }

    const accountId = resolved?.accountId;
    const loanCat = isLoanExpense({ category, subcategory });
    const accForInstallments = accountId ? userAccounts?.find((a) => a.id === accountId) : null;
    const splitSrcN = parseInt(String(form.dataset.splitSourceInstallmentCount || ''), 10);
    const splitMirroredInstallments = Boolean(
        isSplitRateio &&
            Number.isFinite(splitSrcN) &&
            splitSrcN >= 2 &&
            accForInstallments &&
            (isCreditCardType(accForInstallments.type) || !isCardAccountType(accForInstallments.type))
    );
    const needsInstallments = Boolean(
        (!isSplitRateio &&
            ((accForInstallments && isCreditCardType(accForInstallments.type)) ||
                (loanCat && accForInstallments && !isCreditCardType(accForInstallments.type)))) ||
            splitMirroredInstallments
    );
    let installmentCount = null;
    if (needsInstallments && resolved) {
        if (splitMirroredInstallments) {
            installmentCount = splitSrcN;
        } else {
            const instInput = form['expense-installments'];
            const n = parseInt(String(instInput?.value ?? ''), 10);
            if (!Number.isFinite(n) || n < 1) {
                markFieldError(instInput, 'Informe o número de parcelas (mín. 1)');
                hasErrors = true;
            } else if (n > 99) {
                markFieldError(instInput, 'No máximo 99 parcelas');
                hasErrors = true;
            } else {
                installmentCount = n;
            }
        }
    }

    if (isSplitRateio && Number.isFinite(splitSrcN) && splitSrcN >= 2 && !splitMirroredInstallments) {
        markFieldError(
            form['expense-payment-method'],
            'Esta divisão é de lançamento parcelado. Para gravar com o mesmo número de parcelas, escolha um cartão de crédito ou uma conta bancária (PIX). Cartão de débito não suporta parcelas.'
        );
        hasErrors = true;
    }

    if (hasErrors) {
        showToast('Campos obrigatórios', 'Preencha todos os campos destacados', 'warning');
        return;
    }

    // Combina a data selecionada com o horário atual para preservar ordem de cadastro
    const selectedDate = form['expense-date'].value;
    let dateWithTime;
    
    if (id) {
        // Edição: verifica se a data foi alterada
        const originalExpense = userExpenses?.find((t) => t.id === id);
        const originalDate = originalExpense ? movementDateToJsDate(originalExpense.date).toISOString().split('T')[0] : '';
        
        if (originalDate === selectedDate) {
            // Data não mudou: mantém o timestamp original
            dateWithTime = movementDateToJsDate(originalExpense.date);
        } else {
            // Data mudou: usa nova data com horário atual
            const now = new Date();
            dateWithTime = new Date(selectedDate + 'T' + 
                String(now.getHours()).padStart(2, '0') + ':' + 
                String(now.getMinutes()).padStart(2, '0') + ':' + 
                String(now.getSeconds()).padStart(2, '0'));
        }
    } else {
        // Novo registro: usa data com horário atual
        const now = new Date();
        dateWithTime = new Date(selectedDate + 'T' + 
            String(now.getHours()).padStart(2, '0') + ':' + 
            String(now.getMinutes()).padStart(2, '0') + ':' + 
            String(now.getSeconds()).padStart(2, '0'));
    }
    
    let isPaidFinal = resolved.isPaid;
    let installmentCashOutKeysPayload = undefined;
    if (needsInstallments && accForInstallments && installmentCount != null) {
        if (isCreditCardType(accForInstallments.type)) {
            const cd = accForInstallments.closeDay ?? accForInstallments.closingDay;
            const dd = accForInstallments.dueDay ?? accForInstallments.dueDate;
            if (cd && dd) {
                const dueDates = getInstallmentDueDates(dateWithTime, installmentCount, cd, dd);
                const dueKeySet = new Set(dueDates.map((d) => calendarDayKeyFromDate(d)));
                let keys = getLoanPaidPeriodKeysFromForm(form);
                keys = keys.filter((k) => dueKeySet.has(k));
                setLoanPaidPeriodKeysOnForm(form, keys);
                keys = getLoanPaidPeriodKeysFromForm(form);
                installmentCashOutKeysPayload = keys;
                if (keys.length > 0) {
                    isPaidFinal = dueKeySet.size > 0 && [...dueKeySet].every((k) => keys.includes(k));
                } else {
                    isPaidFinal = !id && installmentCount === 1;
                }
            } else {
                isPaidFinal = false;
            }
        } else if (loanCat) {
            const dueDates = getLoanInstallmentDueDates(dateWithTime, installmentCount);
            const keys = getLoanPaidPeriodKeysFromForm(form);
            installmentCashOutKeysPayload = keys;
            const dueKeySet = new Set(dueDates.map((d) => calendarDayKeyFromDate(d)));
            if (keys.length > 0) {
                isPaidFinal =
                    dueKeySet.size > 0 && [...dueKeySet].every((k) => keys.includes(k));
            } else {
                isPaidFinal = !id && installmentCount === 1;
            }
        }
    }

    const orig = id ? userExpenses?.find((t) => t.id === id) : null;
    const isSeriesRow = Boolean(orig?.recurrenceGroupId && String(orig.recurrenceGroupId).trim() !== '');

    if (!needsInstallments && isSeriesRow && accForInstallments && !isCreditCardType(accForInstallments.type) && !loanCat) {
        const keys = getLoanPaidPeriodKeysFromForm(form);
        const mk = monthKeyFromDate(dateWithTime);
        const dk = calendarDayKeyFromDate(dateWithTime);
        isPaidFinal = keys.some((k) => k === mk || k === dk);
    }

    const cardExpense = Boolean(accForInstallments && isCardAccountType(accForInstallments.type));
    const recurringMonthly = isSplitRateio
        ? false
        : loanCat || cardExpense
          ? false
          : document.getElementById('expense-recurring-mode')?.value === '1';

    const isFixedExpense = document.getElementById('expense-is-fixed')?.value === '1';

    if (!id && recurringMonthly && accForInstallments && !isCreditCardType(accForInstallments.type) && !loanCat && !isSplitRateio) {
        isPaidFinal = false;
    }

    // Edição de saída simples: permite marcar/desmarcar "paga" no modal.
    if (id && !needsInstallments && !loanCat && !isSeriesRow) {
        const acc = getSelectedExpensePaymentAccount();
        const credit = Boolean(acc && isCreditCardType(acc.type));
        const paidInput = document.getElementById('expense-is-paid');
        if (!credit && orig && paidInput) {
            isPaidFinal = paidInput.value === '1';
        }
    }

    const data = {
        userId: currentUser.uid,
        description,
        amount,
        date: dateWithTime.toISOString(),
        accountId,
        category,
        subcategory: subcategory || null,
        isPaid: isPaidFinal,
        isInvestment: isSplitRateio && form.dataset.splitSourceIsInvestment === '1',
        installmentCount: installmentCount ?? null,
        recurringMonthly,
        isFixed: isFixedExpense
    };
    if (isSplitRateio && form.dataset.splitRequestId) {
        data.splitRequestId = form.dataset.splitRequestId;
    }
    if (isSplitRateio && Number.isFinite(splitSrcN) && splitSrcN >= 2) {
        data.mirrorInstallmentCount = splitSrcN;
    }

    if (installmentCount != null && installmentCount >= 2) {
        if (loanCat) {
            data.cashOutConfirmedPeriods =
                installmentCashOutKeysPayload && installmentCashOutKeysPayload.length > 0
                    ? JSON.stringify(installmentCashOutKeysPayload)
                    : null;
        } else if (accForInstallments && isCreditCardType(accForInstallments.type)) {
            data.cashOutConfirmedPeriods =
                installmentCashOutKeysPayload && installmentCashOutKeysPayload.length > 0
                    ? JSON.stringify(installmentCashOutKeysPayload)
                    : null;
        }
    }

    if (!needsInstallments && isSeriesRow && accForInstallments && !isCreditCardType(accForInstallments.type) && !loanCat) {
        const keys = getLoanPaidPeriodKeysFromForm(form);
        const mk = monthKeyFromDate(dateWithTime);
        const paid = keys.some((k) => k === mk || k === calendarDayKeyFromDate(dateWithTime));
        data.cashOutConfirmedPeriods = paid ? JSON.stringify([mk]) : null;
    }

    setFormSubmittingState(form, true, 'Salvando saída...');
    try {
        let result;
        if (id && recurringMonthly && !loanCat && !cardExpense && !isSeriesRow) {
            await deleteExpense(id);
            result = await saveExpense({ ...data, recurringMonthly: true }, null);
        } else if (id && isSeriesRow) {
            result = await saveExpense({ ...data, recurringMonthly: false }, id);
        } else {
            result = await saveExpense(data, id || null);
        }

        if (id && isSeriesRow && accForInstallments && !isCreditCardType(accForInstallments.type) && !loanCat) {
            const keys = getLoanPaidPeriodKeysFromForm(form);
            const gid = orig.recurrenceGroupId;
            const siblings = (userExpenses || []).filter(
                (x) => x.id !== id && String(x.recurrenceGroupId) === String(gid)
            );
            for (const e of siblings) {
                const d = movementDateToJsDate(e.date);
                const mk = monthKeyFromDate(d);
                const dk = calendarDayKeyFromDate(d);
                const paid = keys.some((k) => k === mk || k === dk);
                await saveExpense(
                    {
                        userId: currentUser.uid,
                        description: e.description,
                        amount: e.amount,
                        date: e.date,
                        accountId: e.accountId,
                        category: e.category,
                        subcategory: e.subcategory,
                        isPaid: paid,
                        isInvestment: e.isInvestment ?? false,
                        installmentCount: e.installmentCount ?? null,
                        recurringMonthly: false,
                        isFixed: Boolean(e.isFixed),
                        cashOutConfirmedPeriods: paid ? JSON.stringify([mk]) : null
                    },
                    e.id,
                    { skipUiSound: true }
                );
            }
        }

        const seriesCreated = result && result.recurring === true && Number(result.count) > 0;
        showToast(
            seriesCreated
                ? 'Série recorrente criada'
                : id && !seriesCreated
                  ? 'Saída atualizada!'
                  : 'Saída adicionada!',
            seriesCreated
                ? `${result.count} lançamentos (${formatCurrency(amount, 'BRL')} · ${category}) até dezembro`
                : `- ${formatCurrency(amount, 'BRL')} · ${category}`,
            'success'
        );
        closeModal('expense-modal');
        delete form.dataset.splitRequestId;
        delete form.dataset.splitFromRateio;
        delete form.dataset.splitSourceIsInvestment;
        delete form.dataset.splitSourceInstallmentCount;
        onUpdateCallback();
    } catch (error) {
        console.error('Erro ao salvar saída:', error);
        showToast(
            'Erro ao salvar',
            error?.message || 'Não foi possível salvar a saída. Tente novamente.',
            error?.status === 409 ? 'warning' : 'error'
        );
    } finally {
        setFormSubmittingState(form, false);
    }
}

async function handleGainFormSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.dataset.submitting === '1') return;
    const id = (form['gain-id'].value || '').trim();

    let hasErrors = false;
    form.querySelectorAll('.form-group').forEach((g) => g.classList.remove('error'));

    const description = form['gain-description'].value.trim();
    if (!description) {
        markFieldError(form['gain-description'], 'Informe uma descrição');
        hasErrors = true;
    }

    const amount = parseFloat(form['gain-amount'].value);
    if (!amount || amount <= 0) {
        markFieldError(form['gain-amount'], 'Informe um valor válido');
        hasErrors = true;
    }

    const accountId = form['gain-account']?.value?.trim() || '';
    if (!accountId) {
        markFieldError(form['gain-account'], 'Selecione uma conta');
        hasErrors = true;
    }

    const categorySelect = form['gain-category-select'];
    const category = categorySelect?.value?.trim() || '';
    if (!category) {
        markFieldError(categorySelect, 'Selecione ou crie uma categoria');
        hasErrors = true;
    }

    const gainSubSel = document.getElementById('gain-subcategory-select');
    let subcategory = '';
    if (gainSubSel && !gainSubSel.disabled) {
        subcategory = String(gainSubSel.value || '').trim();
    }
    if (subcategory === '__manage_subcategories__' || subcategory === '__add_new__') {
        subcategory = '';
    }

    const accForGain = accountId ? userAccounts?.find((a) => a.id === accountId) : null;
    if (accountId && (!accForGain || isCardAccountType(accForGain.type))) {
        markFieldError(form['gain-account'], 'Escolha uma conta cadastrada (o valor será creditado nela)');
        hasErrors = true;
    }

    if (hasErrors) {
        showToast('Campos obrigatórios', 'Preencha todos os campos destacados', 'warning');
        return;
    }

    // Combina a data selecionada com o horário atual para preservar ordem de cadastro
    const selectedDate = form['gain-date'].value;
    let dateWithTime;
    
    if (id) {
        // Edição: verifica se a data foi alterada
        const originalGain = userGains?.find((t) => t.id === id);
        const originalDate = originalGain ? movementDateToJsDate(originalGain.date).toISOString().split('T')[0] : '';
        
        if (originalDate === selectedDate) {
            // Data não mudou: mantém o timestamp original
            dateWithTime = movementDateToJsDate(originalGain.date);
        } else {
            // Data mudou: usa nova data com horário atual
            const now = new Date();
            dateWithTime = new Date(selectedDate + 'T' + 
                String(now.getHours()).padStart(2, '0') + ':' + 
                String(now.getMinutes()).padStart(2, '0') + ':' + 
                String(now.getSeconds()).padStart(2, '0'));
        }
    } else {
        // Novo registro: usa data com horário atual
        const now = new Date();
        dateWithTime = new Date(selectedDate + 'T' + 
            String(now.getHours()).padStart(2, '0') + ':' + 
            String(now.getMinutes()).padStart(2, '0') + ':' + 
            String(now.getSeconds()).padStart(2, '0'));
    }
    
    const isReceivedEl = document.getElementById('gain-is-received');
    const isPaid = isReceivedEl ? Boolean(isReceivedEl.checked) : true;

    const data = {
        userId: currentUser.uid,
        description,
        amount,
        date: dateWithTime.toISOString(),
        accountId,
        category,
        subcategory: subcategory || null,
        isPaid
    };

    if (!id) {
        data.isRecurring = document.getElementById('gain-recurring-mode')?.value === '1';
    }

    setFormSubmittingState(form, true, 'Salvando entrada...');
    try {
        const result = await saveGain(data, id || null);
        const isEdit = !!id;
        if (!isEdit && result && result.recurring === true && Number(result.count) > 1) {
            showToast(
                'Série recorrente criada',
                `${result.count} entradas (uma por mês até dezembro).`,
                'success'
            );
        } else {
        const catLine =
            subcategory && String(subcategory).trim() !== '' ? `${category} › ${subcategory}` : category;
            showToast(
                isEdit ? 'Entrada atualizada!' : 'Entrada adicionada!',
                `+ ${formatCurrency(amount, 'BRL')} · ${catLine}`,
                'success'
            );
        }
        closeModal('gain-modal');
        onUpdateCallback();
    } catch (error) {
        console.error('Erro ao salvar entrada:', error);
        showToast('Erro ao salvar', 'Não foi possível salvar a entrada. Tente novamente.', 'error');
    } finally {
        setFormSubmittingState(form, false);
    }
}

async function handleExpenseRowActions(e) {
    const instRowBtn = e.target.closest('.expense-inst-confirm-btn');
    if (instRowBtn) {
        e.preventDefault();
        e.stopPropagation();
        const expenseId = instRowBtn.dataset.expenseId;
        const periodKey = instRowBtn.dataset.periodKey;
        if (expenseId && periodKey) openInstallmentCashOutConfirmModal(expenseId, periodKey);
        return;
    }
    const pillBtn = e.target.closest('.installment-tooltip-pill-btn');
    if (pillBtn) {
        e.preventDefault();
        e.stopPropagation();
        const expenseId = pillBtn.dataset.expenseId;
        const periodKey = pillBtn.dataset.periodKey;
        if (expenseId && periodKey) openInstallmentCashOutConfirmModal(expenseId, periodKey);
        return;
    }
    const ringBtn = e.target.closest('.installment-ring-confirm-btn');
    if (ringBtn) {
        e.preventDefault();
        e.stopPropagation();
        const expenseId = ringBtn.dataset.expenseId;
        const periodKey = ringBtn.dataset.periodKey;
        if (expenseId && periodKey) {
            openInstallmentCashOutConfirmModal(expenseId, periodKey);
        }
        return;
    }
    const fixedToggleBtn = e.target.closest('button.expense-fixed-toggle');
    if (fixedToggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        const expenseId = fixedToggleBtn.dataset.expenseId?.trim();
        if (!expenseId || expenseFixedTogglePendingIds.has(expenseId)) return;
        const exp = userExpenses?.find((x) => x.id === expenseId);
        if (!exp) {
            showToast('Saída', 'Registo não encontrado na lista atual.', 'warning');
            return;
        }
        const nextFixed = !expenseIsMarkedFixed(exp);
        expenseFixedTogglePendingIds.add(expenseId);
        const togglesSameExpense = [...document.querySelectorAll('#expenses-table tbody button.expense-fixed-toggle')].filter(
            (b) => String(b.dataset.expenseId ?? '').trim() === expenseId
        );
        togglesSameExpense.forEach((btn) => setButtonLoading(btn, true));
        let succeeded = false;
        try {
            await patchExpensesBatch([expenseId], { isFixed: nextFixed });
            succeeded = true;
            playPingSound();
            onUpdateCallback?.();
        } catch (error) {
            console.error('Erro ao atualizar despesa essencial:', error);
            showToast(
                'Não foi possível atualizar',
                error?.message || 'Tente novamente.',
                error?.status === 409 ? 'warning' : 'error'
            );
        } finally {
            expenseFixedTogglePendingIds.delete(expenseId);
            if (!succeeded) {
                togglesSameExpense.forEach((btn) => {
                    if (btn.isConnected) setButtonLoading(btn, false);
                });
            }
        }
        return;
    }
    const paidToggleBtn = e.target.closest('button.expense-paid-toggle');
    if (paidToggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        const { pendingKey, snapshots } = expensePaidToggleSnapshotsFromButton(paidToggleBtn);
        if (!pendingKey || expensePaidTogglePendingKeys.has(pendingKey)) return;
        const expenseId = String(paidToggleBtn.dataset.expenseId ?? '').trim();
        const exp = userExpenses?.find((x) => x.id === expenseId);
        if (!exp) {
            showToast('Saída', 'Registo não encontrado na lista atual.', 'warning');
            return;
        }
        expensePaidTogglePendingKeys.add(pendingKey);
        snapshots.forEach(({ btn }) => setButtonLoading(btn, true));
        let succeeded = false;
        try {
            const mode = paidToggleBtn.dataset.paidToggleMode;
            if (mode === 'batch-is-paid') {
                const showsPaidNow = exp.isPaid !== false;
                await patchExpensesBatch([expenseId], { isPaid: !showsPaidNow });
                if (!showsPaidNow) {
                    playPingSound();
                }
            } else if (mode === 'monthly-fixed-unconfirm') {
                const anchor = movementDateToJsDate(exp.date);
                const rm = periodRemovalKeysFromDayAndMonth(
                    calendarDayKeyFromDate(anchor),
                    monthKeyFromDate(anchor)
                );
                await saveExpense(
                    expensePutPayloadFromRow(exp, {
                        cashOutConfirmedPeriods: filterCashOutConfirmedJsonAfterRemoval(exp, rm)
                    }),
                    expenseId,
                    { skipUiSound: true }
                );
            } else if (mode === 'period-keys-unconfirm') {
                const rm = periodRemovalKeysFromDayAndMonth(
                    paidToggleBtn.dataset.periodDay,
                    paidToggleBtn.dataset.periodMonth
                );
                await saveExpense(
                    expensePutPayloadFromRow(exp, {
                        cashOutConfirmedPeriods: filterCashOutConfirmedJsonAfterRemoval(exp, rm)
                    }),
                    expenseId,
                    { skipUiSound: true }
                );
            } else if (mode === 'inst-row-period-unconfirm') {
                const rm = periodRemovalKeysFromInstPeriodKey(paidToggleBtn.dataset.instPeriodKey);
                await saveExpense(
                    expensePutPayloadFromRow(exp, {
                        cashOutConfirmedPeriods: filterCashOutConfirmedJsonAfterRemoval(exp, rm)
                    }),
                    expenseId,
                    { skipUiSound: true }
                );
            }
            succeeded = true;
            onUpdateCallback?.();
        } catch (error) {
            console.error('Erro ao atualizar estado de pagamento:', error);
            showToast(
                'Não foi possível atualizar',
                error?.message || 'Tente novamente.',
                error?.status === 409 ? 'warning' : 'error'
            );
        } finally {
            expensePaidTogglePendingKeys.delete(pendingKey);
            if (!succeeded) {
                snapshots.forEach(({ btn }) => {
                    if (btn.isConnected) setButtonLoading(btn, false);
                });
            }
        }
        return;
    }
    const target = e.target.closest('button');
    if (!target) return;
    const rowId = target.dataset.id;
    if (!rowId) return;

    if (target.classList.contains('btn-split')) {
        const splitScope = target.dataset.splitScope || undefined;
        const targetInstallmentIndex =
            target.dataset.targetInstallmentIndex != null
                ? parseInt(String(target.dataset.targetInstallmentIndex), 10)
                : null;
        const targetPeriodKey = target.dataset.targetPeriodKey || undefined;
        void openExpenseSplitModal(rowId, {
            splitScope,
            targetInstallmentIndex,
            targetPeriodKey
        }).catch((err) => console.error(err));
        return;
    }

    if (target.classList.contains('btn-delete')) {
        if (confirm('Tem certeza que deseja excluir esta saída?')) {
            try {
                await runWithButtonLoading(target, () => deleteExpense(rowId));
                onUpdateCallback();
            } catch (error) {
                console.error('Erro ao excluir saída:', error);
                showToast(
                    'Não foi possível excluir',
                    error?.message || 'Tente novamente.',
                    error?.status === 409 ? 'warning' : 'error'
                );
            }
        }
    } else if (target.classList.contains('btn-edit')) {
        const row = userExpenses.find((t) => t.id === rowId);
        if (row) {
            openExpenseModal(true);
            const form = document.getElementById('expense-form');
            const paidRow = document.getElementById('expense-paid-row');
            const paidInput = document.getElementById('expense-is-paid');
            const rg = row.recurrenceGroupId != null && String(row.recurrenceGroupId).trim() !== '';
            if (rg) form.dataset.expenseRecurrenceGroupId = String(row.recurrenceGroupId);
            else delete form.dataset.expenseRecurrenceGroupId;
            form['expense-id'].value = row.id;
            form['expense-description'].value = row.description;
            form['expense-amount'].value = row.amount;
            form['expense-date'].value = movementDateToJsDate(row.date).toISOString().split('T')[0];
            // Aguarda o carregamento das categorias antes de selecionar
            populateExpensePaymentMethodSelect(row.accountId);
            populateExpenseCategorySelect(row.category).then(() => {
                populateExpenseSubcategorySelect(row.subcategory || '');
                form.dataset.loanPaymentAccountId = row.accountId;
                syncExpensePaymentMethodForLoanCategory();
                syncExpenseInstallmentsRow();
                const recMode = document.getElementById('expense-recurring-mode');
                if (recMode) {
                    if (row.recurrenceGroupId) {
                        recMode.value = '1';
                    } else if (!recMode.disabled) {
                        recMode.value = row.recurringMonthly ? '1' : '0';
                    }
                }
                const fxMode = document.getElementById('expense-is-fixed');
                if (fxMode && !fxMode.disabled) fxMode.value = Boolean(row.isFixed) ? '1' : '0';
                syncExpenseRecurringModeVisibility();
                syncExpenseFixedPaidGridLayout();
            });
            const inst = document.getElementById('expense-installments');
            if (inst) {
                const ic = row.installmentCount;
                inst.value =
                    ic != null && Number(ic) >= 1 ? String(Math.min(99, parseInt(String(ic), 10))) : '1';
            }
            // Toggle pago só para saída "simples" (sem cartão/parcelas/emprestimo/série).
            {
                const acc = userAccounts?.find((a) => a.id === row.accountId) || null;
                const loanCat = isLoanExpense({ category: row.category, subcategory: row.subcategory });
                const isSeriesRow = Boolean(row.recurrenceGroupId != null && String(row.recurrenceGroupId).trim() !== '');
                const nParc = parseInt(String(row.installmentCount ?? ''), 10);
                const needsInstallments = Boolean(
                    (acc && isCreditCardType(acc.type)) ||
                        (loanCat && (!acc || !isCreditCardType(acc.type)) && Number.isFinite(nParc) && nParc >= 2) ||
                        (Number.isFinite(nParc) && nParc >= 2)
                );
                const showPaidToggle = Boolean(!needsInstallments && !loanCat && !isSeriesRow);
                if (paidRow) paidRow.classList.toggle('hidden', !showPaidToggle);
                if (paidInput) paidInput.value = row.isPaid ? '1' : '0';
                syncExpenseFixedPaidGridLayout();
            }
            let loanPaidKeys = [];
            if (row.recurrenceGroupId != null && String(row.recurrenceGroupId).trim() !== '') {
                const merged = new Set();
                for (const ex of userExpenses || []) {
                    if (String(ex.recurrenceGroupId) !== String(row.recurrenceGroupId)) continue;
                    parseCashOutConfirmedPeriods(ex).forEach((k) => merged.add(k));
                }
                loanPaidKeys = [...merged];
            } else {
                const cop = row.cashOutConfirmedPeriods;
                if (cop != null && cop !== '') {
                    try {
                        const parsed = typeof cop === 'string' ? JSON.parse(cop) : cop;
                        if (Array.isArray(parsed)) loanPaidKeys = parsed.map((x) => String(x).trim()).filter(Boolean);
                    } catch {
                        loanPaidKeys = [];
                    }
                }
            }
            form.dataset.loanPaidPeriodKeys = JSON.stringify(loanPaidKeys);
            document.getElementById('expense-modal-title').textContent = 'Editar saída';
        }
    }
}

function buildGainPutPayloadFromRow(row, isPaidExplicit) {
    let subcategory = row.subcategory;
    if (subcategory != null && String(subcategory).trim() !== '') subcategory = String(subcategory).trim();
    else subcategory = null;
    const isPaid =
        typeof isPaidExplicit === 'boolean' ? isPaidExplicit : row.isPaid !== false;
    return {
        userId: currentUser?.uid,
        description: row.description,
        amount: Number(row.amount) || 0,
        date: row.date,
        accountId: row.accountId,
        category: row.category,
        subcategory,
        isPaid
    };
}

async function handleGainRowActions(e) {
    const recvBtn = e.target.closest('button.gain-received-toggle');
    if (recvBtn) {
        e.preventDefault();
        e.stopPropagation();
        const gid = String(recvBtn.dataset.gainId ?? '').trim();
        if (!gid || gainReceivedTogglePendingIds.has(gid)) return;
        const row = userGains?.find((t) => String(t.id) === gid);
        if (!row) {
            showToast('Entrada', 'Registo não encontrado na lista atual.', 'warning');
            return;
        }
        const showsReceivedNow = row.isPaid !== false;
        const nextIsPaid = !showsReceivedNow;
        gainReceivedTogglePendingIds.add(gid);
        setButtonLoading(recvBtn, true);
        let succeeded = false;
        try {
            await saveGain(buildGainPutPayloadFromRow(row, nextIsPaid), gid, { skipUiSound: !nextIsPaid });
            succeeded = true;
            onUpdateCallback?.();
        } catch (error) {
            console.error('Erro ao atualizar estado recebido da entrada:', error);
            showToast(
                'Não foi possível atualizar',
                error?.message || 'Tente novamente.',
                error?.status === 409 ? 'warning' : 'error'
            );
        } finally {
            gainReceivedTogglePendingIds.delete(gid);
            if (!succeeded && recvBtn.isConnected) setButtonLoading(recvBtn, false);
        }
        return;
    }

    const target = e.target.closest('button');
    if (!target) return;
    const rowId = target.dataset.id;
    if (!rowId) return;

    if (target.classList.contains('btn-delete')) {
        if (confirm('Tem certeza que deseja excluir esta entrada?')) {
            try {
                await runWithButtonLoading(target, () => deleteGain(rowId));
                onUpdateCallback();
            } catch (error) {
                console.error('Erro ao excluir entrada:', error);
                alert('Não foi possível excluir a entrada. Tente novamente.');
            }
        }
    } else if (target.classList.contains('btn-edit')) {
        const row = userGains.find((t) => t.id === rowId);
        if (row) {
            openGainModal(true);
            const form = document.getElementById('gain-form');
            form['gain-id'].value = row.id;
            form['gain-description'].value = row.description;
            form['gain-amount'].value = row.amount;
            form['gain-date'].value = movementDateToJsDate(row.date).toISOString().split('T')[0];
            await populateGainCategorySelect(row.category);
            await populateGainSubcategorySelect(row.subcategory || '', false);
            populateGainAccountSelect(row.accountId);
            const isReceived = document.getElementById('gain-is-received');
            if (isReceived) isReceived.checked = row.isPaid !== false;
            document.getElementById('gain-modal-title').textContent = 'Editar entrada';
        }
    }
}

const ACCOUNT_TYPE_LABELS = {
    conta_corrente: 'Conta corrente',
    poupanca: 'Poupança',
    dinheiro: 'Dinheiro',
    investimento: 'Investimento',
    outros: 'Outros'
};

const ACCOUNT_TYPE_ICONS = {
    conta_corrente: 'fa-building-columns',
    poupanca: 'fa-piggy-bank',
    dinheiro: 'fa-money-bill-wave',
    investimento: 'fa-chart-line',
    outros: 'fa-wallet'
};

function accountTypeDisplayLabel(type) {
    if (type && ACCOUNT_TYPE_LABELS[type]) return ACCOUNT_TYPE_LABELS[type];
    return String(type || 'Conta')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function accountTypeIconClass(type) {
    return ACCOUNT_TYPE_ICONS[type] || 'fa-landmark';
}

/** Chave visual para o card (gradiente + decoração), alinhada ao tipo de conta. */
function accountTypeVisualKey(type) {
    const t = String(type || '');
    if (t === 'conta_corrente') return 'cc';
    if (t === 'poupanca') return 'poup';
    if (t === 'dinheiro') return 'din';
    if (t === 'investimento') return 'inv';
    return 'out';
}

/** Normaliza o nome da conta para combinar tema visual de banco (acentos, caixa). */
function normalizeAccountNameForBankTheme(name) {
    return String(name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
}

/**
 * Se o nome corresponder a um banco conhecido, retorna a classe `account-card--bank-*`
 * (a ordem das regras evita ambiguidade entre nomes parecidos).
 */
function resolveBankThemeClass(name) {
    const s = normalizeAccountNameForBankTheme(name);
    if (!s.trim()) return '';
    const rules = [
        ['account-card--bank-caixa', () => s.includes('caixa economica') || s.includes('cef') || (s.includes('caixa') && s.includes('federal'))],
        ['account-card--bank-bb', () => s.includes('banco do brasil') || /\bbb\b/.test(s)],
        ['account-card--bank-mercado-pago', () => s.includes('mercado pago') || s.includes('mercadopago')],
        [
            'account-card--bank-inter',
            () =>
                s.includes('banco inter') ||
                s === 'inter' ||
                /^inter\s/.test(s) ||
                s.endsWith(' inter')
        ],
        ['account-card--bank-picpay', () => s.includes('picpay')],
        ['account-card--bank-pagbank', () => s.includes('pagbank') || s.includes('pag bank')],
        ['account-card--bank-c6', () => /\bc6\b/.test(s)],
        ['account-card--bank-santander', () => s.includes('santander')],
        ['account-card--bank-bradesco', () => s.includes('bradesco')],
        ['account-card--bank-nubank', () => s.includes('nubank')],
        ['account-card--bank-itau', () => s.includes('itau')],
        ['account-card--bank-pan', () => s.includes('banco pan') || s.includes('bancopan')],
        ['account-card--bank-neon', () => s.includes('neon')],
        ['account-card--bank-riachuelo', () => s.includes('riachuelo')]
    ];
    for (const [cls, test] of rules) {
        if (test()) return cls;
    }
    return '';
}

// --- Carteira (página unificada) — mês civil na timeline (igual Planejamento Base Zero) ---
const WALLET_MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

let walletSelectedMonth = 0;
let walletSelectedYear = 0;

function ensureWalletMonthDefaults() {
    const n = new Date();
    if (!walletSelectedMonth || walletSelectedMonth < 1 || walletSelectedMonth > 12) {
        walletSelectedMonth = n.getMonth() + 1;
    }
    if (!walletSelectedYear || walletSelectedYear < 2000) {
        walletSelectedYear = n.getFullYear();
    }
}
let initWalletPageUiOnceRan = false;
/** @type {{ accounts: any[], expenses: any[], gains: any[], currency: string, userProfile: any, expenseSplitRequests: any } | null} */
let walletRefreshCtx = null;

function walletMonthLabel() {
    return `${WALLET_MONTH_NAMES[walletSelectedMonth - 1]}/${String(walletSelectedYear).slice(-2)}`;
}

/** Soma das parcelas de cartão com vencimento no mês civil (YYYY-MM), com rateio líquido. */
function creditCardInstallmentsDueInCalendarMonth(card, expenses, year, month1to12, userProfile, acceptedSplits, allExpenses) {
    const y = Number(year);
    const m = Number(month1to12);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return 0;
    const monthKey = `${y}-${String(m).padStart(2, '0')}`;
    const list = allExpenses != null ? allExpenses : expenses || [];
    const splits = acceptedSplits != null ? acceptedSplits : [];
    let sum = 0;
    for (const t of expenses || []) {
        if (t.accountId !== card.id) continue;
        sum += expenseCreditInstallmentScheduledForMonthKey(t, card, monthKey, userProfile, splits, list);
    }
    return sum;
}

function renderWalletTimeline() {
    const timeline = document.querySelector('[data-wallet-timeline]');
    if (!timeline) return;
    const yShort = String(walletSelectedYear).slice(-2);
    timeline.innerHTML = WALLET_MONTH_NAMES.map((name, index) => {
        const monthNum = index + 1;
        const isActive = monthNum === walletSelectedMonth;
        const label = `${name}/${yShort}`;
        return `<button type="button" class="zero-budget__month-btn${isActive ? ' is-active' : ''}" data-wallet-month="${monthNum}" role="tab" aria-selected="${isActive ? 'true' : 'false'}">${label}</button>`;
    }).join('');
}

function initWalletPageUiOnce() {
    if (initWalletPageUiOnceRan) return;
    const page = document.getElementById('wallet-page');
    if (!page) return;
    initWalletPageUiOnceRan = true;
    page.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-wallet-month]');
        if (!btn || !page.contains(btn)) return;
        const m = parseInt(btn.getAttribute('data-wallet-month'), 10);
        if (!Number.isFinite(m) || m < 1 || m > 12) return;
        walletSelectedMonth = m;
        walletSelectedYear = new Date().getFullYear();
        const ctx = walletRefreshCtx;
        if (!ctx) return;
        loadWalletPage(ctx.accounts, ctx.expenses, ctx.gains, ctx.currency, ctx.userProfile, ctx.expenseSplitRequests);
    });
    page.addEventListener('keydown', handleCreditCardListKeydown);
}
/**
 * @param {any[]} accounts
 * @param {any[]} expenses
 * @param {any[]} gains
 * @param {string} currency
 * @param {any} [userProfile]
 * @param {{ incoming?: any[], outgoing?: any[] } | null} [expenseSplitRequests]
 */
export function loadWalletPage(accounts, expenses, gains, currency, userProfile = null, expenseSplitRequests = null) {
    initWalletPageUiOnce();
    const accs = accounts || [];
    const exps = expenses || [];
    const gns = gains || [];
    const cur = currency || 'BRL';
    const prof = userProfile !== null && userProfile !== undefined ? userProfile : financeUserProfile;
    walletRefreshCtx = {
        accounts: accs,
        expenses: exps,
        gains: gns,
        currency: cur,
        userProfile: prof,
        expenseSplitRequests: expenseSplitRequests ?? userExpenseSplitRequests
    };
    ensureWalletMonthDefaults();

    const list = document.getElementById('wallet-institutions-list');
    if (!list) return;

    const splitOut = expenseSplitRequests?.outgoing ?? userExpenseSplitRequests?.outgoing ?? [];
    const asOf = new Date();
    asOf.setHours(23, 59, 59, 999);
    const totalCash = computeCashBalanceTotalAsOf(accs, exps, gns, asOf, prof, splitOut);

    const creditCards = accs.filter((a) => isCreditCardType(a.type));
    const acceptedSplits = getOutgoingAcceptedSettledSplits();
    const monthKey = `${walletSelectedYear}-${String(walletSelectedMonth).padStart(2, '0')}`;
    const cardById = new Map(creditCards.map((c) => [c.id, c]));
    let totalInvoices = 0;
    for (const t of exps) {
        const c = cardById.get(t.accountId);
        if (!c) continue;
        totalInvoices += expenseCreditInstallmentScheduledForMonthKey(t, c, monthKey, prof, acceptedSplits, exps);
    }
    let totalLimit = 0;
    for (const c of creditCards) {
        const lim = parseFloat(String(c?.limit ?? '').replace(',', '.'));
        if (Number.isFinite(lim) && lim > 0) totalLimit += lim;
    }
    const netPurchasing = totalCash - totalInvoices;
    const pctLimit = totalLimit > 0 ? Math.min(100, (totalInvoices / totalLimit) * 100) : 0;

    const monLbl = walletMonthLabel();
    const elLimit = document.getElementById('wallet-summary-total-limit');
    const elInv = document.getElementById('wallet-summary-invoices');
    const elNet = document.getElementById('wallet-summary-net');
    const elBar = document.getElementById('wallet-summary-invoices-bar-fill');
    const elLimitHint = document.getElementById('wallet-summary-total-limit-hint');
    if (elLimit) elLimit.textContent = formatCurrency(totalLimit, cur);
    if (elInv) elInv.textContent = formatCurrency(totalInvoices, cur);
    if (elNet) elNet.textContent = formatCurrency(netPurchasing, cur);
    if (elBar) elBar.style.width = `${pctLimit}%`;
    if (elLimitHint) {
        elLimitHint.textContent =
            creditCards.length === 0
                ? 'Nenhum cartão de crédito cadastrado'
                : `${creditCards.length} cartão(ões) · limite somado`;
    }

    const byBankId = new Map(accs.filter((a) => !isCardAccountType(a.type)).map((a) => [a.id, a]));
    const linkedCredit = (id) => creditCards.filter((c) => c.linkedAccountId === id);
    const linkedBankOk = (lid) => !!(lid && byBankId.has(lid));

    const bankAccounts = accs.filter((a) => !isCardAccountType(a.type));
    const bankRowsSorted = bankAccounts
        .map((acc) => {
            const credits = linkedCredit(acc.id);
            let spendScore = 0;
            for (const c of credits) {
                spendScore += creditCardInstallmentsDueInCalendarMonth(
                    c,
                    exps,
                    walletSelectedYear,
                    walletSelectedMonth,
                    prof,
                    acceptedSplits,
                    exps
                );
            }
            return { acc, credits, spendScore };
        })
        .sort((a, b) => {
            if (b.spendScore !== a.spendScore) return b.spendScore - a.spendScore;
            return String(a.acc.name).localeCompare(String(b.acc.name), 'pt-BR');
        });

    const rowsHtml = [];
    let tint = 0;

    for (const { acc, credits } of bankRowsSorted) {
        // Coluna de cartões: só crédito; valores do mês selecionado na timeline.
        const hasCards = credits.length > 0;
        const typeLabel = accountTypeDisplayLabel(acc.type);
        const accountCol = `
            <div class="wallet-institution-row__label"><i class="fas ${accountTypeIconClass(acc.type)}" aria-hidden="true"></i> ${escapeHtml(typeLabel)}</div>
            <div class="wallet-institution-row__amount">${formatCurrency(Number(acc.currentBalance) || 0, cur)}</div>`;
        const cardsCol = buildWalletCardsColumnHtml(
            credits,
            exps,
            cur,
            walletSelectedYear,
            walletSelectedMonth,
            acc.id,
            prof,
            acceptedSplits
        );
        const actionsCol = `
            <div class="wallet-institution-row__row-actions">
                <button type="button" class="btn-action btn-edit" data-id="${escapeHtml(acc.id)}" title="Editar conta" aria-label="Editar conta"><i class="fas fa-pen" aria-hidden="true"></i></button>
                <button type="button" class="btn-action btn-delete" data-id="${escapeHtml(acc.id)}" title="Excluir conta" aria-label="Excluir conta"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
            </div>`;
        rowsHtml.push(`
            <article class="wallet-institution-row wallet-institution-row--tint-${tint % 5}" data-has-account="1" data-has-cards="${hasCards ? '1' : '0'}">
                <div class="wallet-institution-row__strip" aria-hidden="true"></div>
                <div class="wallet-institution-row__bank">
                    <h3>${escapeHtml(acc.name)}</h3>
                    <span class="wallet-institution-row__meta">Conta</span>
                </div>
                <div class="wallet-institution-row__account">${accountCol}</div>
                <div class="wallet-institution-row__cards">${cardsCol}</div>
                ${actionsCol}
            </article>`);
        tint += 1;
    }

    const orphanCredits = creditCards
        .filter((c) => !linkedBankOk(c.linkedAccountId))
        .sort((a, b) => {
            const sa = creditCardInstallmentsDueInCalendarMonth(
                a,
                exps,
                walletSelectedYear,
                walletSelectedMonth,
                prof,
                acceptedSplits,
                exps
            );
            const sb = creditCardInstallmentsDueInCalendarMonth(
                b,
                exps,
                walletSelectedYear,
                walletSelectedMonth,
                prof,
                acceptedSplits,
                exps
            );
            if (sb !== sa) return sb - sa;
            return String(a.name).localeCompare(String(b.name), 'pt-BR');
        });
    for (const c of orphanCredits) {
        const cardsCol = buildWalletCardsColumnHtml(
            [c],
            exps,
            cur,
            walletSelectedYear,
            walletSelectedMonth,
            null,
            prof,
            acceptedSplits
        );
        rowsHtml.push(`
            <article class="wallet-institution-row wallet-institution-row--tint-${tint % 5}" data-has-account="0" data-has-cards="1">
                <div class="wallet-institution-row__strip" aria-hidden="true"></div>
                <div class="wallet-institution-row__bank">
                    <h3>${escapeHtml(c.name)}</h3>
                    <span class="wallet-institution-row__meta">Cartão (sem conta vinculada)</span>
                </div>
                <div class="wallet-institution-row__account">
                    <div class="wallet-institution-row__empty"><i class="fas fa-lock" aria-hidden="true"></i> Sem conta atrelada</div>
                </div>
                <div class="wallet-institution-row__cards">${cardsCol}</div>
                <div class="wallet-institution-row__row-actions"></div>
            </article>`);
        tint += 1;
    }

    const hasAnyBank = accs.some((a) => !isCardAccountType(a.type));
    const debitCards = accs.filter((a) => isCardAccountType(a.type) && !isCreditCardType(a.type));
    const hasAnyCard = creditCards.length > 0 || debitCards.length > 0;
    if (!hasAnyBank && !hasAnyCard) {
        list.innerHTML = `
            <div class="accounts-empty-state">
                <div class="accounts-empty-state__icon" aria-hidden="true"><i class="fas fa-wallet"></i></div>
                <p class="accounts-empty-state__title">Carteira vazia</p>
                <p class="accounts-empty-state__text">Use o botão <strong>Nova</strong> no topo da página (ao lado dos avisos) para criar conta e, se quiser, cartões na mesma instituição.</p>
            </div>`;
    } else {
        list.innerHTML = rowsHtml.join('');
    }

    const dueTitle = document.querySelector('#wallet-due-panel .wallet-aside-card__title');
    if (dueTitle) {
        dueTitle.innerHTML = `<i class="fas fa-calendar-check" aria-hidden="true"></i> Vencimentos · ${escapeHtml(monLbl)}`;
    }
    const actTitle = document.querySelector('#wallet-activity-panel .wallet-aside-card__title');
    if (actTitle) {
        actTitle.innerHTML = `<i class="fas fa-receipt" aria-hidden="true"></i> Compras na fatura <span class="wallet-aside-card__title-note">(${escapeHtml(monLbl)})</span>`;
    }

    const dueHost = document.getElementById('wallet-due-list');
    if (dueHost) {
        const sorted = [...creditCards].sort((a, b) => {
            const da = Number(a.dueDay) || 0;
            const db = Number(b.dueDay) || 0;
            if (da !== db) return da - db;
            return String(a.name).localeCompare(String(b.name), 'pt-BR');
        });
        if (sorted.length === 0) {
            dueHost.innerHTML = '<p class="wallet-aside-empty">Nenhum cartão de crédito.</p>';
        } else {
            dueHost.innerHTML = sorted
                .map((c) => {
                    const inv = creditCardInstallmentsDueInCalendarMonth(
                        c,
                        exps,
                        walletSelectedYear,
                        walletSelectedMonth,
                        prof,
                        acceptedSplits,
                        exps
                    );
                    const due = c.dueDay != null ? `Dia ${c.dueDay}` : '—';
                    return `
                <div class="wallet-aside-row">
                    <div>
                        <div class="wallet-aside-row__name">${escapeHtml(c.name)}</div>
                        <div class="wallet-aside-row__sub">${escapeHtml(due)}</div>
                    </div>
                    <div class="wallet-aside-row__amt">${formatCurrency(inv, cur)}</div>
                </div>`;
                })
                .join('');
        }
    }

    const actHost = document.getElementById('wallet-activity-list');
    if (actHost) {
        const merged = [];
        for (const t of exps) {
            const c = cardById.get(t.accountId);
            if (!c) continue;
            const contrib = expenseCreditInstallmentScheduledForMonthKey(
                t,
                c,
                monthKey,
                prof,
                acceptedSplits,
                exps
            );
            if (!Number.isFinite(contrib) || contrib === 0) continue;
            const inst = getCreditInstallmentIndexDueInMonthKey(t, c, monthKey);
            merged.push({
                date: t.date,
                label: t.description || 'Saída',
                amount: -Math.abs(contrib),
                cardName: c.name,
                inst
            });
        }
        merged.sort((a, b) => movementDateToJsDate(b.date).getTime() - movementDateToJsDate(a.date).getTime());
        const top = merged.slice(0, 12);
        if (top.length === 0) {
            actHost.innerHTML = `<p class="wallet-aside-empty">Nenhuma parcela desta fatura com vencimento em ${escapeHtml(monLbl)}.</p>`;
        } else {
            actHost.innerHTML = top
                .map((m) => {
                    const sub =
                        m.inst != null
                            ? `Parcela ${m.inst.index} de ${m.inst.total} · ${escapeHtml(m.cardName)}`
                            : escapeHtml(m.cardName);
                    return `
                <div class="wallet-activity-row">
                    <span class="wallet-activity-row__dot wallet-activity-row__dot--out" aria-hidden="true"></span>
                    <div class="wallet-activity-row__body">
                        <span class="wallet-activity-row__lbl">${escapeHtml(m.label)}</span>
                        <span class="wallet-activity-row__sub">${sub}</span>
                    </div>
                    <span class="wallet-activity-row__val wallet-activity-row__val--out">${formatCurrency(m.amount, cur)}</span>
                </div>`;
                })
                .join('');
        }
    }

    renderWalletTimeline();
}

/** Coluna direita: só cartões de crédito; parcelas com vencimento no mês civil. `linkBankId` permite atalho «Adicionar cartão». */
function buildWalletCardsColumnHtml(
    creditList,
    expenses,
    currency,
    year,
    month1to12,
    linkBankId = null,
    userProfile = null,
    acceptedSplits = null
) {
    const parts = [];
    for (const c of creditList) {
        const bill = creditCardInstallmentsDueInCalendarMonth(
            c,
            expenses,
            year,
            month1to12,
            userProfile,
            acceptedSplits,
            expenses
        );
        const lim = Number(c.limit);
        const pct = Number.isFinite(lim) && lim > 0 ? Math.min(100, (bill / lim) * 100) : 0;
        const due = c.dueDay != null ? `Vence dia ${c.dueDay}` : 'Vencimento —';
        parts.push(`
            <div class="wallet-credit-block">
                <button type="button" tabindex="0" class="wallet-card-open credit-card-card--interactive" data-card-id="${escapeHtml(c.id)}" aria-label="Ver lançamentos: ${escapeHtml(c.name)}">
                    <div class="wallet-credit-block__head wallet-credit-block__head--due-only">
                        <span class="wallet-credit-block__due">${escapeHtml(due)}</span>
                    </div>
                    <div class="wallet-institution-row__label wallet-institution-row__label--credit-inline"><i class="fas fa-calendar-alt" aria-hidden="true"></i> Parcelas no mês</div>
                    <div class="wallet-institution-row__amount wallet-institution-row__amount--credit wallet-institution-row__amount--credit-compact">${formatCurrency(bill, currency)}</div>
                    <div class="wallet-kpi-progress" aria-hidden="true"><span class="wallet-kpi-progress__fill" style="width:${pct}%"></span></div>
                </button>
            </div>`);
    }
    if (parts.length === 0) {
        const link =
            linkBankId != null && String(linkBankId).trim() !== ''
                ? `<button type="button" class="wallet-link-add-card" data-wallet-link-credit="${escapeHtml(String(linkBankId))}">Adicionar cartão de crédito</button>`
                : '';
        return `<div class="wallet-institution-row__empty"><i class="fas fa-lock" aria-hidden="true"></i> Sem cartão de crédito atrelado${link}</div>`;
    }
    return parts.join('');
}

// --- LÓGICA DE CONTAS E CARTÕES ---
export function loadAccountsData(accounts, currency) {
    const list = document.getElementById('accounts-list');
    if (!list) return;
    list.innerHTML = '';
    const rows = accounts.filter((acc) => !isCardAccountType(acc.type));
    if (rows.length === 0) {
        list.innerHTML = `
            <div class="accounts-empty-state">
                <div class="accounts-empty-state__icon" aria-hidden="true"><i class="fas fa-wallet"></i></div>
                <p class="accounts-empty-state__title">Nenhuma conta cadastrada</p>
                <p class="accounts-empty-state__text">Use <strong>Nova conta</strong> para corrente, poupança, investimento
                    ou outras contas — os cartões ficam na secção <strong>Cartões</strong> abaixo.</p>
            </div>`;
        return;
    }
    rows.forEach((acc, index) => {
        const article = document.createElement('article');
        const tipo = accountTypeVisualKey(acc.type);
        const bankClass = resolveBankThemeClass(acc.name);
        const tint = bankClass ? '' : ` account-card--tint-${index % 5}`;
        article.className = `account-card account-card--landscape account-card--tipo-${tipo}${bankClass ? ` ${bankClass}` : ''}${tint}`;
        const nameSafe = escapeHtml(acc.name);
        const holderRaw = acc.holderName != null && String(acc.holderName).trim() !== '' ? String(acc.holderName).trim() : '';
        const holderBlock = holderRaw
            ? `<p class="account-card__holder">${escapeHtml(holderRaw)}</p>`
            : '';
        const typeLabel = escapeHtml(accountTypeDisplayLabel(acc.type));
        const iconClass = accountTypeIconClass(acc.type);
        article.innerHTML = `
            <div class="account-card__scene" aria-hidden="true">
                <div class="account-card__scene-art">
                    <div class="account-card__fin-bg"></div>
                    <div class="account-card__fin-grid"></div>
                    <div class="account-card__fin-pillars"><span></span><span></span><span></span></div>
                    <div class="account-card__fin-bars">
                        <span></span><span></span><span></span><span></span><span></span>
                    </div>
                    <div class="account-card__fin-coins">
                        <span></span><span></span><span></span>
                    </div>
                    <div class="account-card__fin-trend"></div>
                    <div class="account-card__scene-veil"></div>
                </div>
                <div class="account-card__scene-overlay">
                    <span class="account-card__badge">
                        <i class="fas ${iconClass}" aria-hidden="true"></i>
                        ${typeLabel}
                    </span>
                    <div class="account-card__actions">
                        <button type="button" class="btn-action btn-edit" data-id="${acc.id}" title="Editar conta" aria-label="Editar conta"><i class="fas fa-pen" aria-hidden="true"></i></button>
                        <button type="button" class="btn-action btn-delete" data-id="${acc.id}" title="Excluir conta" aria-label="Excluir conta"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
                    </div>
                </div>
                <div class="account-card__scene-icon"><i class="fas ${iconClass}" aria-hidden="true"></i></div>
            </div>
            <div class="account-card__body">
                <h3 class="account-card__title">${nameSafe}</h3>
                ${holderBlock}
            </div>`;
        list.appendChild(article);
    });
}

function openNewAccountModal() {
    hideWalletWizardUi();
    const form = document.getElementById('account-form');
    if (!form) return;
    setAccountTypeSelectMode('full');
    form.reset();
    form['account-id'].value = '';
    document.getElementById('account-modal-title').textContent = 'Nova Conta';
    const sub = document.getElementById('account-modal-subtitle');
    if (sub) {
        sub.textContent = '';
        sub.classList.add('hidden');
    }
    toggleCreditCardFields(form['account-type'].value);
    openModal('account-modal');
}

function openNewCreditCardModal(preLinkedBankId = null) {
    hideWalletWizardUi();
    const bankCount = (userAccounts || []).filter((a) => !isCardAccountType(a.type)).length;
    if (!preLinkedBankId && bankCount === 0) {
        showToast(
            'Conta necessária',
            'Crie primeiro uma conta na Carteira (botão Nova no topo) antes de vincular um cartão.',
            'warning'
        );
        return;
    }
    if (
        preLinkedBankId &&
        !(userAccounts || []).some((a) => a.id === preLinkedBankId && !isCardAccountType(a.type))
    ) {
        showToast('Conta inválida', 'Não foi possível encontrar a conta para vincular o cartão.', 'warning');
        return;
    }
    const form = document.getElementById('account-form');
    if (!form) return;
    setAccountTypeSelectMode('cardsOnly');
    form.reset();
    form['account-id'].value = '';
    form['account-type'].value = 'cartao_credito';
    toggleCreditCardFields('cartao_credito');
    if (preLinkedBankId) {
        const sel = document.getElementById('card-linked-account');
        if (sel) sel.value = preLinkedBankId;
    }
    document.getElementById('account-modal-title').textContent = 'Novo cartão';
    const sub = document.getElementById('account-modal-subtitle');
    if (sub) {
        sub.textContent = '';
        sub.classList.add('hidden');
    }
    openModal('account-modal');
}

/** Preenche o modal de conta/cartão para edição (contas e tela de cartões). */
function fillAndOpenAccountForm(acc) {
    const form = document.getElementById('account-form');
    if (!form || !acc) return;
    hideWalletWizardUi();
    setAccountTypeSelectMode(isCardAccountType(acc.type) ? 'cardsOnly' : 'full');
    form['account-id'].value = acc.id;
    form['account-name'].value = acc.name;
    form['account-type'].value = acc.type;
    const holderEl = form['card-holder-name'];
    if (holderEl) {
        holderEl.value = acc.holderName != null && acc.holderName !== '' ? String(acc.holderName) : '';
    }
    toggleCreditCardFields(acc.type);
    if (acc.type === 'cartao_credito' || acc.type === 'cartao_debito') {
        const sel = document.getElementById('card-linked-account');
        if (sel) sel.value = acc.linkedAccountId || '';
    }
    if (acc.type === 'cartao_credito') {
        form['card-limit'].value = acc.limit != null ? acc.limit : '';
        form['card-closing-day'].value = acc.closeDay != null ? acc.closeDay : '';
        form['card-due-day'].value = acc.dueDay != null ? acc.dueDay : '';
    }
    document.getElementById('account-modal-title').textContent = isCardAccountType(acc.type)
        ? 'Editar cartão'
        : 'Editar Conta';
    const sub = document.getElementById('account-modal-subtitle');
    if (sub) {
        sub.textContent = '';
        sub.classList.add('hidden');
    }
    openModal('account-modal');
}

async function handleAccountFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const id = form['account-id'].value;
    const type = form['account-type'].value;
    const mode = document.getElementById('account-form-mode')?.value || '';
    const nameTrim = (form['account-name']?.value || '').trim();
    if (!nameTrim) {
        showMessage('account-message', 'O nome da conta é obrigatório.', 'error');
        return;
    }

    const holderTrim = (form['card-holder-name']?.value || '').trim();

    if (mode === 'wallet_wizard' && !id) {
        const addCr = document.getElementById('wallet-wizard-add-credit')?.checked === true;
        const addDb = document.getElementById('wallet-wizard-add-debit')?.checked === true;

        if (addCr) {
            const lim = parseFloat(String(form.querySelector('#wizard-credit-limit')?.value || '').replace(',', '.'));
            const closeDay = parseInt(form.querySelector('#wizard-credit-closing-day')?.value, 10);
            const dueDay = parseInt(form.querySelector('#wizard-credit-due-day')?.value, 10);
            if (!Number.isFinite(lim) || lim <= 0) {
                showMessage('account-message', 'Indique um limite válido (> 0) para o cartão de crédito.', 'error');
                return;
            }
            if (
                !Number.isFinite(closeDay) ||
                closeDay < 1 ||
                closeDay > 31 ||
                !Number.isFinite(dueDay) ||
                dueDay < 1 ||
                dueDay > 31
            ) {
                showMessage(
                    'account-message',
                    'Indique dias de fechamento e vencimento entre 1 e 31 para o cartão de crédito.',
                    'error'
                );
                return;
            }
        }

        const bankPayload = {
            userId: currentUser.uid,
            name: nameTrim,
            type,
            initialBalance: 0,
            holderName: holderTrim || null
        };

        let cardSteps = 0;
        if (addCr) cardSteps += 1;
        if (addDb) cardSteps += 1;
        let remainingSounds = cardSteps;

        setFormSubmittingState(form, true, 'A guardar…');
        let createdBank = null;
        try {
            createdBank = await saveAccount(bankPayload, '', { skipUiSound: remainingSounds > 0 });
            const bid = createdBank?.id;
            if (!bid) {
                throw new Error('Resposta sem id da conta.');
            }

            const holderCard = holderTrim || nameTrim;

            if (addCr) {
                const crNameRaw = (form.querySelector('#wizard-credit-card-name')?.value || '').trim();
                const crName = crNameRaw || `${nameTrim} Crédito`;
                const lim = parseFloat(
                    String(form.querySelector('#wizard-credit-limit')?.value || '').replace(',', '.')
                );
                const closeDay = parseInt(form.querySelector('#wizard-credit-closing-day')?.value, 10);
                const dueDay = parseInt(form.querySelector('#wizard-credit-due-day')?.value, 10);
                const creditData = {
                    userId: currentUser.uid,
                    name: crName,
                    type: 'cartao_credito',
                    linkedAccountId: bid,
                    holderName: holderCard,
                    limit: lim,
                    closeDay,
                    dueDay,
                    plasticTone: null,
                    plasticColor: null
                };
                remainingSounds -= 1;
                await saveAccount(creditData, '', { skipUiSound: remainingSounds > 0 });
            }

            if (addDb) {
                const dbNameRaw = (form.querySelector('#wizard-debit-card-name')?.value || '').trim();
                const dbName = dbNameRaw || `${nameTrim} Débito`;
                const debitData = {
                    userId: currentUser.uid,
                    name: dbName,
                    type: 'cartao_debito',
                    linkedAccountId: bid,
                    holderName: holderCard,
                    initialBalance: 0,
                    plasticTone: null,
                    plasticColor: null
                };
                remainingSounds -= 1;
                await saveAccount(debitData, '', { skipUiSound: remainingSounds > 0 });
            }

            hideWalletWizardUi();
            closeModal('account-modal');
            onUpdateCallback();
        } catch (error) {
            console.error('Erro ao salvar carteira:', error);
            const msg =
                error?.message ||
                (typeof error === 'string' ? error : 'Não foi possível guardar. Tente novamente.');
            if (createdBank?.id) {
                onUpdateCallback();
                hideWalletWizardUi();
                closeModal('account-modal');
                showToast(
                    'Conta criada',
                    `${msg} Pode completar o cartão com «Adicionar cartão de crédito» na linha da conta ou com Nova no topo.`,
                    'warning'
                );
            } else {
                showMessage('account-message', msg, 'error');
            }
        } finally {
            setFormSubmittingState(form, false);
        }
        return;
    }

    const data = {
        userId: currentUser.uid,
        name: nameTrim,
        type: type
    };

    if (type !== 'cartao_credito' && type !== 'cartao_debito' && !id) {
        data.initialBalance = 0;
    }

    if (isCardAccountType(type)) {
        data.holderName = holderTrim;
        data.plasticTone = null;
        data.plasticColor = null;
    }

    if (type === 'cartao_credito' || type === 'cartao_debito') {
        const linked = (form['card-linked-account']?.value || '').trim();
        if (!linked) {
            showMessage(
                'account-message',
                'Selecione a conta existente à qual este cartão está vinculado.',
                'error'
            );
            return;
        }
        data.linkedAccountId = linked;
        if (type === 'cartao_credito') {
            data.limit = parseFloat(form['card-limit'].value) || 0;
            data.closeDay = parseInt(form['card-closing-day'].value, 10);
            data.dueDay = parseInt(form['card-due-day'].value, 10);
            delete data.initialBalance;
        } else {
            data.initialBalance = 0;
        }
    } else {
        data.linkedAccountId = null;
        data.holderName = holderTrim || null;
    }

    setFormSubmittingState(form, true, 'Salvando conta...');
    try {
        await saveAccount(data, id);
        closeModal('account-modal');
        onUpdateCallback();
    } catch (error) {
        console.error('Erro ao salvar conta:', error);
        showMessage('account-message', 'Não foi possível salvar a conta. Tente novamente.', 'error');
    } finally {
        setFormSubmittingState(form, false);
    }
}

async function handleAccountActions(e) {
    const button = e.target.closest('button');
    if (!button) return;
    const id = button.dataset.id;
    if (!id) return;

    if (button.classList.contains('btn-edit')) {
        const acc = userAccounts.find((a) => a.id === id);
        if (acc) fillAndOpenAccountForm(acc);
    } else if (button.classList.contains('btn-delete')) {
        if (confirm('Tem certeza que deseja excluir esta conta? Saídas e entradas associadas a ela também serão removidas.')) {
            try {
                await runWithButtonLoading(button, () => deleteAccount(id));
                onUpdateCallback();
            } catch (error) {
                console.error('Erro ao excluir conta:', error);
                alert('Não foi possível excluir a conta. Verifique se existem dados associados.');
            }
        }
    }
}

/**
 * Preenche &lt;select&gt; de conta.
 * @param {HTMLSelectElement} selectElement
 * @param {{ includeCards?: boolean }} [options] — em despesas use `includeCards: true` para listar cartões (crédito/débito) em grupo separado.
 */
function populateAccountOptions(selectElement, options = {}) {
    if (!selectElement) return;
    const includeCards = options.includeCards === true;
    selectElement.innerHTML = '<option value="">Selecione</option>';

    if (includeCards) {
        const regular = userAccounts
            .filter((a) => !isCardAccountType(a.type))
            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
        const cards = userAccounts
            .filter((a) => isCardAccountType(a.type))
            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));

        if (regular.length) {
            const og = document.createElement('optgroup');
            og.label = 'Contas';
            regular.forEach((acc) => {
                const opt = document.createElement('option');
                opt.value = acc.id;
                opt.textContent = acc.name;
                og.appendChild(opt);
            });
            selectElement.appendChild(og);
        }
        if (cards.length) {
            const og = document.createElement('optgroup');
            og.label = 'Cartões';
            cards.forEach((acc) => {
                const opt = document.createElement('option');
                opt.value = acc.id;
                const kind = isCreditCardType(acc.type) ? 'crédito' : 'débito';
                opt.textContent = `${acc.name} (${kind})`;
                og.appendChild(opt);
            });
            selectElement.appendChild(og);
        }
        return;
    }

    userAccounts.filter((a) => !isCreditCardType(a.type)).forEach((acc) => {
        selectElement.innerHTML += `<option value="${acc.id}">${acc.name}</option>`;
    });
}

function getLastInstallmentMonthLabel(dateField, installmentCount) {
    const n = parseInt(String(installmentCount ?? ''), 10);
    if (!Number.isFinite(n) || n < 2) return '—';
    const d = movementDateToJsDate(dateField);
    const last = new Date(d.getFullYear(), d.getMonth() + (n - 1), 1);
    const s = last.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function parcelasLabel(ic) {
    const n = parseInt(String(ic ?? ''), 10);
    if (!Number.isFinite(n) || n < 1) return 'À vista';
    if (n === 1) return 'À vista';
    return `${n}x`;
}


function getSortedFilteredCardPurchasesList() {
    return sortCardPurchaseRows(getFilteredCardPurchasesList(), cardPurchasesSort, userAccounts);
}

function getFilteredCardPurchasesList() {
    const { sorted, currency, userProfile: cardProf } = cardPurchasesCache;
    const needle = cardPurchasesFilterQ.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((t) => {
        const dateStr = movementDateToJsDate(t.date).toLocaleDateString('pt-BR');
        const parcelas = parcelasLabel(t.installmentCount);
        const n = parseInt(String(t.installmentCount ?? ''), 10);
        const ultima = Number.isFinite(n) && n >= 2 ? getLastInstallmentMonthLabel(t.date, n) : '—';
        const cardAcc = userAccounts?.find((a) => a.id === t.accountId);
        const status = formatInstallmentStatusPlain(t, cardAcc, new Date(), cardProf);
        const perParc = getExpensePerInstallmentDisplayAmount(t, cardAcc);
        const hay = [
            dateStr,
            String(t.description ?? ''),
            String(t.category ?? ''),
            formatCurrency(t.amount, currency),
            formatCurrency(perParc, currency),
            parcelas,
            ultima,
            status
        ]
            .join(' ')
            .toLowerCase();
        return hay.includes(needle);
    });
}

function applyCardPurchasesFilters() {
    cardPurchasesFilterQ = document.getElementById('card-purchases-filter-q')?.value || '';
    if (!cardPurchasesPagination) return;
    cardPurchasesPagination.setTotal(getSortedFilteredCardPurchasesList().length, { resetPage: true });
    renderCardPurchasesBodySlice();
}

function renderCardPurchasesBodySlice() {
    const tbody = document.getElementById('card-purchases-tbody');
    if (!tbody || !cardPurchasesPagination) return;
    const currency = cardPurchasesCache?.currency || 'BRL';
    const cardUserProfile = cardPurchasesCache?.userProfile ?? null;
    const list = getSortedFilteredCardPurchasesList();
    const { start, end } = cardPurchasesPagination.getSliceRange();
    tbody.innerHTML = '';
    list.slice(start, end).forEach((t) => {
        const ic = t.installmentCount;
        const n = parseInt(String(ic ?? ''), 10);
        const parcelas = parcelasLabel(ic);
        const ultima = Number.isFinite(n) && n >= 2 ? getLastInstallmentMonthLabel(t.date, n) : '—';
        const cardAcc = userAccounts?.find((a) => a.id === t.accountId);
        const fullyPaid =
            cardAcc && isCreditCardType(cardAcc.type)
                ? isCreditInstallmentFullyPaid(t, cardAcc, new Date(), financeUserProfile)
                : !!t.isPaid;
        const isPending = !fullyPaid;
        const statusPlain = formatInstallmentStatusPlain(t, cardAcc, new Date(), cardUserProfile);
        const statusInner =
            cardAcc && isCreditCardType(cardAcc.type)
                ? formatInstallmentPopoverHtml(t, cardAcc, currency, new Date(), cardUserProfile)
                : `<span class="card-purchases-status ${isPending ? 'card-purchases-status--pending' : 'card-purchases-status--paid'}">${escapeHtml(statusPlain)}</span>`;
        const statusHtml =
            cardAcc && isCreditCardType(cardAcc.type)
                ? `<div class="card-purchases-status-ring">${statusInner}</div>`
                : statusInner;
        const descRaw = String(t.description ?? '');
        const descTitle = descRaw.length > 48 ? htmlAttrEscape(descRaw) : '';
        const descCell = descTitle
            ? `<span class="card-purchases-desc" title="${descTitle}">${truncateDisplayHtml(t.description, 48)}</span>`
            : `<span class="card-purchases-desc">${escapeHtml(t.description)}</span>`;
        const dateObj = movementDateToJsDate(t.date);
        const dateIso = dateObj.toISOString().slice(0, 10);
        const displayAmt = getExpensePerInstallmentDisplayAmount(t, cardAcc);
        const totalAmt = Number(t.amount) || 0;
        const amountTitle =
            displayAmt !== totalAmt && totalAmt > 0
                ? ` title="Total da compra: ${formatCurrency(totalAmt, currency)}"`
                : '';
        const tr = document.createElement('tr');
        tr.className = isPending ? 'card-purchases-row card-purchases-row--pending' : 'card-purchases-row';
        tr.innerHTML = `
                <td class="card-purchases-td-date"><time datetime="${dateIso}">${dateObj.toLocaleDateString('pt-BR')}</time></td>
                <td class="card-purchases-td-desc">${descCell}</td>
                <td class="card-purchases-td-cat">${escapeHtml(t.category)}</td>
                <td class="card-purchases-td-amount"${amountTitle}>${formatCurrency(displayAmt, currency)}</td>
                <td>${parcelas}</td>
                <td>${ultima}</td>
                <td class="card-purchases-td-status">${statusHtml}</td>
            `;
        tbody.appendChild(tr);
    });
    setupInstallmentPopovers(tbody);
}

function openCardPurchasesModal(accountId) {
    const card = userAccounts?.find((a) => a.id === accountId);
    if (!card || !isCardAccountType(card.type)) return;
    const currency = lastCardsPageCurrency || 'BRL';
    const sorted = [...(userExpenses || []).filter((t) => t.accountId === accountId)].sort(
        (a, b) => movementDateToUnixSeconds(b.date) - movementDateToUnixSeconds(a.date)
    );

    const titleEl = document.getElementById('card-purchases-modal-title');
    const subtitleEl = document.getElementById('card-purchases-modal-subtitle');
    const badgeEl = document.getElementById('card-purchases-modal-badge');
    const summaryEl = document.getElementById('card-purchases-summary');
    const tbody = document.getElementById('card-purchases-tbody');
    const emptyEl = document.getElementById('card-purchases-empty');
    const listSectionEl = document.getElementById('card-purchases-list-section');
    const paginationHost = document.getElementById('card-purchases-pagination');
    const filtersWrap = document.getElementById('card-purchases-filters-wrap');
    if (!titleEl || !summaryEl || !tbody || !emptyEl) return;

    cardPurchasesFilterQ = '';
    const fqEl = document.getElementById('card-purchases-filter-q');
    if (fqEl) fqEl.value = '';

    const isCredit = isCreditCardType(card.type);
    const typeLabel = isCredit ? 'Cartão de crédito' : 'Cartão de débito';
    const holder = card.holderName && String(card.holderName).trim() ? String(card.holderName).trim() : '';
    titleEl.textContent = card.name;
    if (subtitleEl) {
        subtitleEl.textContent = holder ? `${typeLabel} · ${holder}` : typeLabel;
    }
    if (badgeEl) {
        badgeEl.classList.toggle('card-purchases-modal__badge--credit', isCredit);
        badgeEl.classList.toggle('card-purchases-modal__badge--debit', !isCredit);
    }
    const editBtn = document.getElementById('card-purchases-modal-edit-btn');
    const delBtn = document.getElementById('card-purchases-modal-delete-btn');
    if (editBtn) editBtn.dataset.id = accountId;
    if (delBtn) delBtn.dataset.id = accountId;
    tbody.innerHTML = '';

    let summaryHtml = '';

    if (isCredit) {
        const cycle = getBillingCycle(card);
        const cycleLabel = `${cycle.start.toLocaleDateString('pt-BR')} — ${cycle.end.toLocaleDateString('pt-BR')}`;
        const sumCycle = creditCardInvoiceTotalForCycle(card, sorted);
        const sumAll = sorted.reduce((s, t) => s + t.amount, 0);
        summaryHtml = `
            <div class="card-purchases-summary__grid">
                <div class="card-purchases-summary__item">
                    <span class="card-purchases-summary__icon" aria-hidden="true"><i class="fas fa-file-invoice-dollar"></i></span>
                    <span class="card-purchases-summary__lbl">Fatura atual (ciclo)</span>
                    <span class="card-purchases-summary__val">${formatCurrency(sumCycle, currency)}</span>
                    <span class="card-purchases-summary__hint">${cycleLabel}</span>
                </div>
                <div class="card-purchases-summary__item">
                    <span class="card-purchases-summary__icon" aria-hidden="true"><i class="fas fa-receipt"></i></span>
                    <span class="card-purchases-summary__lbl">Total lançado no cartão</span>
                    <span class="card-purchases-summary__val">${formatCurrency(sumAll, currency)}</span>
                    <span class="card-purchases-summary__hint">${sorted.length} lançamento(s)</span>
                </div>
                <div class="card-purchases-summary__item">
                    <span class="card-purchases-summary__icon" aria-hidden="true"><i class="fas fa-calendar-check"></i></span>
                    <span class="card-purchases-summary__lbl">Vencimento desta fatura</span>
                    <span class="card-purchases-summary__val">${cycle.due.toLocaleDateString('pt-BR')}</span>
                </div>
            </div>`;
    } else {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthList = sorted.filter((t) => {
            const d = movementDateToJsDate(t.date);
            return d >= monthStart && d <= monthEnd;
        });
        const sumMonth = monthList.reduce((s, t) => s + t.amount, 0);
        const sumAll = sorted.reduce((s, t) => s + t.amount, 0);
        const monthTitle = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        summaryHtml = `
            <div class="card-purchases-summary__grid card-purchases-summary__grid--debit">
                <div class="card-purchases-summary__item">
                    <span class="card-purchases-summary__icon" aria-hidden="true"><i class="fas fa-calendar-alt"></i></span>
                    <span class="card-purchases-summary__lbl">Gastos no mês (${monthTitle})</span>
                    <span class="card-purchases-summary__val">${formatCurrency(sumMonth, currency)}</span>
                </div>
                <div class="card-purchases-summary__item">
                    <span class="card-purchases-summary__icon" aria-hidden="true"><i class="fas fa-wallet"></i></span>
                    <span class="card-purchases-summary__lbl">Total de lançamentos</span>
                    <span class="card-purchases-summary__val">${formatCurrency(sumAll, currency)}</span>
                    <span class="card-purchases-summary__hint">${sorted.length} registro(s)</span>
                </div>
            </div>`;
    }

    summaryEl.innerHTML = summaryHtml;

    cardPurchasesCache = { sorted, currency, userProfile: financeUserProfile };
    cardPurchasesSort = { key: 'date', dir: 'desc' };

    if (sorted.length === 0) {
        emptyEl.classList.remove('hidden');
        if (listSectionEl) listSectionEl.classList.add('hidden');
        if (paginationHost) paginationHost.classList.add('hidden');
        if (filtersWrap) filtersWrap.classList.add('hidden');
    } else {
        emptyEl.classList.add('hidden');
        if (listSectionEl) listSectionEl.classList.remove('hidden');
        if (paginationHost) paginationHost.classList.remove('hidden');
        if (filtersWrap) filtersWrap.classList.remove('hidden');
        if (!cardPurchasesPagination && paginationHost) {
            cardPurchasesPagination = new TablePaginationController(paginationHost, {
                storageKey: 'card-purchases',
                onChange: () => renderCardPurchasesBodySlice()
            });
        }
        if (cardPurchasesPagination) {
            cardPurchasesPagination.setTotal(getSortedFilteredCardPurchasesList().length);
        }
        syncSortableTableHeaders(document.getElementById('card-purchases-table'), cardPurchasesSort, [
            'date',
            'amount',
            'installments',
            'lastInstallment',
            'status'
        ]);
        renderCardPurchasesBodySlice();
    }

    openModal('card-purchases-modal');
}

function handleCreditCardListClick(e) {
    const hit =
        e.target.closest('.credit-card-card[data-card-id]') ||
        e.target.closest('button.wallet-card-open[data-card-id]');
    if (hit) {
        openCardPurchasesModal(hit.getAttribute('data-card-id'));
    }
}

function handleCreditCardListKeydown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const hit =
        e.target.closest('.credit-card-card[data-card-id]') ||
        e.target.closest('button.wallet-card-open[data-card-id]');
    if (!hit) return;
    e.preventDefault();
    openCardPurchasesModal(hit.getAttribute('data-card-id'));
}

function handleCardPurchasesModalActions(e) {
    const pillBtn = e.target.closest('.installment-tooltip-pill-btn');
    if (pillBtn) {
        e.preventDefault();
        e.stopPropagation();
        const expenseId = pillBtn.dataset.expenseId;
        const periodKey = pillBtn.dataset.periodKey;
        if (expenseId && periodKey) openInstallmentCashOutConfirmModal(expenseId, periodKey);
        return;
    }
    const btn = e.target.closest('#card-purchases-modal-edit-btn, #card-purchases-modal-delete-btn');
    if (!btn) return;
    e.stopPropagation();
    handleCardButtonActions(e);
}

function buildCreditCardArticleElement(card, _index, expenses, currency) {
    const cardElement = document.createElement('article');
    cardElement.className = 'credit-card-card credit-card-card--interactive';
    cardElement.setAttribute('data-card-id', card.id);
    cardElement.setAttribute('role', 'button');
    cardElement.setAttribute('tabindex', '0');
    cardElement.setAttribute('aria-label', `Ver compras e lançamentos: ${card.name}`);
    const cardNameSafe = escapeHtml(card.name);
    const holderRaw =
        card.holderName != null && String(card.holderName).trim() !== ''
            ? String(card.holderName).trim()
            : '';
    const holderPlasticSafe = escapeHtml(holderRaw || String(card.name || ''));
    const isCredit = isCreditCardType(card.type);
    const typeBadge = isCredit
        ? '<span class="credit-card-plastic__brand credit-card-plastic__brand--muted">Crédito</span>'
        : '<span class="credit-card-plastic__brand">Débito</span>';
    const brandingTop = `
            <div class="credit-card-plastic__branding">
                <span class="credit-card-plastic__product-name" title="Nome do cartão">${cardNameSafe}</span>
                ${typeBadge}
            </div>`;

    let statsBlock;
    let footerBlock;
    if (isCredit) {
        const currentBill = creditCardInvoiceTotalForCycle(card, expenses);
        statsBlock = `
                <div class="credit-card-plastic__stats">
                    <div class="credit-card-plastic__stat">
                        <span class="credit-card-plastic__stat-lbl">Fatura atual</span>
                        <span class="credit-card-plastic__stat-val credit-card-plastic__stat-val--bill">${formatCurrency(currentBill, currency)}</span>
                    </div>
                    <div class="credit-card-plastic__stat">
                        <span class="credit-card-plastic__stat-lbl">Limite</span>
                        <span class="credit-card-plastic__stat-val">${formatCurrency(card.limit, currency)}</span>
                    </div>
                </div>`;
        footerBlock = `
            <div class="credit-card-footer">
                <span><i class="fas fa-calendar-check" aria-hidden="true"></i> Venc. dia ${card.dueDay ?? '—'}</span>
                <span><i class="fas fa-sync-alt" aria-hidden="true"></i> Fech. dia ${card.closeDay ?? '—'}</span>
            </div>`;
    } else {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthSpend = (expenses || [])
            .filter((t) => {
                const d = movementDateToJsDate(t.date);
                return t.accountId === card.id && d >= monthStart && d <= monthEnd;
            })
            .reduce((sum, t) => sum + t.amount, 0);
        statsBlock = `
                <div class="credit-card-plastic__stats credit-card-plastic__stats--single">
                    <div class="credit-card-plastic__stat">
                        <span class="credit-card-plastic__stat-lbl">Gastos no mês</span>
                        <span class="credit-card-plastic__stat-val credit-card-plastic__stat-val--bill">${formatCurrency(monthSpend, currency)}</span>
                    </div>
                </div>`;
        footerBlock = `
            <div class="credit-card-footer credit-card-footer--debit">
                <span><i class="fas fa-wallet" aria-hidden="true"></i> Cartão de débito</span>
            </div>`;
    }

    cardElement.innerHTML = `
            <div class="credit-card-plastic credit-card-plastic--default">
                <div class="credit-card-plastic__shine" aria-hidden="true"></div>
                <div class="credit-card-plastic__top">
                    <div class="credit-card-plastic__chip" aria-hidden="true" title="Chip"></div>
                    ${brandingTop}
                </div>
                <p class="credit-card-plastic__number" aria-hidden="true">••••&nbsp;&nbsp;••••&nbsp;&nbsp;••••&nbsp;&nbsp;••••</p>
                <div class="credit-card-plastic__holder-block">
                    <span class="credit-card-plastic__holder-label">Titular</span>
                    <span class="credit-card-plastic__holder-name">${holderPlasticSafe}</span>
                </div>
                ${statsBlock}
            </div>
            ${footerBlock}
        `;
    return cardElement;
}

export function loadCardsData(accounts, expenses, currency) {
    lastCardsPageCurrency = currency || 'BRL';
    const list = document.getElementById('credit-cards-list');
    if (!list) return;
    const cards = (accounts || []).filter((acc) => isCardAccountType(acc.type));
    list.innerHTML = '';
    list.className = 'credit-cards-page';

    if (cards.length === 0) {
        list.classList.add('credit-cards-page--empty');
        list.innerHTML = `
            <div class="credit-cards-empty">
                <div class="credit-cards-empty-icon" aria-hidden="true"><i class="fas fa-credit-card"></i></div>
                <p><strong>Nenhum cartão cadastrado</strong></p>
                <p>Use <strong>Novo cartão</strong> e escolha <strong>Cartão de crédito</strong> (limite e datas de fatura)
                    ou <strong>Cartão de débito</strong>.</p>
            </div>`;
        return;
    }

    list.classList.remove('credit-cards-page--empty');

    const creditCards = cards.filter((c) => isCreditCardType(c.type));
    const debitCards = cards.filter((c) => !isCreditCardType(c.type));
    let globalIndex = 0;

    const appendSection = (title, emptyHint, subset, headingId) => {
        const section = document.createElement('section');
        section.className = 'credit-cards-section';
        section.setAttribute('aria-labelledby', headingId);
        const h2 = document.createElement('h2');
        h2.id = headingId;
        h2.className = 'credit-cards-section__title';
        h2.textContent = title;
        section.appendChild(h2);

        if (subset.length === 0) {
            const p = document.createElement('p');
            p.className = 'credit-cards-section__empty';
            p.textContent = emptyHint;
            section.appendChild(p);
        } else {
            const grid = document.createElement('div');
            grid.className = 'credit-cards-grid';
            subset.forEach((card) => {
                grid.appendChild(buildCreditCardArticleElement(card, globalIndex++, expenses, currency));
            });
            section.appendChild(grid);
        }
        list.appendChild(section);
    };

    appendSection('Cartões de crédito', 'Nenhum cartão de crédito cadastrado.', creditCards, 'credit-cards-heading-credit');
    appendSection('Cartões de débito', 'Nenhum cartão de débito cadastrado.', debitCards, 'credit-cards-heading-debit');
}

async function handleCardButtonActions(e) {
    const button = e.target.closest('button');
    if (!button) return;
    const id = button.dataset.id;
    if (!id) return;

    if (button.classList.contains('btn-edit')) {
        closeModal('card-purchases-modal');
        const acc = userAccounts.find((a) => a.id === id);
        if (acc) fillAndOpenAccountForm(acc);
    } else if (button.classList.contains('btn-delete')) {
        if (
            confirm(
                'Tem certeza que deseja excluir este cartão? Todas as saídas e entradas vinculadas a ele também serão removidas.'
            )
        ) {
            try {
                await runWithButtonLoading(button, () => deleteAccount(id), {
                    busyLabel: 'Excluindo...'
                });
                closeModal('card-purchases-modal');
                onUpdateCallback();
            } catch (error) {
                console.error('Erro ao excluir cartão:', error);
                alert('Não foi possível excluir o cartão. Tente novamente.');
            }
        }
    }
}
