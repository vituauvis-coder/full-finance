import { computeDisplayedCashBalance } from '@motor/dinheiro/displayed-cash-balance.js';
import type { Account, FinanceData, Movement } from '../../../lib/types/finance';
import { acceptedOutgoingSplits } from './splitRequestsForBalance';

function movementArray(m: Movement[] | undefined): Movement[] {
    return m ?? [];
}

/** Saldo em conta agora — mesma regra do motor, com conta principal do bundle `/api/data`. */
export function computeDashboardCashBalanceAsOf(data: FinanceData, asOfEnd: Date): number {
    const splitRequests = acceptedOutgoingSplits(data.expenseSplitRequests);
    return computeDisplayedCashBalance(
        data.userAccounts as Account[],
        movementArray(data.userExpenses),
        movementArray(data.userGains),
        asOfEnd,
        data.userProfile ?? null,
        splitRequests
    );
}