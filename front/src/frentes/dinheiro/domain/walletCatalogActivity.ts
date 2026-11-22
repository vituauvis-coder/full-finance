import type { Account, FinanceData } from '../../../lib/types/finance';
import { walletDisplayCashBalance } from './walletCashBalance';

export function accountDisplayBalance(acc: Account, data?: FinanceData | null): number {
    if (data) return walletDisplayCashBalance(data, acc);
    return Number(acc.balance ?? acc.initialBalance) || 0;
}

export function accountHasMovementInMonth(
    accountId: string,
    data: FinanceData,
    year: number,
    monthIndex: number
): boolean {
    const match = (date?: string | { seconds?: number }) => {
        if (!date) return false;
        const d = typeof date === 'string' ? new Date(date) : new Date((date.seconds ?? 0) * 1000);
        return d.getFullYear() === year && d.getMonth() === monthIndex;
    };

    return (
        data.userExpenses.some((m) => m.accountId === accountId && match(m.date)) ||
        data.userGains.some((m) => m.accountId === accountId && match(m.date))
    );
}

export function groupAccountIds(row: import('./walletInstitutions').WalletInstitutionRowModel): string[] {
    if (row.kind === 'bank') {
        return [row.bank.id, ...row.creditCards.map((c) => c.id), ...row.debitCards.map((c) => c.id)];
    }
    return [row.card.id];
}

export function groupHasActivity(
    row: import('./walletInstitutions').WalletInstitutionRowModel,
    data: FinanceData,
    year: number,
    monthIndex: number
): boolean {
    return groupAccountIds(row).some((id) => accountHasMovementInMonth(id, data, year, monthIndex));
}