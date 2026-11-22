import { getExpenseSummaryContributionAmount } from '@motor/dinheiro/expense-summary-amount.js';
import type { Account, ExpenseSplitRequest, Movement } from '../../../lib/types/finance';
import { filterExpensesInPeriod } from '../../../lib/filterExpensesInPeriod';
import { splitExpenseLedgerRows } from '../../dinheiro/domain/expenseLedgerBuckets';
import { civilMonthKey } from '../../dinheiro/domain/expenseSummaryStats';
import { expenseListPaymentStatus } from '../../dinheiro/domain/expensePeriodListTotal';

export type DashboardWalletBucketKey = 'fixed' | 'invoices' | 'extra' | 'cofrinhos';

export type DashboardWalletBucket = {
    key: DashboardWalletBucketKey;
    amount: number;
    count: number;
};

function sumRows(
    rows: Movement[],
    accounts: Account[],
    allExpenses: Movement[],
    monthKey: string,
    splitRequests: ExpenseSplitRequest[]
) {
    const byId = new Map(accounts.map((a) => [a.id, a]));
    let amount = 0;
    let count = 0;
    for (const m of rows) {
        const acc = m.accountId ? byId.get(String(m.accountId)) : undefined;
        const amt = getExpenseSummaryContributionAmount(m, acc, splitRequests, allExpenses, monthKey);
        if (!Number.isFinite(amt) || amt <= 0) continue;
        amount += amt;
        count += 1;
    }
    return { amount, count };
}

/** Mesma regra do resumo do módulo Saídas (mês da fatura, parcela, chips pagas/pendentes). */
export function computeDashboardWalletBuckets(
    expenses: Movement[],
    accounts: Account[],
    period: string,
    civilYear: number,
    splitRequests: ExpenseSplitRequest[] = []
): DashboardWalletBucket[] {
    const rows = filterExpensesInPeriod(expenses, accounts, period, civilYear, {
        paymentStatus: expenseListPaymentStatus()
    });
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const monthKey = civilMonthKey(period, civilYear) ?? '';

    const { essential, faturaLines, other, cofrinhos: cofrinhoRows } = splitExpenseLedgerRows(rows, byId);
    const fixed = sumRows(essential, accounts, expenses, monthKey, splitRequests);
    const invoices = sumRows(faturaLines, accounts, expenses, monthKey, splitRequests);
    const extra = sumRows(other, accounts, expenses, monthKey, splitRequests);
    const cofrinhos = sumRows(cofrinhoRows, accounts, expenses, monthKey, splitRequests);

    return (['fixed', 'invoices', 'extra', 'cofrinhos'] as const).map((key) => {
        const block =
            key === 'fixed' ? fixed : key === 'invoices' ? invoices : key === 'extra' ? extra : cofrinhos;
        return { key, amount: block.amount, count: block.count };
    });
}