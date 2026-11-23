import { referenceMonthToYearMonth } from './cofrinhoPeriod';

export type CofrinhoMonthlyBalance = {
    id: string;
    bucketId?: string;
    accountId?: string;
    referenceMonth?: string;
    principalAmount?: number;
    balanceWithYield?: number;
    createdAt?: string;
    updatedAt?: string;
};

export function monthlyBalanceAccountId(row: CofrinhoMonthlyBalance): string {
    const raw = row as CofrinhoMonthlyBalance & { account_id?: string };
    return String(row.accountId ?? raw.account_id ?? '');
}

export function monthlyBalanceBucketId(row: CofrinhoMonthlyBalance): string {
    const raw = row as CofrinhoMonthlyBalance & { bucket_id?: string };
    return String(row.bucketId ?? raw.bucket_id ?? '');
}

export function monthlyBalanceYearMonth(row: CofrinhoMonthlyBalance): string {
    const raw = row as CofrinhoMonthlyBalance & { reference_month?: string };
    return referenceMonthToYearMonth(row.referenceMonth ?? raw.reference_month);
}

export function findMonthlyBalanceForBucketMonth(
    balances: CofrinhoMonthlyBalance[],
    bucketId: string,
    yearMonth: string,
    accountId?: string
): CofrinhoMonthlyBalance | undefined {
    const rows = (balances ?? []).filter(
        (b) => monthlyBalanceBucketId(b) === bucketId && monthlyBalanceYearMonth(b) === yearMonth
    );
    if (accountId) {
        return rows.find((b) => monthlyBalanceAccountId(b) === accountId);
    }
    return rows[0];
}