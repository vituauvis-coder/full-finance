import {
    getDueDatesForExpenseListPeriod,
    getParcelNumberInFullSchedule,
    isInstallmentDuePaidForCashOut
} from '@motor/dinheiro/credit-installments.js';
import { isLoanExpense } from '@motor/dinheiro/loan-expense.js';
import { calendarDayKeyFromDate } from '@motor/dinheiro/cash-out-periods.js';
import { isCreditCardType } from '../../../lib/accounts';
import type { Account, Movement, UserProfile } from '../../../lib/types/finance';

export type ExpenseInstallmentTableRow = Movement & {
    __instRow?: true;
    __instEmptyPeriod?: true;
    __instDueDate?: Date;
    __instParcelIndex?: number;
    __instParcelTotal?: number;
    __instParcelPaid?: boolean;
    __instPeriodKey?: string;
    __instParcelAmount?: number;
};

export function isExpenseInstallmentTableRow(m: Movement): m is ExpenseInstallmentTableRow {
    return !!(m as ExpenseInstallmentTableRow).__instRow;
}

export function expenseInstallmentRowDisplayDate(m: Movement): Date {
    const inst = m as ExpenseInstallmentTableRow;
    if (inst.__instDueDate && !Number.isNaN(inst.__instDueDate.getTime())) return inst.__instDueDate;
    const raw = m.date;
    if (typeof raw === 'string') {
        const d = new Date(`${raw.slice(0, 10)}T12:00:00`);
        if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date(NaN);
}

/** No modal de detalhe: uma linha por parcela (como o extrato legado fora do «este mês»). */
export function expandExpenseDetailTableRows(
    expense: Movement,
    account: Account | undefined,
    userProfile: UserProfile | null | undefined,
    now: Date = new Date()
): Movement[] {
    const nParc = parseInt(String(expense.installmentCount ?? ''), 10);
    const isMulti =
        (account && isCreditCardType(account.type) && Number.isFinite(nParc) && nParc >= 2) ||
        (isLoanExpense(expense) &&
            (!account || !isCreditCardType(account.type)) &&
            Number.isFinite(nParc) &&
            nParc >= 2) ||
        (Number.isFinite(nParc) && nParc >= 2);
    if (!isMulti) return [expense];

    const dueDates = getDueDatesForExpenseListPeriod(
        expense,
        account,
        now,
        userProfile,
        null
    ) as Date[];

    const totalAmt = Number(expense.amount) || 0;
    const nFullTotal = Math.max(1, nParc);
    const per = totalAmt / nFullTotal;

    if (dueDates.length === 0) {
        return [expense];
    }

    const out: ExpenseInstallmentTableRow[] = [];
    for (const d of dueDates) {
        const idx = getParcelNumberInFullSchedule(expense, account, d, now, userProfile);
        const paid = isInstallmentDuePaidForCashOut(expense, account, d, userProfile, now);
        const periodKey = calendarDayKeyFromDate(d);
        out.push({
            ...expense,
            id: `${expense.id}::inst-${periodKey}`,
            date: periodKey,
            __instRow: true,
            __instDueDate: d,
            __instParcelIndex: idx,
            __instParcelTotal: nFullTotal,
            __instParcelPaid: paid,
            __instPeriodKey: periodKey,
            __instParcelAmount: per
        });
    }
    return out;
}