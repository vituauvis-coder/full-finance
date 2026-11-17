import { isCreditCardType, isPixBankAccountType } from './accounts';
import { isPeriodConfirmedForDebit, monthKeyFromDate, parseCashOutConfirmedPeriods } from './financePreferences';
import { movementDate } from './period';
import type { Account, Movement } from './types/finance';

/** Indica se a linha pode mostrar «Confirmar débito» (PIX/conta pendente, ainda não confirmada no período). */
export function expenseRowCanConfirmCashOut(m: Movement, account: Account | undefined) {
    if (m.isPaid !== false) return false;
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