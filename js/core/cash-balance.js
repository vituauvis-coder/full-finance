/**
 * Saldo de caixa por conta e «Saldo total» (soma) — mesma regra em dashboard, contas e snapshot no servidor.
 */
import {
    getCreditCardCumulativeCashOutThrough,
    getLoanCumulativeCashOutThrough,
    shouldDeferCashOutForMonthlyFixedSeries
} from './credit-installments.js';
import {
    isPeriodConfirmedForDebit,
    parseCashOutConfirmedPeriods
} from './finance-preferences.js';
import {
    isCashBalanceAccountType,
    isCreditCardType,
    movementDateToJsDate
} from './utils.js';

/** Contas de caixa: exibição por conta não fica negativa por somatório (limite inferior 0). Não aplicar ao somar o total. */
function clampCashAccountBalance(type, value) {
    if (type === 'investimento') return value;
    if (type === 'cartao_credito' || type === 'cartao_debito') return value;
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    return Math.max(0, n);
}

/**
 * Saldo líquido da conta até `asOfEndInclusive`, sem clamp.
 * Com entradas numa conta e saídas noutra, o clamp por conta fazia o «Saldo total» ignorar despesas
 * (ex.: total = só entradas do mês).
 */
export function computeCashAccountRawBalance(
    account,
    userAccounts,
    userExpenses,
    userGains,
    asOfEndInclusive,
    userProfile = null
) {
    if (account.type === 'cartao_credito' || account.type === 'cartao_debito') return 0;
    const cutoff = asOfEndInclusive.getTime();
    const onOrBeforeCutoff = (dateField) => {
        const t = movementDateToJsDate(dateField);
        return !Number.isNaN(t.getTime()) && t.getTime() <= cutoff;
    };
    let currentBalance = Number(account.initialBalance);
    if (!Number.isFinite(currentBalance)) currentBalance = 0;
    (userGains || [])
        .filter((g) => g.accountId === account.id && onOrBeforeCutoff(g.date))
        .forEach((g) => {
            currentBalance += Number(g.amount) || 0;
        });
    (userExpenses || [])
        .filter((e) => e.accountId === account.id)
        .forEach((e) => {
            const loanOut = getLoanCumulativeCashOutThrough(e, asOfEndInclusive, userProfile);
            if (loanOut != null) {
                currentBalance -= loanOut;
                return;
            }
            if (onOrBeforeCutoff(e.date)) {
                if (shouldDeferCashOutForMonthlyFixedSeries(e, account, userProfile)) {
                    const d = movementDateToJsDate(e.date);
                    if (!isPeriodConfirmedForDebit(parseCashOutConfirmedPeriods(e), d)) {
                        return;
                    }
                }
                currentBalance -= Number(e.amount) || 0;
            }
        });
    (userAccounts || []).forEach((card) => {
        if (!isCreditCardType(card.type)) return;
        if (card.linkedAccountId !== account.id) return;
        (userExpenses || []).forEach((e) => {
            if (e.accountId !== card.id) return;
            currentBalance -= getCreditCardCumulativeCashOutThrough(e, card, asOfEndInclusive, userProfile);
        });
    });
    return currentBalance;
}

/**
 * Calcula os saldos das contas com base em despesas e ganhos (valor exibido por conta com clamp).
 */
export function calculateAllBalances(userAccounts, userExpenses, userGains, userProfile = null) {
    const asOf = new Date();
    asOf.setHours(23, 59, 59, 999);
    userAccounts.forEach((account) => {
        if (account.type === 'cartao_credito') {
            account.currentBalance = 0;
        } else if (account.type === 'cartao_debito') {
            account.currentBalance = 0;
        } else {
            const raw = computeCashAccountRawBalance(
                account,
                userAccounts,
                userExpenses,
                userGains,
                asOf,
                userProfile
            );
            account.currentBalance = clampCashAccountBalance(account.type, raw);
        }
    });
    const byId = new Map(userAccounts.map((a) => [a.id, a]));
    userAccounts.forEach((account) => {
        if (account.type !== 'cartao_debito') return;
        const linkedId = account.linkedAccountId;
        if (linkedId && byId.has(linkedId)) {
            account.currentBalance = byId.get(linkedId).currentBalance;
        } else {
            account.currentBalance = 0;
        }
    });
    return userAccounts;
}

/**
 * Soma dos saldos de contas que não são cartão, com movimentos até `asOfEndInclusive`.
 * Usa saldo líquido (sem clamp por conta) para refletir saídas mesmo quando estão noutra conta que ficaria «zerada».
 */
export function computeCashBalanceTotalAsOf(
    userAccounts,
    userExpenses,
    userGains,
    asOfEndInclusive,
    userProfile = null
) {
    const accs = (userAccounts || []).map((a) => ({ ...a }));
    const rawById = new Map();

    accs.forEach((account) => {
        if (account.type === 'cartao_credito') {
            account.currentBalance = 0;
        } else if (account.type === 'cartao_debito') {
            account.currentBalance = 0;
        } else {
            const raw = computeCashAccountRawBalance(
                account,
                userAccounts,
                userExpenses,
                userGains,
                asOfEndInclusive,
                userProfile
            );
            rawById.set(account.id, raw);
            account.currentBalance = clampCashAccountBalance(account.type, raw);
        }
    });
    const byId = new Map(accs.map((a) => [a.id, a]));
    accs.forEach((account) => {
        if (account.type !== 'cartao_debito') return;
        const linkedId = account.linkedAccountId;
        if (linkedId && byId.has(linkedId)) {
            account.currentBalance = byId.get(linkedId).currentBalance;
        } else {
            account.currentBalance = 0;
        }
    });
    let sum = 0;
    for (const a of accs) {
        if (isCashBalanceAccountType(a.type)) {
            sum += Number(rawById.get(a.id)) || 0;
        }
    }
    if (userProfile && userProfile.balanceOffset) {
        sum += Number(userProfile.balanceOffset);
    }
    return sum;
}

/**
 * Variação do caixa no mês civil corrente (entre o fim do mês anterior e hoje).
 * Não inclui o efeito acumulado dos meses anteriores — alinha o card do dashboard a «Entradas/Saídas do mês».
 */
export function computeCashBalanceChangeCurrentMonth(
    userAccounts,
    userExpenses,
    userGains,
    now = new Date(),
    userProfile = null
) {
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return (
        computeCashBalanceTotalAsOf(userAccounts, userExpenses, userGains, endOfToday, userProfile) -
        computeCashBalanceTotalAsOf(userAccounts, userExpenses, userGains, endOfPrevMonth, userProfile)
    );
}
