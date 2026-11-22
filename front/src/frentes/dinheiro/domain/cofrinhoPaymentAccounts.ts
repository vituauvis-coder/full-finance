import type { Account } from '../../../lib/types/finance';
import { isPixBankAccountType } from '../../../lib/accounts';

/** Contas de débito usadas em aportes e pool (corrente / poupança). */
export function cofrinhoPaymentAccounts(accounts: Account[]): Account[] {
    return (accounts ?? []).filter((a) => isPixBankAccountType(a.type));
}