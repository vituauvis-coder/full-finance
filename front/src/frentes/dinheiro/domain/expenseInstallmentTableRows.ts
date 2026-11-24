import {
    getDueDatesForExpenseListPeriod,
    getParcelNumberInFullSchedule,
    isInstallmentDuePaidForCashOut
} from '@motor/dinheiro/credit-installments.js';
import { isLoanExpense } from '@motor/dinheiro/loan-expense.js';
import { calendarDayKeyFromDate } from '@motor/dinheiro/cash-out-periods.js';
import { movementDate } from '../../../lib/period';
import { isCreditCardType } from '../../../lib/accounts';
import { resolveExpenseMovementAccount } from '../../../lib/expenseMovementAccount';
import type { InstallmentListPeriod } from './expenseInstallmentLabel';
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
    const fromMovement = movementDate(m);
    if (!Number.isNaN(fromMovement.getTime())) return fromMovement;
    const raw = m.date;
    if (typeof raw === 'string') {
        const d = new Date(`${raw.slice(0, 10)}T12:00:00`);
        if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date(NaN);
}

function isMultiInstallmentExpense(expense: Movement, account: Account | undefined) {
    const nParc = parseInt(String(expense.installmentCount ?? ''), 10);
    return (
        (account && isCreditCardType(account.type) && Number.isFinite(nParc) && nParc >= 2) ||
        (isLoanExpense(expense) &&
            (!account || !isCreditCardType(account.type)) &&
            Number.isFinite(nParc) &&
            nParc >= 2) ||
        (Number.isFinite(nParc) && nParc >= 2)
    );
}

function buildInstallmentTableRows(
    expense: Movement,
    account: Account | undefined,
    userProfile: UserProfile | null | undefined,
    dueDates: Date[],
    now: Date
): ExpenseInstallmentTableRow[] {
    const nParc = parseInt(String(expense.installmentCount ?? ''), 10);
    const totalAmt = Number(expense.amount) || 0;
    const nFullTotal = Math.max(1, Number.isFinite(nParc) ? nParc : 1);
    const per = totalAmt / nFullTotal;
    const out: ExpenseInstallmentTableRow[] = [];

    if (dueDates.length === 0) {
        out.push({
            ...expense,
            __instRow: true,
            __instEmptyPeriod: true,
            __instParcelAmount: per
        });
        return out;
    }

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

/**
 * Fora do mês civil atual: cada parcela vira uma linha (paridade com o extrato legado).
 */
export function expandInstallmentRowsForExpenseList(
    list: Movement[],
    accounts: Account[],
    userProfile: UserProfile | null | undefined,
    listPeriod: InstallmentListPeriod | null,
    now: Date = new Date()
): Movement[] {
    const out: Movement[] = [];
    for (const t of list) {
        const account = resolveExpenseMovementAccount(t, accounts);
        if (!isMultiInstallmentExpense(t, account)) {
            out.push(t);
            continue;
        }
        const dueDates = getDueDatesForExpenseListPeriod(
            t,
            account,
            now,
            userProfile,
            listPeriod
        ) as Date[];
        out.push(...buildInstallmentTableRows(t, account, userProfile, dueDates, now));
    }
    return out;
}

/** No modal de detalhe: uma linha por parcela (como o extrato legado fora do «este mês»). */
export function expandExpenseDetailTableRows(
    expense: Movement,
    account: Account | undefined,
    userProfile: UserProfile | null | undefined,
    now: Date = new Date()
): Movement[] {
    if (!isMultiInstallmentExpense(expense, account)) return [expense];

    const dueDates = getDueDatesForExpenseListPeriod(
        expense,
        account,
        now,
        userProfile,
        null
    ) as Date[];

    if (dueDates.length === 0) return [expense];
    return buildInstallmentTableRows(expense, account, userProfile, dueDates, now);
}