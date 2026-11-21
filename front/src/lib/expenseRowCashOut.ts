import {
    canConfirmInstallmentPeriodForCashOut,
    getInstallmentState,
    isInstallmentDuePaidForCashOut
} from '@motor/dinheiro/credit-installments.js';
import {
    calendarDayKeyFromDate,
    isPeriodConfirmedForDebit,
    monthKeyFromDate,
    parseCashOutConfirmedPeriods
} from './financePreferences';
import { isCreditCardType, isPixBankAccountType } from './accounts';
import { movementDate } from './period';
import type { Account, Movement, UserProfile } from './types/finance';

export type ExpenseListPeriod = {
    startDate: Date;
    endDate: Date;
};

function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

/** Vencimento da parcela (ou do lançamento) que cai no período filtrado da lista. */
export function expenseDueInListPeriod(
    expense: Movement,
    account: Account | undefined,
    userProfile: UserProfile | null | undefined,
    listPeriod: ExpenseListPeriod | null | undefined,
    now: Date = new Date()
): Date | null {
    if (!listPeriod) return null;
    const st = getInstallmentState(expense, account, now, userProfile);
    const nInst = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    const creditParcelado = !!(account && isCreditCardType(account.type) && nInst >= 2);

    if (st.applies && st.total >= 2 && Array.isArray(st.dueDates) && st.dueDates.length) {
        const t0 = startOfDay(listPeriod.startDate).getTime();
        const t1 = listPeriod.endDate.getTime();
        for (const d of st.dueDates as Date[]) {
            const u = startOfDay(d).getTime();
            if (u >= t0 && u <= t1) return d;
        }
        return null;
    }

    if (creditParcelado) return null;

    const d = movementDate(expense);
    if (Number.isNaN(d.getTime())) return null;
    const u = startOfDay(d).getTime();
    if (u < startOfDay(listPeriod.startDate).getTime() || u > listPeriod.endDate.getTime()) {
        return null;
    }
    return d;
}

/**
 * Status «Pago» na lista de saídas — paridade com `formatExpenseTableStatusBadgeHtml` do legado.
 * Cartão/empréstimo parcelado: só a parcela com vencimento no mês filtrado.
 */
export function expenseRowAppearsPaid(
    m: Movement,
    account?: Account,
    userProfile?: UserProfile | null,
    listPeriod?: ExpenseListPeriod | null,
    now: Date = new Date()
) {
    const nInst = Math.max(1, parseInt(String(m.installmentCount ?? '1'), 10) || 1);
    const creditParcelado = !!(account && isCreditCardType(account.type) && nInst >= 2);
    const st = getInstallmentState(m, account, now, userProfile);

    if (listPeriod && ((st.applies && st.total >= 2) || creditParcelado)) {
        if (!st.applies || st.total < 2) {
            // Cartão parcelado sem cronograma resolvido → não assumir pago.
            return false;
        }
        const due = expenseDueInListPeriod(m, account, userProfile, listPeriod, now);
        if (!due) return false;
        return !!isInstallmentDuePaidForCashOut(m, account, due, userProfile, now);
    }

    if (m.isPaid !== false) return true;
    const d = movementDate(m);
    if (Number.isNaN(d.getTime())) return false;
    return isPeriodConfirmedForDebit(parseCashOutConfirmedPeriods(m), d);
}

/**
 * Clique em Pendente deve confirmar débito no caixa (série/conta com confirmação manual),
 * em vez de só marcar `isPaid`.
 */
export function expenseRowCanConfirmCashOut(
    m: Movement,
    account: Account | undefined,
    userProfile?: UserProfile | null,
    listPeriod?: ExpenseListPeriod | null,
    now: Date = new Date()
) {
    if (expenseRowAppearsPaid(m, account, userProfile, listPeriod, now)) return false;

    const st = getInstallmentState(m, account, now, userProfile);
    if (st.applies && st.total >= 2 && listPeriod) {
        const due = expenseDueInListPeriod(m, account, userProfile, listPeriod, now);
        if (!due) return false;
        return !!canConfirmInstallmentPeriodForCashOut(m, account, due, userProfile, now);
    }

    if (!account || isCreditCardType(account.type)) return false;
    if (!isPixBankAccountType(account.type) && !account.type) return false;
    const d = movementDate(m);
    if (Number.isNaN(d.getTime())) return false;
    const confirmed = parseCashOutConfirmedPeriods(m);
    if (isPeriodConfirmedForDebit(confirmed, d)) return false;
    return true;
}

export function expenseCashOutPeriodKey(
    m: Movement,
    account?: Account,
    userProfile?: UserProfile | null,
    listPeriod?: ExpenseListPeriod | null,
    now: Date = new Date()
) {
    const due = expenseDueInListPeriod(m, account, userProfile, listPeriod, now);
    if (due) return calendarDayKeyFromDate(due);
    return monthKeyFromDate(movementDate(m));
}
