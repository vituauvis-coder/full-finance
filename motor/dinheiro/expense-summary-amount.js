import { getExpensePerInstallmentDisplayAmount } from './credit-installments.js';
import { applySplitNetToContribution } from './split-net.js';

/**
 * Valor de uma saída na base dos cards de resumo de Saídas:
 * parcela do mês (cartão/empréstimo) com rateio aceito já descontado.
 */
export function getExpenseSummaryContributionAmount(
    expense,
    account,
    splitRequests = null,
    allUserExpenses = null,
    monthKey = ''
) {
    const gross =
        getExpensePerInstallmentDisplayAmount(expense, account) || Number(expense?.amount) || 0;
    if (!splitRequests?.length) return gross;
    return applySplitNetToContribution(
        expense,
        monthKey,
        gross,
        splitRequests,
        allUserExpenses
    );
}
