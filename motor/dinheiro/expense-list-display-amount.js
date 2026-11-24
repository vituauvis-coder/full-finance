import { getExpensePerInstallmentDisplayAmount } from './credit-installments.js';
import {
    applySplitNetToContribution,
    expenseIdForSplitLookup,
    movementMonthKey
} from './split-net.js';

export { expenseIdForSplitLookup } from './split-net.js';

function movementForSplitLookup(movement) {
    const baseId = expenseIdForSplitLookup(movement);
    if (!baseId || baseId === String(movement?.id ?? '')) return movement;
    return { ...movement, id: baseId };
}

/**
 * Valor exibido na tabela de saídas / fatura (parcela do mês + rateio aceito).
 * Paridade com `applySplitNetToContribution` no legacy (`transactions.js`).
 */
export function getExpenseListRowDisplayAmount(
    movement,
    account,
    splitRequests = null,
    allUserExpenses = null
) {
    const inst = movement;
    const expense = movementForSplitLookup(movement);
    const isInstRow = Boolean(inst?.__instRow);

    if (isInstRow) {
        const base =
            Number(inst.__instParcelAmount) > 0
                ? Number(inst.__instParcelAmount)
                : getExpensePerInstallmentDisplayAmount(expense, account);
        const periodKey = String(inst.__instPeriodKey ?? '').trim() || movementMonthKey(movement?.date);
        return applySplitNetToContribution(
            expense,
            periodKey,
            base,
            splitRequests,
            allUserExpenses
        );
    }

    const base = getExpensePerInstallmentDisplayAmount(movement, account);
    const periodKey = movementMonthKey(movement?.date);
    return applySplitNetToContribution(
        expense,
        periodKey,
        base,
        splitRequests,
        allUserExpenses
    );
}