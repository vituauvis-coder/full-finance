import { apiFetch } from '../../../lib/http';
import type { Movement } from '../../../lib/types/finance';

export function movementToApiDate(dateInput: string) {
    const d = new Date(`${dateInput}T12:00:00`);
    return { seconds: Math.floor(d.getTime() / 1000) };
}

export function movementFromFormDate(m: Movement | null): string {
    if (!m?.date) return new Date().toISOString().slice(0, 10);
    if (typeof m.date === 'object' && m.date.seconds != null) {
        return new Date(m.date.seconds * 1000).toISOString().slice(0, 10);
    }
    const d = new Date(m.date as string);
    if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
    return d.toISOString().slice(0, 10);
}

export type GainFormPayload = {
    description: string;
    amount: number;
    accountId: string;
    category: string;
    subcategory?: string | null;
    date: string;
    isPaid: boolean;
    isRecurring?: boolean;
};

export async function createGain(payload: GainFormPayload) {
    return apiFetch('/api/gains', {
        method: 'POST',
        body: JSON.stringify({
            ...payload,
            date: movementToApiDate(payload.date),
            isRecurring: payload.isRecurring ? true : undefined
        })
    });
}

export async function updateGain(id: string, payload: GainFormPayload) {
    return apiFetch(`/api/gains/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({
            ...payload,
            date: movementToApiDate(payload.date)
        })
    });
}

export async function deleteGain(id: string) {
    return apiFetch(`/api/gains/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export type ExpenseFormPayload = {
    description: string;
    amount: number;
    accountId: string;
    category: string;
    subcategory?: string | null;
    date: string;
    isPaid: boolean;
    installmentCount?: number;
    recurringMonthly?: boolean;
    isFixed?: boolean;
    isCofrinho?: boolean;
};

export async function createExpense(payload: ExpenseFormPayload) {
    return apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
            ...payload,
            date: movementToApiDate(payload.date)
        })
    });
}

export async function updateExpense(id: string, payload: ExpenseFormPayload) {
    return apiFetch(`/api/expenses/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({
            ...payload,
            date: movementToApiDate(payload.date)
        })
    });
}

export async function deleteExpense(id: string) {
    return apiFetch(`/api/expenses/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function patchGainsBatch(ids: string[], patch: Record<string, unknown>) {
    return apiFetch('/api/gains/batch', { method: 'PATCH', body: JSON.stringify({ ids, patch }) });
}

export async function patchExpensesBatch(ids: string[], patch: Record<string, unknown>) {
    return apiFetch('/api/expenses/batch', { method: 'PATCH', body: JSON.stringify({ ids, patch }) });
}

export async function confirmExpenseCashOut(expenseId: string, periodKey: string) {
    return apiFetch(`/api/expenses/${encodeURIComponent(expenseId)}/confirm-cash-out`, {
        method: 'POST',
        body: JSON.stringify({ periodKey })
    });
}