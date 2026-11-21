import { isCreditCardType, isPixBankAccountType } from './accounts';
import { isPeriodConfirmedForDebit, monthKeyFromDate, parseCashOutConfirmedPeriods } from './financePreferences';
import { movementDate } from './period';
import type { Account, Movement } from './types/finance';

/** Pago na lista: `isPaid` ou débito do período já confirmado no caixa (legado). */
export function expenseRowAppearsPaid(m: Movement) {
    if (m.isPaid !== false) return true;
    const d = movementDate(m);
    if (Number.isNaN(d.getTime())) return false;
    return isPeriodConfirmedForDebit(parseCashOutConfirmedPeriods(m), d);
}

/**
 * Clique em Pendente deve confirmar débito no caixa (série/conta com confirmação manual),
 * em vez de só marcar `isPaid`.
 */
export function expenseRowCanConfirmCashOut(m: Movement, account: Account | undefined) {
    if (expenseRowAppearsPaid(m)) return false;
    if (!account || isCreditCardType(account.type)) return false;
    if (!isPixBankAccountType(account.type) && !account.type) return false;
    const d = movementDate(m);
    if (Number.isNaN(d.getTime())) return false;
    const confirmed = parseCashOutConfirmedPeriods(m);
    if (isPeriodConfirmedForDebit(confirmed, d)) return false;
    return true;
}

export function expenseCashOutPeriodKey(m: Movement) {
    return monthKeyFromDate(movementDate(m));
}