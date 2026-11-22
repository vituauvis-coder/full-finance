import { apiFetch } from '../../../lib/http';
import type { Account } from '../../../lib/types/finance';

export type AccountFormPayload = {
    name: string;
    type: string;
    initialBalance?: number;
    limit?: number | null;
    dueDay?: number | null;
    closeDay?: number | null;
    linkedAccountId?: string | null;
    institution?: string | null;
    walletFunctions?: string[];
    isPrimaryCash?: boolean;
    plasticTone?: string | null;
    plasticColor?: string | null;
};

export async function createAccount(payload: AccountFormPayload) {
    return apiFetch<Account>('/api/accounts', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateAccount(id: string, payload: Partial<AccountFormPayload>) {
    return apiFetch<Account>(`/api/accounts/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    });
}

export async function deleteAccount(id: string) {
    return apiFetch(`/api/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}