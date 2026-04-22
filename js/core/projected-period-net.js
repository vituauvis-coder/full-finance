/**
 * Meses-calendário e fluxo de caixa projetado (parcelas / datas futuras).
 * Usado no dashboard (reports) e no servidor para saldo projetado em períodos futuros.
 */
import {
    expenseCountsAsCashOut,
    isCreditCardType,
    movementDateToJsDate
} from './utils.js';
import {
    getCreditInstallmentMonthAllocationsIncludingFuture,
    getLoanInstallmentMonthAllocationsIncludingFuture,
    isLoanExpense
} from './credit-installments.js';
import { applySplitNetToContribution, isSplitReimbursementGain } from './split-net.js';

/** Mês-calendário estritamente após o mês de referência (projeção). */
export function isProjectionMonth(mo, ref = new Date()) {
    const y = mo.start.getFullYear();
    const m = mo.start.getMonth();
    const ry = ref.getFullYear();
    const rm = ref.getMonth();
    return y > ry || (y === ry && m > rm);
}

/** Meses completos entre start e end (inclusive). */
export function enumerateCalendarMonths(startDate, endDate) {
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

/**
 * Saídas projetadas no mês (cartão/empréstimo por alocação; demais pela data do lançamento).
 */
export function sumOutflowsProjectedForCalendarMonth(
    mo,
    userExpenses,
    userAccounts,
    now,
    userProfile = null,
    splitRequests = null
) {
    const accountsById = new Map((userAccounts || []).map((a) => [a.id, a]));
    const mk = `${mo.start.getFullYear()}-${String(mo.start.getMonth() + 1).padStart(2, '0')}`;
    const targetMonthOrdinal = mo.start.getFullYear() * 12 + mo.start.getMonth();
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
            sum += applySplitNetToContribution(t, mk, allocs[mk] || 0, splitRequests);
        } else if (isLoanExpense(t) && (!acc || !isCreditCardType(acc.type)) && nInst >= 2) {
            const cacheKey = t.id || `loan|${t.accountId}|${String(t.date)}|${t.amount}`;
            if (!allocCache.has(cacheKey)) {
                allocCache.set(cacheKey, getLoanInstallmentMonthAllocationsIncludingFuture(t));
            }
            const allocs = allocCache.get(cacheKey);
            sum += applySplitNetToContribution(t, mk, allocs[mk] || 0, splitRequests);
        } else {
            const d = movementDateToJsDate(t.date);
            if (Number.isNaN(d.getTime())) continue;

            // Recorrência mensal "única" (legado): projeta em todos os meses a partir do mês-base.
            if (t.recurringMonthly === true) {
                const baseMonthOrdinal = d.getFullYear() * 12 + d.getMonth();
                if (targetMonthOrdinal >= baseMonthOrdinal && expenseCountsAsCashOut(t, acc)) {
                    sum += applySplitNetToContribution(t, mk, Number(t.amount) || 0, splitRequests);
                }
                continue;
            }

            if (d >= mo.start && d <= mo.end && expenseCountsAsCashOut(t, acc)) {
                sum += applySplitNetToContribution(t, mk, Number(t.amount) || 0, splitRequests);
            }
        }
    }
    return sum;
}

/** Entradas com data de competência no mês (ex.: série recorrente já lançada). */
export function sumProjectedGainsForCalendarMonth(mo, userGains) {
    let sum = 0;
    for (const t of userGains || []) {
        if (t.referenceOnly) continue;
        if (isSplitReimbursementGain(t)) continue;
        const d = movementDateToJsDate(t.date);
        if (d >= mo.start && d <= mo.end) sum += Number(t.amount) || 0;
    }
    return sum;
}

/**
 * Saldo projetado no fim do período [fromD, toD], quando todo o intervalo é futuro:
 * saldo atual (realizado até hoje) + Σ (entradas previstas − saídas previstas) por mês civil.
 */
export function projectedCashBalanceAfterFuturePeriod(
    baseBalance,
    fromD,
    toD,
    now,
    accounts,
    expenses,
    gains,
    userProfile,
    splitRequests = null
) {
    const months = enumerateCalendarMonths(fromD, toD);
    let bal = Number(baseBalance) || 0;
    for (const mo of months) {
        const inc = sumProjectedGainsForCalendarMonth(mo, gains);
        const out = sumOutflowsProjectedForCalendarMonth(
            mo,
            expenses,
            accounts,
            now,
            userProfile,
            splitRequests
        );
        bal += inc - out;
    }
    return bal;
}
