import type { Movement } from '../../../lib/types/finance';
import { filterExpensesByListFilter } from '../../../lib/filterExpensesInPeriod';
import type { ListFilter } from '../../../lib/movementList';
import { isCofrinhoPoolExpense } from './cofrinhoAggregations';
import { EXPENSE_COFRINHO_CATEGORY } from './cofrinhoConstants';
import { buildCofrinhoLedgerRows } from './cofrinhoLedgerRows';
import { mergeCofrinhoLedgerWithYield } from './cofrinhoYieldLedger';
import { resolveCofrinhoPeriodScope } from './cofrinhoPeriodScope';
import type { CofrinhoSaidasMetricsInput } from './cofrinhoSaidasTotals';

export const COFRINHO_APP_ROW_ID_PREFIX = 'cofrinho-app-';

export function isCofrinhoApplicationExtratoRow(m: Movement): boolean {
    return String(m.id).startsWith(COFRINHO_APP_ROW_ID_PREFIX);
}

/**
 * Linhas do extrato Cofrinhos em Saídas = mesmo conjunto do dashboard (extrato Cofrinhos, entradas, sem rendimento)
 * + depósitos no pool que ainda não foram distribuídos.
 */
export function buildCofrinhoSaidasExtratoMovements(input: CofrinhoSaidasMetricsInput): Movement[] {
    const scope = resolveCofrinhoPeriodScope(input.period, input.civilYear);
    const base = buildCofrinhoLedgerRows(
        input.allExpenses,
        input.applications,
        input.buckets,
        input.accounts,
        scope,
        input.tripPayloadOutflows
    );
    const merged = mergeCofrinhoLedgerWithYield(
        base,
        input.monthlyBalances,
        input.buckets,
        scope
    );
    const byExpenseId = new Map(input.allExpenses.map((e) => [String(e.id), e]));
    const filteredIds = new Set(input.filtered.map((e) => String(e.id)));
    const seenExpenseIds = new Set<string>();
    const rows: Movement[] = [];
    const accountFilter = input.accountFilterId?.trim() || '';

    for (const r of merged) {
        if (r.kind !== 'in' || r.isYield) continue;
        if (accountFilter && r.accountId && r.accountId !== accountFilter) continue;

        if (r.expenseId) {
            const exp = byExpenseId.get(String(r.expenseId));
            if (!exp || exp.isPaid === false) continue;
            if (!filteredIds.has(String(r.expenseId))) continue;
            seenExpenseIds.add(String(r.expenseId));
            rows.push(exp);
            continue;
        }

        if (r.applicationId) {
            rows.push({
                id: `${COFRINHO_APP_ROW_ID_PREFIX}${r.applicationId}`,
                amount: r.amount,
                description: r.title,
                category: EXPENSE_COFRINHO_CATEGORY,
                subcategory: r.bucketName,
                date: r.recordDate || r.sortAt,
                accountId: r.accountId,
                isPaid: true,
                isCofrinho: true
            } as Movement);
        }
    }

    for (const e of input.filtered) {
        if (!isCofrinhoPoolExpense(e) || e.isPaid === false) continue;
        if (seenExpenseIds.has(String(e.id))) continue;
        rows.push(e);
    }

    return rows;
}

export function filterCofrinhoSaidasExtratoForList(
    rows: Movement[],
    input: CofrinhoSaidasMetricsInput,
    listFilter: ListFilter
): Movement[] {
    return filterExpensesByListFilter(rows, input.accounts, listFilter);
}