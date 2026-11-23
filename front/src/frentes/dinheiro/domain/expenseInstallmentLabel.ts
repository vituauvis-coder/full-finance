import {
    getCurrentMonthInstallmentMeta,
    getDueDatesForExpenseListPeriod,
    getInstallmentState,
    getParcelNumberInFullSchedule,
    isInstallmentDuePaidForCashOut
} from '@motor/dinheiro/credit-installments.js';
import { isCreditCardType } from '../../../lib/accounts';
import { isLoanExpense } from '@motor/dinheiro/loan-expense.js';
import type { Account, Movement, UserProfile } from '../../../lib/types/finance';
import {
    isExpenseInstallmentTableRow,
    type ExpenseInstallmentTableRow
} from './expenseInstallmentTableRows';

export type InstallmentListPeriod = {
    startDate: Date;
    endDate: Date;
};

export type InstallmentMonthParcel = {
    index: number;
    total: number | null;
    paid: boolean;
    scope: 'row' | 'period';
};

export type InstallmentLabelParts = {
    total: number;
    paidCount: number;
    remaining: number;
    allPaid: boolean;
    monthParcel: InstallmentMonthParcel | null;
};

/**
 * Parcela visível no mês/período do filtro — paridade com
 * `resolveExpenseInstallmentMonthParcel` do legacy.
 */
export function resolveExpenseInstallmentMonthParcel(
    expense: Movement,
    account: Account | undefined,
    userProfile: UserProfile | null | undefined,
    now: Date,
    listPeriod: InstallmentListPeriod | null
): InstallmentMonthParcel | null {
    const inst = expense as ExpenseInstallmentTableRow;
    if (isExpenseInstallmentTableRow(expense)) {
        const index = Number(inst.__instParcelIndex);
        const total = Number(inst.__instParcelTotal);
        if (!Number.isFinite(index) || index < 1) return null;
        return {
            index,
            total: Number.isFinite(total) && total >= 2 ? total : null,
            paid: !!inst.__instParcelPaid,
            scope: 'row'
        };
    }

    let due: Date | null = null;
    if (listPeriod) {
        const dues = getDueDatesForExpenseListPeriod(
            expense,
            account,
            now,
            userProfile,
            listPeriod
        ) as Date[];
        if (dues.length >= 1) due = dues[0];
    } else {
        const meta = getCurrentMonthInstallmentMeta(expense, account, userProfile, now);
        if (meta.hasCurrentMonth && meta.currentDue) due = meta.currentDue as Date;
    }
    if (!due) return null;

    const index = getParcelNumberInFullSchedule(expense, account, due, now, userProfile);
    if (!index) return null;
    const total = Math.max(2, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    const paid = !!isInstallmentDuePaidForCashOut(expense, account, due, userProfile, now);
    return { index, total, paid, scope: 'period' };
}

/**
 * Dados da coluna «Parcelas» — paridade com `getExpenseInstallmentLabelParts` do legacy.
 */
export function getExpenseInstallmentLabelParts(
    expense: Movement | null | undefined,
    account: Account | undefined,
    userProfile: UserProfile | null | undefined,
    now: Date = new Date(),
    listPeriod: InstallmentListPeriod | null = null
): InstallmentLabelParts | null {
    if (!expense) return null;
    const inst = expense as ExpenseInstallmentTableRow;
    if (inst.__instRow && inst.__instEmptyPeriod) return null;

    const nField = Math.max(
        1,
        parseInt(String(expense.installmentCount ?? inst.__instParcelTotal ?? '1'), 10) || 1
    );
    const nParc = parseInt(String(expense.installmentCount ?? ''), 10);
    const cardOrLoan =
        (account && isCreditCardType(account.type) && Number.isFinite(nParc) && nParc >= 2) ||
        (isLoanExpense(expense) &&
            (!account || !isCreditCardType(account.type)) &&
            Number.isFinite(nParc) &&
            nParc >= 2) ||
        (Number.isFinite(nParc) && nParc >= 2);
    if (!cardOrLoan && nField < 2) return null;

    const st = getInstallmentState(expense, account, now, userProfile);
    if (!st.applies || st.total < 2) return null;

    return {
        total: st.total,
        paidCount: st.paidCount,
        remaining: st.remaining,
        allPaid: !!st.allPaid,
        monthParcel: resolveExpenseInstallmentMonthParcel(
            expense,
            account,
            userProfile,
            now,
            listPeriod
        )
    };
}
