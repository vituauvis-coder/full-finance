import { EXPENSE_LOAN_PAYMENT_VALUE } from './loanExpense';
import type { Account, Movement } from './types/finance';

/** Conta real da despesa (cartão, banco, VA). Ignora placeholder `__expense_loan__`. */
export function resolveExpenseMovementAccount(
    expense: Movement,
    accounts?: Account[]
): Account | undefined {
    if (!expense.accountId || !accounts?.length) return undefined;
    const id = String(expense.accountId);
    if (id === EXPENSE_LOAN_PAYMENT_VALUE) return undefined;
    return accounts.find((a) => a.id === id);
}