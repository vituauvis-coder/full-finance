import { apiFetch } from './http';

/** Saldo em conta no intervalo civil — `GET /api/dashboard/balance`. */
export async function fetchPeriodBalance(start: Date, end: Date): Promise<number | null> {
    const q = new URLSearchParams({ from: start.toISOString(), to: end.toISOString() });
    try {
        const r = await apiFetch<{ balance: number }>(`/api/dashboard/balance?${q}`);
        const n = Number(r.balance);
        return Number.isFinite(n) ? n : null;
    } catch {
        return null;
    }
}