import { isCreditCardType } from './utils.js';

/** Lançamento marcado como despesa fixa (mesma convenção da lista de saídas). */
export function expenseIsMarkedFixed(expense) {
    if (!expense) return false;
    return Boolean(
        expense.isFixed === true ||
            expense.isFixed === 'true' ||
            expense.isFixed === 1 ||
            expense.isFixed === '1'
    );
}

/**
 * Critérios do painel: combinação com OR — se vários ligados, a saída entra ao bater certo em pelo menos um.
 * Conjunto vazio = não restringir.
 */
export function expenseMatchesAnyDashboardFacet(expense, account, facets) {
    if (!facets || facets.size === 0) return true;
    const hasCreditAccount = Boolean(account && isCreditCardType(account.type));
    const fixed = expenseIsMarkedFixed(expense);
    if (facets.has('fixed') && fixed) return true;
    if (facets.has('variable') && !fixed) return true;
    if (facets.has('credit') && hasCreditAccount) return true;
    if (facets.has('other') && !fixed && !hasCreditAccount) return true;
    return false;
}

export function filterExpensesForDashboardFacets(expenses, accounts, facets) {
    if (!facets || facets.size === 0) return expenses || [];
    const byId = new Map((accounts || []).map((a) => [a.id, a]));
    return (expenses || []).filter((e) =>
        expenseMatchesAnyDashboardFacet(e, byId.get(e.accountId), facets)
    );
}
