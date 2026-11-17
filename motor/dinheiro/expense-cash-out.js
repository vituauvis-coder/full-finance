import { isCreditCardType } from './account-type.js';

export function expenseCountsAsCashOut(expense, account) {
    if (!account) return true;
    if (isCreditCardType(account.type) && expense.isPaid === false) return false;
    return true;
}