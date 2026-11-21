import { apiFetch } from '../../../lib/http';
import type { Debt, DebtUpdate } from '../domain/debtTypes';

export function createDebt(body: {
    company: string;
    initialAmount?: number | null;
    colorKey?: string;
    notes?: string | null;
}): Promise<Debt> {
    return apiFetch('/api/debts', { method: 'POST', body: JSON.stringify(body) });
}

export function updateDebt(
    id: string,
    body: Partial<{
        company: string;
        initialAmount: number | null;
        colorKey: string;
        notes: string | null;
        isClosed: boolean;
    }>
): Promise<Debt> {
    return apiFetch(`/api/debts/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteDebt(id: string): Promise<{ ok: boolean }> {
    return apiFetch(`/api/debts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function createDebtUpdate(body: {
    debtId: string;
    amount: number;
    date: string;
    description?: string | null;
}): Promise<DebtUpdate> {
    return apiFetch('/api/debt-updates', { method: 'POST', body: JSON.stringify(body) });
}

export function updateDebtUpdate(
    id: string,
    body: {
        debtId: string;
        amount: number;
        date: string;
        description?: string | null;
    }
): Promise<DebtUpdate> {
    return apiFetch(`/api/debt-updates/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}

export function deleteDebtUpdate(id: string): Promise<{ ok: boolean }> {
    return apiFetch(`/api/debt-updates/${encodeURIComponent(id)}`, { method: 'DELETE' });
}