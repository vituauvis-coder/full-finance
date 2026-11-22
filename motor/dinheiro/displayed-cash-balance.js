import {
    computeCashBalanceForAccountIdAsOf,
    computeCashBalanceTotalAsOf
} from '../../legacy-web/js/core/cash-balance.js';
import { isCashBalanceAccountType } from '../../legacy-web/js/core/utils.js';
import { pickPrimaryCashAccounts } from './primary-cash-balance.js';
import { cashBalanceAccountForDisplay } from './wallet-institution-functions.js';

/**
 * Saldo exibido no dashboard («Saldo em conta»):
 * — com conta principal: só essa conta (sem balance_offset do perfil);
 * — sem principal: soma das contas de caixa + offset manual.
 */
export function computeDisplayedCashBalance(
    userAccounts,
    userExpenses,
    userGains,
    asOfEndInclusive,
    userProfile = null,
    splitRequests = null
) {
    const all = userAccounts || [];
    const primaryPick = pickPrimaryCashAccounts(all, isCashBalanceAccountType);
    if (primaryPick?.length === 1) {
        const institution = cashBalanceAccountForDisplay(primaryPick[0], all) ?? primaryPick[0];
        const profileNoOffset = userProfile ? { ...userProfile, balanceOffset: 0 } : null;
        return computeCashBalanceForAccountIdAsOf(
            institution.id,
            all,
            userExpenses,
            userGains,
            asOfEndInclusive,
            profileNoOffset,
            splitRequests
        );
    }
    return computeCashBalanceTotalAsOf(
        all,
        userExpenses,
        userGains,
        asOfEndInclusive,
        userProfile,
        splitRequests
    );
}