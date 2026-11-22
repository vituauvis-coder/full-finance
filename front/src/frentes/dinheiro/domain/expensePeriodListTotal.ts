import { filterExpensesInPeriod } from '../../../lib/filterExpensesInPeriod';
import type { Account, Movement, SplitBundle } from '../../../lib/types/finance';
import { loadExpensesListStatusChips } from '../../../lib/uiChipPreferences';
import { acceptedOutgoingSplits } from '../../dashboard/domain/splitRequestsForBalance';
import { aggregateExpenseTotals, civilMonthKey } from './expenseSummaryStats';

/** Mesmos filtros pagas/não pagas do módulo Saídas (padrão: ambos). */
export function expenseListPaymentStatus(): Set<'paid' | 'unpaid'> {
    const chips = loadExpensesListStatusChips();
    const s = new Set<'paid' | 'unpaid'>();
    if (chips.paid) s.add('paid');
    if (chips.unpaid) s.add('unpaid');
    if (s.size === 0) {
        s.add('paid');
        s.add('unpaid');
    }
    return s;
}

/**
 * Total de saídas igual ao card do módulo Saídas: mês da fatura no cartão,
 * valor da parcela no mês e rateios aceitos.
 */
export function totalExpensesMatchingSaidasList(
    expenses: Movement[],
    accounts: Account[],
    period: string,
    civilYear: number,
    splitBundle: SplitBundle | undefined,
    paymentStatus?: Set<'paid' | 'unpaid'>
): number {
    const status = paymentStatus ?? expenseListPaymentStatus();
    const rows = filterExpensesInPeriod(expenses, accounts, period, civilYear, { paymentStatus: status });
    const monthKey = civilMonthKey(period, civilYear) ?? '';
    const splits = acceptedOutgoingSplits(splitBundle);
    return aggregateExpenseTotals(rows, accounts, {
        splitRequests: splits,
        allUserExpenses: expenses,
        monthKey
    }).total;
}