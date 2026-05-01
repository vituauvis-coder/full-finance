/**
 * Parcelas de cartão de crédito: vencimentos a partir da data da compra,
 * dia de fechamento e dia de vencimento do cartão (regra alinhada ao ciclo de fatura).
 */
import { formatCurrency, getBillingCycle, isCreditCardType, movementDateToJsDate } from './utils.js';
import {
    calendarDayKeyFromDate,
    getFinancePreferences,
    isPeriodConfirmedForDebit,
    monthKeyFromDate,
    parseCashOutConfirmedPeriods,
    shouldDeferCreditCardCashOut,
    shouldDeferLoanCashOut,
    shouldDeferMonthlyFixedCashOut
} from './finance-preferences.js';

/** Dia de fechamento/vencimento (1–31). `1` é válido — não usar `!closeDay`, que confundiria com ausência. */
function parseCardDay(value) {
    if (value == null || value === '') return undefined;
    const n = typeof value === 'number' && Number.isFinite(value) ? value : parseInt(String(value).trim(), 10);
    if (!Number.isFinite(n) || n < 1 || n > 31) return undefined;
    return n;
}

function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

/**
 * Saída mensal em conta de caixa (não cartão de crédito) sujeita a «confirmar pagamento»:
 * `recurringMonthly` (um lançamento) ou série «um por mês até dezembro» (`recurrenceGroupId`).
 * Empréstimos parcelados (≥2) seguem a regra de empréstimo, não esta.
 */
export function isMonthlyFixedCashAccountExpense(expense, account) {
    if (!expense || !account || isCreditCardType(account.type)) return false;
    const n = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    if (n >= 2 && isLoanExpense(expense)) return false;
    if (expense.recurringMonthly === true) return true;
    const gid = expense.recurrenceGroupId;
    return gid != null && String(gid).trim() !== '';
}

/**
 * Débito no caixa só após marcar o mês: série «um por mês até dezembro» sempre;
 * confirmação mensal na conta só se a preferência do perfil estiver ativa.
 */
export function shouldDeferCashOutForMonthlyFixedSeries(expense, account, userProfile) {
    if (!isMonthlyFixedCashAccountExpense(expense, account)) return false;
    const gid = expense?.recurrenceGroupId;
    if (gid != null && String(gid).trim() !== '') return true;
    return shouldDeferMonthlyFixedCashOut(getFinancePreferences(userProfile));
}

/**
 * Início do acompanhamento no app: momento em que a saída foi salva (`createdAt`).
 * Sem isso (dados antigos), usa a data do contrato para não alterar comportamento legado.
 */
export function expenseTrackingStartDate(expense) {
    const raw = expense?.createdAt;
    if (raw != null) {
        const d = movementDateToJsDate(raw);
        if (!Number.isNaN(d.getTime())) return startOfDay(d);
    }
    return startOfDay(movementDateToJsDate(expense?.date));
}

/**
 * Data de fechamento do ciclo que contém a compra (último dia do ciclo).
 * Ex.: fechamento dia **1**, compra **19/03** → ciclo fecha em **01/04** (fatura de abril, não de março).
 */
export function getCycleEndContainingPurchase(purchaseDate, closeDay) {
    const d = new Date(purchaseDate);
    const c = parseCardDay(closeDay);
    if (Number.isNaN(d.getTime()) || c == null) {
        return new Date(d.getFullYear(), d.getMonth() + 1, 0);
    }
    const y = d.getFullYear();
    const m = d.getMonth();
    const day = d.getDate();
    if (day > c) {
        return new Date(y, m + 1, c);
    }
    return new Date(y, m, c);
}

/**
 * Vencimento da fatura cujo fechamento é `cycleEndDate` (último dia do ciclo da compra).
 * Se `dueDay >` dia do fechamento no calendário, o pagamento é no mesmo mês do fechamento;
 * senão, no mês seguinte.
 * Ex.: ciclo fecha **01/04** e vence dia **5** → 5 > 1 → pagamento **05/04** (fatura de abril).
 */
export function firstInstallmentDueDate(cycleEndDate, dueDay) {
    const y = cycleEndDate.getFullYear();
    const m = cycleEndDate.getMonth();
    const closeD = cycleEndDate.getDate();
    const safeDue = Math.min(Math.max(1, dueDay || 1), 31);
    if (safeDue > closeD) {
        return new Date(y, m, safeDue);
    }
    return new Date(y, m + 1, safeDue);
}

/**
 * Primeira data de vencimento (dia `dueDay`) estritamente depois da data da compra.
 * Usada quando não há dia de fechamento: a cobrança não fica no mês da compra e sim no próximo vencimento.
 */
export function firstDueDateStrictlyAfterPurchase(purchaseDate, dueDay) {
    const p = startOfDay(movementDateToJsDate(purchaseDate));
    if (Number.isNaN(p.getTime())) return new Date(NaN);
    const safeDue = Math.min(Math.max(1, dueDay || 1), 31);
    let y = p.getFullYear();
    let m = p.getMonth();
    for (let guard = 0; guard < 120; guard++) {
        const d = new Date(y, m, safeDue);
        if (Number.isNaN(d.getTime())) {
            m++;
            if (m > 11) {
                m = 0;
                y++;
            }
            continue;
        }
        if (startOfDay(d) > p) return d;
        m++;
        if (m > 11) {
            m = 0;
            y++;
        }
    }
    return new Date(NaN);
}

/**
 * Datas de vencimento de cada parcela (1..n), em ordem.
 * Com fechamento + vencimento: ciclo de fatura (fecha no ciclo que contém a compra).
 * Só com vencimento: próximo dia de vencimento após a compra, depois um mês entre parcelas.
 */
export function getInstallmentDueDates(purchaseDate, installmentCount, closeDay, dueDay) {
    const n = Math.min(99, Math.max(1, parseInt(String(installmentCount ?? '1'), 10) || 1));
    const purchase = movementDateToJsDate(purchaseDate);
    if (Number.isNaN(purchase.getTime())) return [];

    const dueNum = parseCardDay(dueDay);
    const closeNum = parseCardDay(closeDay);
    if (dueNum == null) return [];

    if (closeNum == null) {
        const first = firstDueDateStrictlyAfterPurchase(purchase, dueNum);
        if (Number.isNaN(first.getTime())) return [];
        const dates = [];
        for (let i = 0; i < n; i++) {
            dates.push(new Date(first.getFullYear(), first.getMonth() + i, first.getDate()));
        }
        return dates;
    }

    const cycleEnd = getCycleEndContainingPurchase(purchase, closeNum);
    const first = firstInstallmentDueDate(cycleEnd, dueNum);
    const dates = [];
    for (let i = 0; i < n; i++) {
        const dt = new Date(first.getFullYear(), first.getMonth() + i, first.getDate());
        dates.push(dt);
    }
    return dates;
}

function calendarDayKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Valor estimado da fatura aberta (ciclo atual do cartão):
 * — compras à vista (ou sem dados de parcela) feitas entre fechamento e fechamento;
 * — compras parceladas: soma só a parcela cuja data de vencimento coincide com o vencimento desta fatura.
 */
export function creditCardInvoiceTotalForCycle(card, expenses, now = new Date()) {
    if (!card || !isCreditCardType(card.type)) return 0;
    const cycle = getBillingCycle(card);
    const closeDay = card.closeDay ?? card.closingDay;
    const dueDay = card.dueDay ?? card.dueDate;
    const cycleDueKey = calendarDayKey(cycle.due);
    let sum = 0;

    for (const e of expenses || []) {
        if (e.accountId !== card.id) continue;
        if (e.isPaid === true) continue;
        if (isCreditInstallmentFullyPaid(e, card, now)) continue;

        const n = Math.min(99, Math.max(1, parseInt(String(e.installmentCount ?? '1'), 10) || 1));
        const purchase = movementDateToJsDate(e.date);
        if (Number.isNaN(purchase.getTime())) continue;
        const amt = Number(e.amount) || 0;

        if (parseCardDay(dueDay) == null) {
            if (purchase >= cycle.start && purchase <= cycle.end) sum += amt;
            continue;
        }

        const dueDates = getInstallmentDueDates(purchase, n, closeDay, dueDay);
        const per = amt / n;
        for (const dt of dueDates) {
            if (calendarDayKey(dt) === cycleDueKey) {
                sum += per;
                break;
            }
        }
    }
    return sum;
}

export function countPaidInstallments(dueDates, now = new Date()) {
    const t = startOfDay(now);
    let c = 0;
    for (const d of dueDates) {
        if (startOfDay(d) <= t) c++;
    }
    return c;
}

/**
 * Parcela «paga» para o saldo da conta vinculada ao cartão:
 * - Cartão parcelado (≥2): só após marcar a parcela em `cashOutConfirmedPeriods` (botão «Pagar» na lista).
 * - Cartão à vista (1x): sem modo manual nas preferências, considera paga quando o vencimento já passou;
 *   com modo «confirmar saída» ou períodos marcados, só após confirmação explícita.
 */
export function isInstallmentDuePaidForCashOut(expense, account, dueDate, userProfile, now = new Date()) {
    if (!dueDate || Number.isNaN(dueDate.getTime())) return true;
    const prefs = getFinancePreferences(userProfile);
    const confirmed = parseCashOutConfirmedPeriods(expense);

    if (account && isCreditCardType(account.type)) {
        const n = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
        if (n >= 2) {
            return isPeriodConfirmedForDebit(confirmed, dueDate);
        }
        const manual = shouldDeferCreditCardCashOut(prefs);
        const explicit = confirmed.size > 0;
        if (manual || explicit) return isPeriodConfirmedForDebit(confirmed, dueDate);
        return startOfDay(dueDate).getTime() <= startOfDay(now).getTime();
    }
    if (isLoanExpense(expense) && (!account || !isCreditCardType(account.type))) {
        const manual = shouldDeferLoanCashOut(prefs);
        if (manual) return isPeriodConfirmedForDebit(confirmed, dueDate);
        if (!isLoanDueEligibleForAutoCashOut(expense, dueDate)) {
            return isPeriodConfirmedForDebit(confirmed, dueDate);
        }
        return startOfDay(dueDate).getTime() <= startOfDay(now).getTime();
    }
    if (shouldDeferCashOutForMonthlyFixedSeries(expense, account, userProfile)) {
        return isPeriodConfirmedForDebit(confirmed, dueDate);
    }
    return startOfDay(dueDate).getTime() <= startOfDay(now).getTime();
}

/**
 * Indica se esta parcela pode ser confirmada manualmente no saldo (anel ou tag no tooltip).
 */
export function canConfirmInstallmentPeriodForCashOut(expense, account, dueDate, userProfile, now = new Date()) {
    if (!dueDate || Number.isNaN(dueDate.getTime())) return false;
    const paid = isInstallmentDuePaidForCashOut(expense, account, dueDate, userProfile, now);
    if (paid) return false;
    const prefs = getFinancePreferences(userProfile);
    const dueOk = startOfDay(dueDate).getTime() <= startOfDay(now).getTime();
    if (!dueOk) return false;
    const loanRetro =
        isLoanExpense(expense) &&
        (!account || !isCreditCardType(account.type)) &&
        !isLoanDueEligibleForAutoCashOut(expense, dueDate);
    const confirmed = parseCashOutConfirmedPeriods(expense);
    const nCard = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    if (account && isCreditCardType(account.type)) {
        if (shouldDeferCreditCardCashOut(prefs) || confirmed.size > 0) return true;
        if (nCard >= 2 && dueOk) return true;
        return false;
    }
    if (
        isLoanExpense(expense) &&
        (!account || !isCreditCardType(account.type)) &&
        (shouldDeferLoanCashOut(prefs) || loanRetro)
    ) {
        return true;
    }
    if (shouldDeferCashOutForMonthlyFixedSeries(expense, account, userProfile) && dueOk) {
        return true;
    }
    return false;
}

/**
 * Parcela cujo vencimento cai no mês civil de `now` (anel verde/amarelo, clique para confirmar).
 */
export function getCurrentMonthInstallmentMeta(expense, account, userProfile, now = new Date()) {
    const st = getInstallmentState(expense, account, now, userProfile);
    if (!st.applies || st.total < 2 || !st.dueDates?.length) {
        return { hasCurrentMonth: false, monthPaid: false, canConfirmClick: false };
    }
    const refMk = monthKeyFromDate(now);
    let currentDue = null;
    for (const d of st.dueDates) {
        if (monthKeyFromDate(d) === refMk) {
            currentDue = d;
            break;
        }
    }
    if (!currentDue) {
        return { hasCurrentMonth: false, monthPaid: false, canConfirmClick: false, dueDates: st.dueDates };
    }
    const paid = isInstallmentDuePaidForCashOut(expense, account, currentDue, userProfile, now);
    const canConfirmClick = canConfirmInstallmentPeriodForCashOut(expense, account, currentDue, userProfile, now);
    return {
        hasCurrentMonth: true,
        currentDue,
        periodKey: calendarDayKeyFromDate(currentDue),
        monthPaid: paid,
        canConfirmClick,
        dueDates: st.dueDates
    };
}

function normalizeCategoryToken(s) {
    return String(s ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Categoria «Empréstimo»: parcelas mensais (conta corrente/poupança etc.), não o ciclo do cartão.
 * Considera subcategoria e rótulos como «Empréstimo — banco X».
 */
export function isLoanExpense(expense) {
    const cat = normalizeCategoryToken(expense?.category);
    const sub = normalizeCategoryToken(expense?.subcategory);
    const isLoanLabel = (w) => {
        if (!w) return false;
        if (w === 'emprestimo' || w === 'emprestimos') return true;
        if (!w.startsWith('emprestimo')) return false;
        // "emprestimo …" / hífen / dois-pontos (rótulos compostos); evita palavras tipo "emprestimox"
        if (w.length === 10) return true;
        const sep = w.charAt(10);
        return !/[a-z0-9]/.test(sep);
    };
    return isLoanLabel(cat) || isLoanLabel(sub);
}

/**
 * Empréstimo parcelado: vencimento antes do cadastro no app não conta como «pago no automático».
 */
export function isLoanDueEligibleForAutoCashOut(expense, dueDate) {
    if (!isLoanExpense(expense) || !dueDate || Number.isNaN(dueDate.getTime())) return true;
    return startOfDay(dueDate).getTime() >= expenseTrackingStartDate(expense).getTime();
}

/**
 * Parcela (empréstimo ou cartão) entra no caixa: vencimento no mesmo mês civil ou depois do mês
 * em que o lançamento passou a ser acompanhada (`expenseTrackingStartDate`). Meses anteriores não
 * debitam o caixa (histórico antes de usar o app).
 */
export function isExpenseInstallmentDueCountedInCashFlow(expense, dueDate) {
    if (!dueDate || Number.isNaN(dueDate.getTime())) return true;
    const d = startOfDay(dueDate);
    const track = expenseTrackingStartDate(expense);
    if (Number.isNaN(track.getTime())) return true;
    const dYm = d.getFullYear() * 12 + d.getMonth();
    const tYm = track.getFullYear() * 12 + track.getMonth();
    return dYm >= tYm;
}

/** Nome legado — mesmo critério que {@link isExpenseInstallmentDueCountedInCashFlow}. */
export function isLoanDueCountedInCashFlow(expense, dueDate) {
    return isExpenseInstallmentDueCountedInCashFlow(expense, dueDate);
}

/**
 * Valor por parcela para exibição em tabelas (lista de saídas, ordenação).
 * Compra/emprestimo parcelados mostram total/n; demais o valor integral.
 */
export function getExpensePerInstallmentDisplayAmount(expense, account) {
    const total = Number(expense?.amount) || 0;
    const n = Math.max(1, parseInt(String(expense?.installmentCount ?? '1'), 10) || 1);
    if (n < 2) return total;
    if (account && isCreditCardType(account.type)) return total / n;
    if (isLoanExpense(expense) && account && !isCreditCardType(account.type)) return total / n;
    return total;
}

/**
 * Vencimentos de empréstimo: um mês entre cada parcela, a partir da data do contrato
 * (1.ª parcela na data informada — igual à previsão «última parcela» das compras no cartão).
 */
export function getLoanInstallmentDueDates(purchaseDate, installmentCount) {
    const n = Math.min(99, Math.max(1, parseInt(String(installmentCount ?? '1'), 10) || 1));
    const d0 = movementDateToJsDate(purchaseDate);
    if (Number.isNaN(d0.getTime())) return [];
    const dates = [];
    for (let i = 0; i < n; i++) {
        dates.push(new Date(d0.getFullYear(), d0.getMonth() + i, d0.getDate()));
    }
    return dates;
}

export function getLoanInstallmentState(expense, now = new Date(), userProfile = null, account = null) {
    const n = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    const purchase = movementDateToJsDate(expense.date);
    if (expense.isPaid === true) {
        const dueDates = n >= 2 ? getLoanInstallmentDueDates(purchase, n) : [];
        return {
            applies: n >= 2,
            total: n,
            paidCount: n,
            remaining: 0,
            allPaid: true,
            dueDates
        };
    }
    if (n < 2) {
        return { applies: false, total: 1, paidCount: 0, remaining: 1, allPaid: false, dueDates: [] };
    }
    const dueDates = getLoanInstallmentDueDates(purchase, n);
    let paidCount = 0;
    for (const d of dueDates) {
        if (isInstallmentDuePaidForCashOut(expense, account, d, userProfile, now)) paidCount++;
    }
    return {
        applies: true,
        total: n,
        paidCount: Math.min(n, paidCount),
        remaining: Math.max(0, n - paidCount),
        allPaid: paidCount >= n,
        dueDates
    };
}

/** Estado unificado para UI: empréstimo em conta usa cronograma mensal; cartão usa ciclo da fatura. */
export function getInstallmentState(expense, account, now = new Date(), userProfile = null) {
    if (isLoanExpense(expense) && (!account || !isCreditCardType(account.type))) {
        return getLoanInstallmentState(expense, now, userProfile, account);
    }
    return getCreditInstallmentState(expense, account, now, userProfile);
}

/**
 * Vencimentos a exibir para o filtro da lista (`null` = contrato inteiro).
 */
export function getDueDatesForExpenseListPeriod(expense, account, now = new Date(), userProfile = null, listPeriod = null) {
    const st0 = getInstallmentState(expense, account, now, userProfile);
    if (!st0.applies || st0.total < 2 || !st0.dueDates?.length) return [];
    if (!listPeriod) return [...st0.dueDates];
    const st = scopeInstallmentStateToListPeriod(st0, expense, account, now, userProfile, listPeriod);
    if (st.emptyListPeriod) return [];
    return [...st.dueDates];
}

export function getParcelNumberInFullSchedule(expense, account, dueDate, now = new Date(), userProfile = null) {
    const st0 = getInstallmentState(expense, account, now, userProfile);
    if (!st0?.dueDates?.length) return 0;
    const pk = calendarDayKeyFromDate(dueDate);
    const i = st0.dueDates.findIndex((x) => calendarDayKeyFromDate(x) === pk);
    return i >= 0 ? i + 1 : 0;
}

function scopeInstallmentStateToListPeriod(st, expense, account, now, userProfile, listPeriod) {
    if (!listPeriod || !st?.dueDates?.length || !st.applies) {
        return { ...st, emptyListPeriod: false };
    }
    const s = startOfDay(listPeriod.startDate).getTime();
    const e = startOfDay(listPeriod.endDate).getTime();
    const filtered = st.dueDates.filter((d) => {
        const t = startOfDay(d).getTime();
        return t >= s && t <= e;
    });
    if (filtered.length === 0) {
        return {
            ...st,
            dueDates: [],
            total: 0,
            paidCount: 0,
            remaining: 0,
            allPaid: false,
            applies: false,
            emptyListPeriod: true
        };
    }
    let paidCount = 0;
    for (const d of filtered) {
        if (isInstallmentDuePaidForCashOut(expense, account, d, userProfile, now)) paidCount++;
    }
    const total = filtered.length;
    const remaining = Math.max(0, total - paidCount);
    return {
        ...st,
        dueDates: filtered,
        total,
        paidCount,
        remaining,
        allPaid: paidCount >= total,
        applies: true,
        emptyListPeriod: false
    };
}

/** Destaque verde/amarelo no anel quando alguma parcela visível cai no mês civil de `now`. */
function getRingMonthModClassForScopedList(st, expense, account, userProfile, now) {
    if (!st?.dueDates?.length) return '';
    const refMk = monthKeyFromDate(now);
    for (const d of st.dueDates) {
        if (monthKeyFromDate(d) !== refMk) continue;
        const paid = isInstallmentDuePaidForCashOut(expense, account, d, userProfile, now);
        return paid ? ' installment-ring-compact--month-paid' : ' installment-ring-compact--month-pending';
    }
    return '';
}

/** Botão de confirmar no anel: primeira parcela visível ainda não paga e confirmável. */
function getInstallmentConfirmMetaForListPeriod(expense, account, userProfile, now, scopedSt) {
    if (!scopedSt?.dueDates?.length || scopedSt.emptyListPeriod) {
        return { canConfirmClick: false, periodKey: '' };
    }
    for (const d of scopedSt.dueDates) {
        if (isInstallmentDuePaidForCashOut(expense, account, d, userProfile, now)) continue;
        if (canConfirmInstallmentPeriodForCashOut(expense, account, d, userProfile, now)) {
            return { canConfirmClick: true, periodKey: calendarDayKeyFromDate(d) };
        }
    }
    return { canConfirmClick: false, periodKey: '' };
}

/**
 * Total já debitado da conta até a data (parcelas com vencimento ≤ fim do período).
 * Com preferência «confirmar pagamento», só soma parcelas cujo período foi marcado em `cashOutConfirmedPeriods`.
 */
export function getLoanCumulativeCashOutThrough(expense, asOfEndInclusive, userProfile = null) {
    if (!isLoanExpense(expense)) return null;
    const n = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    if (n < 2) return null;
    const prefs = getFinancePreferences(userProfile);
    const manual = shouldDeferLoanCashOut(prefs);
    const confirmed = parseCashOutConfirmedPeriods(expense);
    const amt = Number(expense.amount) || 0;
    const purchase = movementDateToJsDate(expense.date);
    const dueDates = getLoanInstallmentDueDates(purchase, n);
    const per = amt / n;
    const cutoff = startOfDay(asOfEndInclusive).getTime();
    let sum = 0;
    for (const d of dueDates) {
        if (startOfDay(d).getTime() > cutoff) continue;
        if (!isExpenseInstallmentDueCountedInCashFlow(expense, d)) continue;
        if (manual) {
            if (!isPeriodConfirmedForDebit(confirmed, d)) continue;
        } else if (!isLoanDueEligibleForAutoCashOut(expense, d)) {
            if (!isPeriodConfirmedForDebit(confirmed, d)) continue;
        }
        sum += per;
    }
    return sum;
}

/** Saída de caixa realizada no mês-calendário (parcelas já vencidas até `now`). */
export function loanInstallmentCashOutForCalendarMonth(expense, monthKey, now = new Date(), userProfile = null) {
    if (!isLoanExpense(expense)) return 0;
    const n = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    if (n < 2) return 0;
    if (expense.isPaid === true) return 0;
    const purchase = movementDateToJsDate(expense.date);
    const dueDates = getLoanInstallmentDueDates(purchase, n);
    const per = (Number(expense.amount) || 0) / n;
    const t0 = startOfDay(now);
    const prefs = getFinancePreferences(userProfile);
    const manual = shouldDeferLoanCashOut(prefs);
    const confirmed = parseCashOutConfirmedPeriods(expense);
    let sum = 0;
    for (const d of dueDates) {
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (mk !== monthKey) continue;
        if (!isExpenseInstallmentDueCountedInCashFlow(expense, d)) continue;
        if (startOfDay(d) > t0) continue;
        if (manual) {
            if (!isPeriodConfirmedForDebit(confirmed, d)) continue;
        } else if (!isLoanDueEligibleForAutoCashOut(expense, d)) {
            if (!isPeriodConfirmedForDebit(confirmed, d)) continue;
        }
        sum += per;
    }
    return sum;
}

export function getLoanInstallmentMonthAllocationsIncludingFuture(expense) {
    const out = {};
    if (!isLoanExpense(expense)) return out;
    if (expense.isPaid === true) return out;
    const n = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    if (n < 2) return out;
    const purchase = movementDateToJsDate(expense.date);
    if (Number.isNaN(purchase.getTime())) return out;
    const amt = Number(expense.amount) || 0;
    const dueDates = getLoanInstallmentDueDates(purchase, n);
    const per = amt / n;
    dueDates.forEach((d) => {
        if (!isExpenseInstallmentDueCountedInCashFlow(expense, d)) return;
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        out[mk] = (out[mk] || 0) + per;
    });
    return out;
}

export function isCreditInstallmentFullyPaid(expense, account, now = new Date(), userProfile = null) {
    if (isLoanExpense(expense) && (!account || !isCreditCardType(account.type))) {
        if (expense.isPaid === true) return true;
        const n = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
        if (n < 2) return !!expense.isPaid;
        const purchase = movementDateToJsDate(expense.date);
        const dueDates = getLoanInstallmentDueDates(purchase, n);
        for (const d of dueDates) {
            if (!isInstallmentDuePaidForCashOut(expense, account, d, userProfile, now)) return false;
        }
        return true;
    }
    if (!account || !isCreditCardType(account.type)) return !!expense.isPaid;
    if (expense.isPaid === true) return true;
    const closeDay = account.closeDay ?? account.closingDay;
    const dueDay = account.dueDay ?? account.dueDate;
    if (parseCardDay(dueDay) == null) return !!expense.isPaid;
    const n = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    const purchase = movementDateToJsDate(expense.date);
    const dueDates = getInstallmentDueDates(purchase, n, closeDay, dueDay);
    if (!dueDates.length) return !!expense.isPaid;
    for (const d of dueDates) {
        if (!isInstallmentDuePaidForCashOut(expense, account, d, userProfile, now)) return false;
    }
    return true;
}

/**
 * Estado para UI e persistência de isPaid.
 */
export function getCreditInstallmentState(expense, account, now = new Date(), userProfile = null) {
    if (!account || !isCreditCardType(account.type)) {
        return {
            applies: false,
            total: 1,
            paidCount: expense.isPaid ? 1 : 0,
            remaining: expense.isPaid ? 0 : 1,
            allPaid: !!expense.isPaid,
            dueDates: []
        };
    }
    const closeDay = account.closeDay ?? account.closingDay;
    const dueDay = account.dueDay ?? account.dueDate;
    if (parseCardDay(dueDay) == null) {
        return {
            applies: false,
            total: 1,
            paidCount: expense.isPaid ? 1 : 0,
            remaining: expense.isPaid ? 0 : 1,
            allPaid: !!expense.isPaid,
            dueDates: []
        };
    }
    const n = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    const purchase = movementDateToJsDate(expense.date);
    const dueDates = getInstallmentDueDates(purchase, n, closeDay, dueDay);
    let paidCount = 0;
    for (const d of dueDates) {
        if (isInstallmentDuePaidForCashOut(expense, account, d, userProfile, now)) paidCount++;
    }
    return {
        applies: true,
        total: n,
        paidCount: Math.min(n, paidCount),
        remaining: Math.max(0, n - paidCount),
        allPaid: paidCount >= n,
        dueDates
    };
}

/**
 * Valor monetário ainda em aberto na despesa (para cartão parcelado: só a parte das parcelas futuras).
 */
export function getExpenseRemainingOpenAmount(expense, account, now = new Date(), userProfile = null) {
    const amt = Number(expense.amount) || 0;
    if (expense.isPaid === true) return 0;
    if (isLoanExpense(expense) && (!account || !isCreditCardType(account.type))) {
        if (isCreditInstallmentFullyPaid(expense, account, now, userProfile)) return 0;
        const st = getLoanInstallmentState(expense, now, userProfile, account);
        if (st.applies && st.total >= 2) {
            return amt * (st.remaining / st.total);
        }
        return amt;
    }
    if (!account || !isCreditCardType(account.type)) return amt;
    if (isCreditInstallmentFullyPaid(expense, account, now, userProfile)) return 0;
    const st = getCreditInstallmentState(expense, account, now, userProfile);
    if (st.applies && st.total >= 2) {
        return amt * (st.remaining / st.total);
    }
    return amt;
}

/** Valor que “saiu do caixa” em cada mês-calendário (proporcional às parcelas já vencidas naquele mês). */
export function getCreditInstallmentMonthAllocations(expense, account, now = new Date(), userProfile = null) {
    const out = {};
    if (!account || !isCreditCardType(account.type)) return out;
    const closeDay = account.closeDay ?? account.closingDay;
    const dueDay = account.dueDay ?? account.dueDate;
    if (parseCardDay(dueDay) == null) return out;
    const n = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    const purchase = movementDateToJsDate(expense.date);
    const dueDates = getInstallmentDueDates(purchase, n, closeDay, dueDay);
    const per = expense.amount / n;
    const t0 = startOfDay(now);
    dueDates.forEach((d) => {
        if (!isExpenseInstallmentDueCountedInCashFlow(expense, d)) return;
        if (startOfDay(d) > t0) return;
        if (!isInstallmentDuePaidForCashOut(expense, account, d, userProfile, now)) return;
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        out[mk] = (out[mk] || 0) + per;
    });
    return out;
}

/**
 * Aloca valor por mês-calendário (chave YYYY-MM) para cada parcela pelo seu vencimento,
 * **incluindo parcelas futuras** — para gráficos de fluxo (compromisso por mês).
 * Não inclui despesas já quitadas por completo.
 */
export function getCreditInstallmentMonthAllocationsIncludingFuture(expense, account, now = new Date(), userProfile = null) {
    const out = {};
    if (!account || !isCreditCardType(account.type)) return out;
    if (expense.isPaid === true) return out;
    if (isCreditInstallmentFullyPaid(expense, account, now, userProfile)) return out;

    const closeDay = account.closeDay ?? account.closingDay;
    const dueDay = account.dueDay ?? account.dueDate;
    const n = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    const purchase = movementDateToJsDate(expense.date);
    const amt = Number(expense.amount) || 0;
    if (Number.isNaN(purchase.getTime())) return out;

    if (parseCardDay(dueDay) == null) {
        if (n >= 2) return out;
        if (!isExpenseInstallmentDueCountedInCashFlow(expense, purchase)) return out;
        const mk = `${purchase.getFullYear()}-${String(purchase.getMonth() + 1).padStart(2, '0')}`;
        out[mk] = (out[mk] || 0) + amt;
        return out;
    }

    const dueDates = getInstallmentDueDates(purchase, n, closeDay, dueDay);
    const per = amt / n;
    dueDates.forEach((d) => {
        if (!isExpenseInstallmentDueCountedInCashFlow(expense, d)) return;
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        out[mk] = (out[mk] || 0) + per;
    });
    return out;
}

export function creditCardCashOutForCalendarMonth(expense, account, monthKey, now = new Date(), userProfile = null) {
    const allocs = getCreditInstallmentMonthAllocations(expense, account, now, userProfile);
    return allocs[monthKey] || 0;
}

/**
 * Soma das parcelas já vencidas até `asOf` (saída de caixa efetiva) — para descontar da conta vinculada ao cartão.
 * Parcelas entram conforme {@link isInstallmentDuePaidForCashOut} (parcelado: só períodos confirmados com «Pagar»).
 */
export function getCreditCardCumulativeCashOutThrough(expense, cardAccount, asOfEndInclusive = new Date(), userProfile = null) {
    if (!cardAccount || !isCreditCardType(cardAccount.type)) return 0;
    // Não retornar cedo por isPaid / «totalmente pago»: o saldo da conta vinculada deve somar cada parcela
    // já confirmada (botão Pagar); o loop abaixo já filtra com isInstallmentDuePaidForCashOut.

    const closeDay = cardAccount.closeDay ?? cardAccount.closingDay;
    const dueDay = cardAccount.dueDay ?? cardAccount.dueDate;
    const n = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    const purchase = movementDateToJsDate(expense.date);
    const amt = Number(expense.amount) || 0;
    const cutoff = startOfDay(asOfEndInclusive).getTime();

    if (parseCardDay(dueDay) == null) {
        if (n >= 2) return 0;
        if (startOfDay(purchase).getTime() > cutoff) return 0;
        if (!isExpenseInstallmentDueCountedInCashFlow(expense, purchase)) return 0;
        if (!isInstallmentDuePaidForCashOut(expense, cardAccount, purchase, userProfile, asOfEndInclusive)) return 0;
        return amt;
    }

    const dueDates = getInstallmentDueDates(purchase, n, closeDay, dueDay);
    const per = amt / n;
    let sum = 0;
    for (const d of dueDates) {
        if (startOfDay(d).getTime() > cutoff) continue;
        if (!isExpenseInstallmentDueCountedInCashFlow(expense, d)) continue;
        if (!isInstallmentDuePaidForCashOut(expense, cardAccount, d, userProfile, asOfEndInclusive)) continue;
        sum += per;
    }
    return sum;
}

/**
 * Previsão de valor no mês-calendário: parcelas cujo vencimento cai nesse mês e ainda não venceram (d > hoje).
 * Diferente de {@link creditCardCashOutForCalendarMonth}, que só conta parcelas já vencidas (saída de caixa efetiva).
 */
export function creditCardForecastForCalendarMonth(expense, account, monthKey, now = new Date()) {
    if (!account || !isCreditCardType(account.type)) return 0;
    if (expense.isPaid === true) return 0;
    if (isCreditInstallmentFullyPaid(expense, account, now)) return 0;
    const closeDay = account.closeDay ?? account.closingDay;
    const dueDay = account.dueDay ?? account.dueDate;
    const n = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    const purchase = movementDateToJsDate(expense.date);
    const amt = Number(expense.amount) || 0;
    const per = amt / n;
    const t0 = startOfDay(now);

    if (parseCardDay(dueDay) == null) {
        if (n >= 2) return 0;
        if (!isExpenseInstallmentDueCountedInCashFlow(expense, purchase)) return 0;
        const mk = `${purchase.getFullYear()}-${String(purchase.getMonth() + 1).padStart(2, '0')}`;
        if (mk !== monthKey) return 0;
        if (startOfDay(purchase) <= t0) return 0;
        return amt;
    }

    const dueDates = getInstallmentDueDates(purchase, n, closeDay, dueDay);
    let sum = 0;
    dueDates.forEach((d) => {
        if (!isExpenseInstallmentDueCountedInCashFlow(expense, d)) return;
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (mk !== monthKey) return;
        if (startOfDay(d) <= t0) return;
        sum += per;
    });
    return sum;
}

/**
 * Anel compacto (bolinha + número de parcelas restantes) para tabelas — mesmo gráfico do preview da despesa, sem texto lateral.
 * `options.size`: `'sm'` (tabelas, linha baixa) ou `'md'` (padrão anterior).
 */
export function formatInstallmentRingCompactHtml(expense, account, now = new Date(), options = {}) {
    const sm = options.size === 'sm';
    const userProfile = options.userProfile ?? null;
    const listPeriod = options.listPeriod ?? null;
    const st0 = getInstallmentState(expense, account, now, userProfile);
    const st = listPeriod
        ? scopeInstallmentStateToListPeriod(st0, expense, account, now, userProfile, listPeriod)
        : { ...st0, emptyListPeriod: false };

    let monthModClass = '';
    if (listPeriod && st.dueDates?.length && !st.emptyListPeriod) {
        monthModClass = getRingMonthModClassForScopedList(st, expense, account, userProfile, now);
    } else {
        const monthMeta = getCurrentMonthInstallmentMeta(expense, account, userProfile, now);
        if (monthMeta.hasCurrentMonth) {
            monthModClass = monthMeta.monthPaid
                ? ' installment-ring-compact--month-paid'
                : ' installment-ring-compact--month-pending';
        }
    }

    const r = sm ? 11.5 : 17;
    const cx = sm ? 16 : 22;
    const vb = sm ? 32 : 44;
    const svgPx = sm ? 26 : 40;

    if (st.emptyListPeriod) {
        return `<span class="installment-ring-fallback${sm ? ' installment-ring-fallback--sm' : ''}" title="Nenhum vencimento neste período do filtro">—</span>`;
    }

    const minParcels = listPeriod ? 1 : 2;
    if (!st.applies || st.total < minParcels) {
        const t = st.allPaid || expense.isPaid ? 'Pago' : 'Parcelado';
        return `<span class="installment-ring-fallback${sm ? ' installment-ring-fallback--sm' : ''}">${t}</span>`;
    }
    if (st.allPaid || st.remaining === 0) {
        return `<span class="installment-ring-fallback${sm ? ' installment-ring-fallback--sm' : ''}">Pago</span>`;
    }
    const { paidCount, total, remaining } = st;
    const circumference = 2 * Math.PI * r;
    const frac = total > 0 ? paidCount / total : 0;
    const dashOffset = circumference * (1 - frac);
    const aria = `${remaining} parcela${remaining === 1 ? '' : 's'} restante${remaining === 1 ? '' : 's'} de ${total}`;
    const sizeClass = sm ? ' installment-ring-compact--sm' : '';
    return `<div class="installment-ring-compact${sizeClass}${monthModClass}" role="img" aria-label="${aria.replace(/"/g, '&quot;')}">
  <div class="installment-ring-compact__inner" aria-hidden="true">
    <svg class="installment-ring-compact__svg" viewBox="0 0 ${vb} ${vb}" width="${svgPx}" height="${svgPx}">
      <circle class="installment-ring-compact__track" cx="${cx}" cy="${cx}" r="${r}" fill="none" />
      <g transform="rotate(-90 ${cx} ${cx})">
        <circle class="installment-ring-compact__progress" cx="${cx}" cy="${cx}" r="${r}" fill="none"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${dashOffset}" />
      </g>
    </svg>
    <span class="installment-ring-compact__num">${remaining}</span>
  </div>
</div>`;
}

/**
 * Conteúdo do painel flutuante (parcelas, cartão, valores).
 * @param {{ startDate: Date, endDate: Date } | null} [listPeriod] — quando definido (lista de despesas), só mostra vencimentos neste intervalo.
 */
export function formatInstallmentTooltipPanelHtml(
    expense,
    account,
    currency = 'BRL',
    now = new Date(),
    userProfile = null,
    listPeriod = null
) {
    const st0 = getInstallmentState(expense, account, now, userProfile);
    const st = listPeriod
        ? scopeInstallmentStateToListPeriod(st0, expense, account, now, userProfile, listPeriod)
        : { ...st0, emptyListPeriod: false };
    const refMk = monthKeyFromDate(now);
    const cardName = esc(account?.name || 'Conta');
    const desc = esc(String(expense.description || '—').slice(0, 96));
    const amt = Number(expense.amount) || 0;
    const purchase = movementDateToJsDate(expense.date);
    const purchaseStr = Number.isNaN(purchase.getTime()) ? '—' : purchase.toLocaleDateString('pt-BR');
    const closeDay = account?.closeDay ?? account?.closingDay;
    const dueDay = account?.dueDay ?? account?.dueDate;
    const loanMeta =
        isLoanExpense(expense) && (!account || !isCreditCardType(account.type))
            ? '<p class="installment-tooltip-meta">Parcelas mensais a partir da data do contrato</p>'
            : '';
    const cycleLine =
        loanMeta ||
        (closeDay && dueDay
            ? `<p class="installment-tooltip-meta">Fechamento dia ${esc(String(closeDay))} · Vencimento dia ${esc(String(dueDay))}</p>`
            : dueDay
              ? `<p class="installment-tooltip-meta">Vencimento dia ${esc(String(dueDay))}</p>`
              : '');

    let pillsRow = '';
    const showPillsRow =
        st.dueDates?.length &&
        !st.emptyListPeriod &&
        st.applies &&
        (listPeriod ? st.total >= 1 : st.total >= 2);
    if (showPillsRow) {
        pillsRow = st.dueDates
            .map((d) => {
                const paid = isInstallmentDuePaidForCashOut(expense, account, d, userProfile, now);
                const dueMk = monthKeyFromDate(d);
                const unpaidDueOrPast = !paid && dueMk <= refMk;
                const paidCurrentMonthHighlight = paid && dueMk === refMk;
                const lab = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                let cls = 'installment-tooltip-pill';
                cls += paid ? ' installment-tooltip-pill--paid' : ' installment-tooltip-pill--pending';
                if (unpaidDueOrPast || paidCurrentMonthHighlight) cls += ' installment-tooltip-pill--current-month';
                const periodKey = calendarDayKeyFromDate(d);
                const asBtn =
                    expense?.id &&
                    canConfirmInstallmentPeriodForCashOut(expense, account, d, userProfile, now);
                if (asBtn) {
                    const eid = esc(String(expense.id));
                    const pk = esc(periodKey);
                    return `<button type="button" class="${cls} installment-tooltip-pill-btn" data-expense-id="${eid}" data-period-key="${pk}" title="Confirmar pagamento desta parcela">${esc(lab)}</button>`;
                }
                return `<span class="${cls}">${esc(lab)}</span>`;
            })
            .join('');
    }

    const nFull = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    const n = st.applies && !st.emptyListPeriod ? st.total : nFull;
    const per = nFull > 0 ? amt / nFull : amt;

    let summaryBlock = '';
    if (st.emptyListPeriod && listPeriod) {
        summaryBlock = `<div class="installment-tooltip-summary"><p class="installment-tooltip-line">Nenhum vencimento neste período do filtro.</p></div>`;
    } else if (st.applies && (listPeriod ? st.total >= 1 : st.total >= 2)) {
        const statsMid = listPeriod
            ? ` <span class="installment-tooltip-line-label">neste período</span> · `
            : ' · ';
        summaryBlock = `<div class="installment-tooltip-summary">
    <p class="installment-tooltip-line installment-tooltip-line--stats"><strong>${st.paidCount}/${st.total}</strong> parcelas pagas${statsMid}<strong>${st.remaining}</strong> restantes</p>
    <p class="installment-tooltip-line">${formatCurrency(amt, currency)} <span class="installment-tooltip-line-label">total</span></p>
    <p class="installment-tooltip-line installment-tooltip-line--per">${formatCurrency(per, currency)} <span class="installment-tooltip-line-label">por parcela</span></p>
  </div>`;
    } else {
        summaryBlock = `<div class="installment-tooltip-summary"><p class="installment-tooltip-line">${formatCurrency(amt, currency)}</p></div>`;
    }

    const pillsSection = pillsRow
        ? `<div class="installment-tooltip-pills-wrap">
    <p class="installment-tooltip-pills-title">${listPeriod ? 'Vencimentos no período' : 'Vencimentos'}</p>
    <div class="installment-tooltip-pills">${pillsRow}</div>
  </div>`
        : '';

    const contractLabel = loanMeta ? 'Contrato em' : 'Compra em';
    return `<div class="installment-tooltip-panel" role="tooltip">
  <div class="installment-tooltip-head">
    <p class="installment-tooltip-card">${cardName}</p>
    <p class="installment-tooltip-desc">${desc}</p>
  </div>
  <div class="installment-tooltip-meta-block">
    <p class="installment-tooltip-meta">${contractLabel} ${purchaseStr}</p>
    ${cycleLine}
  </div>
  ${summaryBlock}
  ${pillsSection}
</div>`;
}

/**
 * Anel pequeno + painel de detalhes (hover) para tabelas de despesas e compras do cartão.
 * @param {{ startDate: Date, endDate: Date } | null} [listPeriod] — filtro da lista de despesas (parcelas visíveis no período).
 */
export function formatInstallmentPopoverHtml(
    expense,
    account,
    currency = 'BRL',
    now = new Date(),
    userProfile = null,
    listPeriod = null
) {
    const ringInner = formatInstallmentRingCompactHtml(expense, account, now, {
        size: 'sm',
        userProfile,
        listPeriod
    });
    const st0 = getInstallmentState(expense, account, now, userProfile);
    const scoped = listPeriod
        ? scopeInstallmentStateToListPeriod(st0, expense, account, now, userProfile, listPeriod)
        : null;
    const meta = listPeriod
        ? getInstallmentConfirmMetaForListPeriod(expense, account, userProfile, now, scoped)
        : getCurrentMonthInstallmentMeta(expense, account, userProfile, now);
    let ring = ringInner;
    if (meta.canConfirmClick && expense?.id) {
        const eid = esc(String(expense.id));
        const pk = esc(meta.periodKey || '');
        const title = listPeriod
            ? 'Confirmar pagamento desta parcela (período do filtro)'
            : 'Confirmar pagamento da parcela deste mês';
        ring = `<button type="button" class="installment-ring-confirm-btn" data-expense-id="${eid}" data-period-key="${pk}" title="${esc(title)}" aria-label="${esc(title)}">${ringInner}</button>`;
    } else {
        ring = `<span class="installment-ring-popover__ring-wrap">${ringInner}</span>`;
    }
    const panel = formatInstallmentTooltipPanelHtml(expense, account, currency, now, userProfile, listPeriod);
    return `<div class="installment-ring-popover" tabindex="0">${ring}${panel}</div>`;
}

/**
 * Cabeçalho visual do preview de parcelas (modal): anel + “Faltam N de M”.
 * Opções: `summaryTitle`, `summaryLineHtml`, `ariaLabel` — sobrescrevem o texto de compra parcelada (cartão/empréstimo).
 */
export function formatInstallmentRemainingSummaryHtml(st, options = {}) {
    if (!st.applies || st.total < 2) return '';
    if (st.allPaid || st.remaining === 0) return '';
    const { paidCount, total, remaining } = st;
    const r = 20;
    const circumference = 2 * Math.PI * r;
    const frac = total > 0 ? paidCount / total : 0;
    const dashOffset = circumference * (1 - frac);
    const aria =
        options.ariaLabel != null && String(options.ariaLabel).trim() !== ''
            ? String(options.ariaLabel)
            : `${remaining} parcela${remaining === 1 ? '' : 's'} restante${remaining === 1 ? '' : 's'} de ${total}`;
    let hint;
    if (options.hint !== undefined && options.hint !== null) {
        hint = options.hint;
    } else if (options.loan) {
        hint = '';
    } else {
        hint = 'Vencimentos estimados pelo ciclo do cartão';
    }
    const appendHtml = options.appendHtml ? String(options.appendHtml) : '';
    const hintBlock = hint ? `<span class="installment-remaining-hint">${esc(hint)}</span>` : '';
    const appendBlock = appendHtml
        ? `<div class="installment-remaining-append">${appendHtml}</div>`
        : '';
    const title =
        options.summaryTitle != null && String(options.summaryTitle).trim() !== ''
            ? esc(String(options.summaryTitle))
            : 'Parcelas restantes';
    const lineHtml =
        options.summaryLineHtml != null && String(options.summaryLineHtml).trim() !== ''
            ? String(options.summaryLineHtml)
            : `<strong>${remaining}</strong> de <strong>${total}</strong> a pagar`;
    const extraCls = options.summaryVariant === 'recurringYear' ? ' installment-remaining-summary--recurring-year' : '';
    return `<div class="installment-remaining-summary${extraCls}${appendHtml ? ' installment-remaining-summary--with-append' : ''}" role="status" aria-label="${esc(aria)}">
  <div class="installment-remaining-ring" aria-hidden="true">
    <svg class="installment-remaining-ring__svg" viewBox="0 0 52 52" width="52" height="52">
      <circle class="installment-remaining-ring__track" cx="26" cy="26" r="${r}" fill="none" />
      <g transform="rotate(-90 26 26)">
        <circle class="installment-remaining-ring__progress" cx="26" cy="26" r="${r}" fill="none"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${dashOffset}" />
      </g>
    </svg>
    <span class="installment-remaining-ring__num">${remaining}</span>
  </div>
  <div class="installment-remaining-copy">
    <span class="installment-remaining-title">${title}</span>
    <span class="installment-remaining-line">${lineHtml}</span>
    ${hintBlock}
    ${appendBlock}
  </div>
</div>`;
}

/** Texto curto para busca / acessibilidade (sem HTML). */
export function formatInstallmentStatusPlain(expense, account, now = new Date(), userProfile = null, listPeriod = null) {
    const st0 = getInstallmentState(expense, account, now, userProfile);
    const st = listPeriod
        ? scopeInstallmentStateToListPeriod(st0, expense, account, now, userProfile, listPeriod)
        : { ...st0, emptyListPeriod: false };

    if (st.emptyListPeriod) return 'sem vencimento no período';

    const useScoped = listPeriod && st.applies && st.dueDates?.length >= 1;
    if (useScoped) {
        if (st.allPaid || st.paidCount >= st.total) return 'Pago';
        return `${st.paidCount}/${st.total} parcelas pagas`;
    }

    if (!st0.applies || st0.total < 2) {
        return st0.allPaid ? 'Pago' : expense.isPaid ? 'Pago' : 'Parcelado';
    }
    if (st0.allPaid || st0.paidCount >= st0.total) return 'Pago';
    return `${st0.paidCount}/${st0.total} parcelas pagas`;
}

const EXPENSE_TABLE_BADGE_PENDING =
    '<span class="expense-status-badge expense-status-badge--pending">Pendente</span>';

/**
 * Botões Pago / Pendente para alternar apenas `isPaid` (lista simples ou parcela tratada como registo único).
 */
export function expenseTableBatchPaidToggleButton(expense) {
    if (!expense) return EXPENSE_TABLE_BADGE_PENDING;
    const paid = expense.isPaid !== false;
    const label = paid ? 'Pago' : 'Pendente';
    const id = esc(String(expense.id));
    const cls = paid ? 'expense-status-badge--paid' : 'expense-status-badge--pending';
    const title = paid ? 'Clique para marcar como pendente' : 'Clique para marcar como paga';
    const aria = paid ? 'Marcar saída como pendente (não paga)' : 'Marcar saída como paga';
    return `<button type="button" class="expense-status-badge ${cls} expense-paid-toggle" data-expense-id="${id}" data-paid-toggle-mode="batch-is-paid" title="${title}" aria-label="${esc(aria)}">${label}</button>`;
}

/**
 * Coluna Status da tabela de despesas (filtro «este mês»): só Pago, Pendente ou botão Pagar! — sem anel.
 * @param {{ startDate: Date, endDate: Date }} listPeriodMonth
 */
export function formatExpenseTableStatusBadgeHtml(expense, account, userProfile, now, listPeriodMonth) {
    if (!expense) return EXPENSE_TABLE_BADGE_PENDING;
    const st = getInstallmentState(expense, account, now, userProfile);
    const nInst = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    const creditParcelado =
        account && isCreditCardType(account.type) && nInst >= 2;
    if (!st.applies || st.total < 2) {
        if (creditParcelado) return EXPENSE_TABLE_BADGE_PENDING;
        return expenseTableBatchPaidToggleButton(expense);
    }
    const t0Start = startOfDay(listPeriodMonth.startDate).getTime();
    const t0End = listPeriodMonth.endDate.getTime();
    let dueInMonth = null;
    for (const d of st.dueDates) {
        const u = startOfDay(d).getTime();
        if (u >= t0Start && u <= t0End) {
            dueInMonth = d;
            break;
        }
    }
    if (!dueInMonth) return EXPENSE_TABLE_BADGE_PENDING;
    if (isInstallmentDuePaidForCashOut(expense, account, dueInMonth, userProfile, now)) {
        const eidPaid = esc(String(expense.id));
        const pkDay = calendarDayKeyFromDate(dueInMonth);
        const pkMon = monthKeyFromDate(dueInMonth);
        return `<button type="button" class="expense-status-badge expense-status-badge--paid expense-paid-toggle" data-expense-id="${eidPaid}" data-paid-toggle-mode="period-keys-unconfirm" data-period-day="${esc(
            pkDay
        )}" data-period-month="${esc(pkMon)}" title="Clique para desfazer confirmação no caixa" aria-label="${esc(
            'Desfazer pagamento registado no caixa'
        )}">Pago</button>`;
    }
    if (canConfirmInstallmentPeriodForCashOut(expense, account, dueInMonth, userProfile, now)) {
        const pk = calendarDayKeyFromDate(dueInMonth);
        const eid = esc(String(expense.id));
        const pkEsc = esc(pk);
        return `<button type="button" class="expense-status-badge expense-status-badge--pay expense-inst-confirm-btn" data-expense-id="${eid}" data-period-key="${pkEsc}">Pagar</button>`;
    }
    const pkPend = calendarDayKeyFromDate(dueInMonth);
    const eidPend = esc(String(expense.id));
    const pkPendEsc = esc(pkPend);
    return `<button type="button" class="expense-status-badge expense-status-badge--pending expense-inst-confirm-btn" data-expense-id="${eidPend}" data-period-key="${pkPendEsc}" title="Confirmar pagamento no caixa (abre confirmação)" aria-label="Confirmar pagamento no caixa desta parcela">Pendente</button>`;
}

/**
 * Pílulas visuais: cada vencimento; pagas com rótulo «Pago», pendentes com mês + (k/N).
 * @param {{ startDate: Date, endDate: Date } | null} [listPeriod] — `null` = todas as parcelas do contrato (ex.: filtro «este ano»).
 */
export function formatInstallmentPillsHtml(expense, account, now = new Date(), userProfile = null, listPeriod = null) {
    const st0 = getInstallmentState(expense, account, now, userProfile);
    const st = listPeriod
        ? scopeInstallmentStateToListPeriod(st0, expense, account, now, userProfile, listPeriod)
        : { ...st0, emptyListPeriod: false };

    if (st.emptyListPeriod) {
        return `<span class="installment-pills installment-pills--simple" title="Nenhum vencimento neste período do filtro">—</span>`;
    }
    if (!st.applies || st.total < 2) {
        const nInst = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
        const creditParcelado = account && isCreditCardType(account.type) && nInst >= 2;
        if (creditParcelado) {
            return `<span class="installment-pills installment-pills--simple">Parcelado</span>`;
        }
        const t = st.allPaid ? 'Pago' : expense.isPaid ? 'Pago' : 'Parcelado';
        return `<span class="installment-pills installment-pills--simple">${t}</span>`;
    }

    const refMk = monthKeyFromDate(now);
    const fullTotal = st0.total;
    const pills = st.dueDates.map((d) => {
        const paid = isInstallmentDuePaidForCashOut(expense, account, d, userProfile, now);
        const dueMk = monthKeyFromDate(d);
        const unpaidDueOrPast = !paid && dueMk <= refMk;
        const lab = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const safe = lab.replace(/</g, '');
        const duePastCls = unpaidDueOrPast ? ' installment-pill--due-or-past' : '';
        const nFull = getParcelNumberInFullSchedule(expense, account, d, now, userProfile) || st.dueDates.indexOf(d) + 1;
        const title = `Parcela ${nFull} de ${fullTotal} · venc. ${d.toLocaleDateString('pt-BR')}`;
        if (paid) {
            return `<span class="installment-pill installment-pill--paid installment-pill--verbose" title="${esc(title)}"><span class="installment-pill__state">${esc('Pago')}</span> <span class="installment-pill__mon">${esc(safe)}</span></span>`;
        }
        return `<span class="installment-pill installment-pill--pending${duePastCls} installment-pill--verbose" title="${esc(title)}"><span class="installment-pill__mon">${esc(safe)}</span> <span class="installment-pill__n">${nFull}/${fullTotal}</span></span>`;
    });
    const ariaPaid = listPeriod ? st.paidCount : st0.paidCount;
    const ariaTot = listPeriod ? st.total : st0.total;
    return `<span class="installment-pills" role="group" aria-label="${ariaPaid} de ${ariaTot} parcelas pagas no período">${pills.join('')}</span>`;
}
