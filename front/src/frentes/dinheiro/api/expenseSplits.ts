import { apiFetch } from '../../../lib/http';
import type { ExpenseSplitRequest } from '../../../lib/types/finance';

export type SplitUserOption = {
    id: string;
    name?: string | null;
    email: string;
};

export type CreateExpenseSplitBody = {
    sourceExpenseId: string;
    recipientEmail: string;
    amount: number;
    requesterCreditAccountId: string;
    splitScope?: 'FULL_EXPENSE' | 'INSTALLMENT';
    targetInstallmentIndex?: number | null;
    targetPeriodKey?: string | null;
    sourceInstallmentCount?: number;
};

export async function fetchUsersForSplit(): Promise<{ users: SplitUserOption[] }> {
    return apiFetch('/api/users/for-split') as Promise<{ users: SplitUserOption[] }>;
}

export async function createExpenseSplitRequest(
    body: CreateExpenseSplitBody
): Promise<{ split: ExpenseSplitRequest }> {
    return apiFetch('/api/expense-splits', {
        method: 'POST',
        body: JSON.stringify(body)
    }) as Promise<{ split: ExpenseSplitRequest }>;
}

export async function rejectExpenseSplitRequest(id: string) {
    return apiFetch(`/api/expense-splits/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        body: '{}'
    });
}

export async function cancelExpenseSplitRequest(id: string) {
    return apiFetch(`/api/expense-splits/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
