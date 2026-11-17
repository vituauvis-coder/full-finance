import { apiFetch } from '../../../lib/http';

export type Movement = { id: string; amount: number; description?: string; category?: string; date?: string };
export type Account = { id: string; name: string; type?: string };

export type FinanceData = {
    userExpenses: Movement[];
    userGains: Movement[];
    userAccounts: Account[];
    userDebts: { id: string; company?: string; notes?: string }[];
    cofrinhoBuckets: { id: string; name?: string; balance?: number }[];
    userProfile?: { currency?: string } | null;
};

export function fetchFinanceData(): Promise<FinanceData> {
    return apiFetch('/api/data');
}

export function fetchDebts(): Promise<{ debts: FinanceData['userDebts'] }> {
    return apiFetch('/api/debts');
}

export function fetchDashboardBalance(from: string, to: string): Promise<{ balance: number; source: string }> {
    const q = new URLSearchParams({ from, to });
    return apiFetch(`/api/dashboard/balance?${q}`);
}

export function formatBRL(value: number, currency = 'BRL') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
}

export function sumAmounts(rows: { amount?: number }[]) {
    return rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
}