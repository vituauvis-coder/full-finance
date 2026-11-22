import { computeCashBalanceForAccountIdAsOf } from '@legacy/js/core/cash-balance.js';
import { cashBalanceAccountForDisplay } from '@motor/dinheiro/wallet-institution-functions.js';
import { isCashBalanceAccountType } from '../../../lib/accounts';
import type { Account, FinanceData } from '../../../lib/types/finance';
import { resolveSaldoEmContaFocusAccount } from '../../dashboard/domain/dashboardBalanceAccountTag';
import { computeWalletMonthFlowSaldoEmConta } from '../../dashboard/domain/walletMonthFlowSaldo';
import { acceptedOutgoingSplits } from '../../dashboard/domain/splitRequestsForBalance';

export type WalletDisplayBalanceOpts = {
    asOf?: Date;
    year?: number;
    monthIndex?: number;
};

export function walletBalanceAsOfEnd(asOf: Date = new Date()): Date {
    const d = new Date(asOf);
    d.setHours(23, 59, 59, 999);
    return d;
}

/** Saldo de caixa calculado (movimentos + cartão vinculado), igual ao motor do dashboard. */
export function walletAccountCashBalance(data: FinanceData, account: Account, asOf?: Date): number {
    const cutoff = walletBalanceAsOfEnd(asOf);
    const institution = cashBalanceAccountForDisplay(account, data.userAccounts) ?? account;
    const listed = data.userAccounts.find((a) => String(a.id) === String(institution.id));
    if (listed && typeof listed.balance === 'number' && Number.isFinite(listed.balance)) {
        return listed.balance;
    }
    if (!isCashBalanceAccountType(institution.type)) {
        return Number(institution.balance ?? institution.initialBalance) || 0;
    }
    const splits = acceptedOutgoingSplits(data.expenseSplitRequests);
    return computeCashBalanceForAccountIdAsOf(
        institution.id,
        data.userAccounts,
        data.userExpenses ?? [],
        data.userGains ?? [],
        cutoff,
        data.userProfile ?? null,
        splits
    );
}

/** Conta do topo «Saldo em conta» + cartão instituição principal. */
export function walletPrimaryCashFocusAccount(data: FinanceData): Account | null {
    return resolveSaldoEmContaFocusAccount(
        data.userAccounts,
        data.userExpenses ?? [],
        data.userGains ?? [],
        data.userProfile?.id ?? null
    );
}

export function walletPrimaryCashBalance(data: FinanceData, asOf?: Date): number | null {
    const focus = walletPrimaryCashFocusAccount(data);
    if (!focus) return null;
    return walletAccountCashBalance(data, focus, asOf);
}

function movementInCivilMonth(
    date: string | { seconds?: number } | undefined,
    year: number,
    monthIndex: number
): boolean {
    if (!date) return false;
    const d = typeof date === 'string' ? new Date(date) : new Date((date.seconds ?? 0) * 1000);
    return d.getFullYear() === year && d.getMonth() === monthIndex;
}

/** Entrada (ex.: PIX) creditada nesta conta no mês — única exceção além da conta principal. */
function accountHasInboundInMonth(
    data: FinanceData,
    accountId: string,
    year: number,
    monthIndex: number
): boolean {
    return (data.userGains ?? []).some(
        (g) => String(g.accountId) === String(accountId) && movementInCivilMonth(g.date, year, monthIndex)
    );
}

function isPrimaryCashDisplayAccount(inst: Account, focus: Account | null): boolean {
    if (!focus) return false;
    return String(inst.id) === String(focus.id);
}

/**
 * Saldo exibido na carteira:
 * — conta principal: balanço − outras despesas no mês (não o extrato acumulado da conta);
 * — demais contas: 0, salvo PIX/entrada na própria conta no mês.
 */
export function walletDisplayCashBalance(
    data: FinanceData,
    account: Account,
    opts: WalletDisplayBalanceOpts = {}
): number {
    const inst = cashBalanceAccountForDisplay(account, data.userAccounts) ?? account;
    const focus = walletPrimaryCashFocusAccount(data);
    const year = opts.year ?? new Date().getFullYear();
    const monthIndex = opts.monthIndex ?? new Date().getMonth();

    if (isPrimaryCashDisplayAccount(inst, focus)) {
        return computeWalletMonthFlowSaldoEmConta(data, year, monthIndex);
    }

    if (accountHasInboundInMonth(data, inst.id, year, monthIndex)) {
        return walletAccountCashBalance(data, inst, opts.asOf);
    }

    return 0;
}