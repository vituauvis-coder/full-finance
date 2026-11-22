import type { Account, Movement, SplitBundle } from '../../../lib/types/finance';
import { acceptedOutgoingSplits } from './splitRequestsForBalance';
import { computeDashboardWalletBuckets } from './dashboardWalletBuckets';
import { totalExpensesMatchingSaidasList } from '../../dinheiro/domain/expensePeriodListTotal';

export type MonthWalletFlowTotals = {
    /** Todas as saídas do período (módulo Saídas). */
    totalOut: number;
    /** Essenciais fora do cartão + fatura do cartão no período. */
    mandatoryOut: number;
    /** Extras, cofrinhos e demais — o que reduz o «sobrou» depois do obrigatório. */
    discretionaryOut: number;
};

/**
 * Regras da carteira visual:
 * - Balanço = entradas − obrigatório (fixas + cartão)
 * - Saídas = total de saídas
 * - Saldo em conta = balanço − outras despesas (extras/cofrinhos) = entradas − saídas
 */
export function computeMonthWalletFlowTotals(
    expenses: Movement[],
    accounts: Account[],
    period: string,
    civilYear: number,
    splitBundle: SplitBundle | undefined
): MonthWalletFlowTotals {
    const totalOut = totalExpensesMatchingSaidasList(
        expenses,
        accounts,
        period,
        civilYear,
        splitBundle
    );
    const splits = acceptedOutgoingSplits(splitBundle);
    const buckets = computeDashboardWalletBuckets(expenses, accounts, period, civilYear, splits);
    const byKey = new Map(buckets.map((b) => [b.key, b.amount]));
    const mandatoryOut = (byKey.get('fixed') ?? 0) + (byKey.get('invoices') ?? 0);
    /** «Outras despesas» visíveis nos chips: extras + cofrinhos (não fixas nem fatura). */
    const discretionaryOut =
        (byKey.get('extra') ?? 0) + (byKey.get('cofrinhos') ?? 0);

    return { totalOut, mandatoryOut, discretionaryOut };
}

export function balancoFromIncomeAndMandatory(income: number, mandatoryOut: number): number {
    return income - mandatoryOut;
}

export function monthFlowSaldoEmConta(income: number, flow: MonthWalletFlowTotals): number {
    return balancoFromIncomeAndMandatory(income, flow.mandatoryOut) - flow.discretionaryOut;
}