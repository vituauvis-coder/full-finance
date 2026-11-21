import {
    creditCardInstallmentsDueInCalendarMonth,
    totalCreditInvoicesForMonth
} from '@motor/dinheiro/wallet-invoice-month.js';
import { getCreditInstallmentIndexDueInMonthKey } from '@motor/dinheiro/credit-installments.js';
import { expenseCreditInstallmentScheduledForMonthKey } from '@legacy/js/core/expense-calendar-month.js';
import { isBankAccount, isCreditCardType } from '../../../lib/accounts';
import { movementDate as movementToDate } from '../../../lib/period';
import type { Account, FinanceData, Movement } from '../../../lib/types/finance';
import { acceptedOutgoingSplits } from '../../dashboard/domain/splitRequestsForBalance';
import type { WalletActivityItem } from './walletInstitutions';

export type WalletSummaryStats = {
    cashTotal: number;
    monthInvoices: number;
    limitTotal: number;
    purchasingPower: number;
    limitUsagePct: number;
    creditCardCount: number;
};

export function computeWalletSummaryStats(data: FinanceData, year: number, monthIndex0: number): WalletSummaryStats {
    const creditCards = data.userAccounts.filter((a) => isCreditCardType(a.type));
    const splits = acceptedOutgoingSplits(data.expenseSplitRequests);
    const monthInvoices = totalCreditInvoicesForMonth(
        creditCards,
        data.userExpenses,
        year,
        monthIndex0,
        data.userProfile,
        splits,
        data.userExpenses
    );

    let limitTotal = 0;
    for (const c of creditCards) {
        const lim = Number(c.limit);
        if (Number.isFinite(lim) && lim > 0) limitTotal += lim;
    }

    const cashTotal = data.userAccounts
        .filter(isBankAccount)
        .reduce((s, a) => s + (Number(a.balance) || 0), 0);

    const purchasingPower = Math.max(0, limitTotal - monthInvoices);
    const limitUsagePct = limitTotal > 0 ? Math.min(100, (monthInvoices / limitTotal) * 100) : 0;

    return {
        cashTotal,
        monthInvoices,
        limitTotal,
        purchasingPower,
        limitUsagePct,
        creditCardCount: creditCards.length
    };
}

export function creditCardDueAmount(
    card: Account,
    data: FinanceData,
    year: number,
    monthIndex0: number
) {
    const splits = acceptedOutgoingSplits(data.expenseSplitRequests);
    return creditCardInstallmentsDueInCalendarMonth(
        card,
        data.userExpenses,
        year,
        monthIndex0,
        data.userProfile,
        splits,
        data.userExpenses
    );
}

export function walletDueList(creditCards: Account[], data: FinanceData, year: number, monthIndex0: number) {
    const sorted = [...creditCards].sort((a, b) => {
        const da = Number(a.dueDay) || 0;
        const db = Number(b.dueDay) || 0;
        if (da !== db) return da - db;
        return String(a.name).localeCompare(String(b.name), 'pt-BR');
    });
    return sorted.map((c) => ({
        card: c,
        dueLabel: c.dueDay != null ? `Dia ${c.dueDay}` : '—',
        amount: creditCardDueAmount(c, data, year, monthIndex0)
    }));
}

export function walletActivityForMonth(
    data: FinanceData,
    year: number,
    monthIndex0: number
): WalletActivityItem[] {
    const monthKey = `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`;
    const creditCards = data.userAccounts.filter((a) => isCreditCardType(a.type));
    const cardById = new Map(creditCards.map((c) => [c.id, c]));
    const splits = acceptedOutgoingSplits(data.expenseSplitRequests);
    const merged: WalletActivityItem[] = [];

    for (const t of data.userExpenses) {
        const c = cardById.get(String(t.accountId));
        if (!c) continue;
        const contrib = expenseCreditInstallmentScheduledForMonthKey(
            t,
            c,
            monthKey,
            data.userProfile,
            splits,
            data.userExpenses
        );
        if (!Number.isFinite(contrib) || contrib === 0) continue;
        const inst = getCreditInstallmentIndexDueInMonthKey(t, c, monthKey);
        merged.push({
            date: t.date,
            label: t.description || 'Saída',
            amount: -Math.abs(contrib),
            cardName: c.name,
            inst: inst ? { index: inst.index, total: inst.total } : null
        });
    }

    merged.sort((a, b) => movementToDate(b).getTime() - movementToDate(a).getTime());
    return merged.slice(0, 12);
}