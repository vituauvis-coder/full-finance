import { apiFetch } from '../../../lib/http';
import type { CofrinhoApplication, CofrinhoBucket, CofrinhoBucketGoal } from '../domain/cofrinhoAggregations';
import type { CofrinhoMonthlyBalance } from '../domain/cofrinhoMonthlyBalances';
import { getBucketGoalForYear } from '../domain/cofrinhoAggregations';
import { cofrinhoGoalDeadlineFromGoal } from '../domain/cofrinhoGoalDeadline';

export async function createCofrinhoBucket(body: {
    name: string;
    colorKey?: string;
    icon?: string;
    yieldMultiplier?: number;
    kind?: string;
    tripId?: string;
}): Promise<CofrinhoBucket> {
    return apiFetch<CofrinhoBucket>('/api/cofrinho-buckets', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}

export async function updateCofrinhoBucket(
    id: string,
    body: Partial<{
        name: string;
        colorKey: string;
        icon: string;
        yieldMultiplier: number;
        kind: string;
        tripId?: string;
    }>
): Promise<CofrinhoBucket> {
    return apiFetch<CofrinhoBucket>(`/api/cofrinho-buckets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}

export async function deleteCofrinhoBucket(id: string): Promise<void> {
    await apiFetch(`/api/cofrinho-buckets/${id}`, { method: 'DELETE' });
}

export async function upsertBucketGoal(
    body: {
        bucketId: string;
        year: number;
        targetAmount: number;
        targetDeadline?: string | null;
        goalId?: string | null;
    },
    knownGoals?: CofrinhoBucketGoal[]
): Promise<CofrinhoBucketGoal> {
    const payload = {
        bucketId: body.bucketId,
        year: body.year,
        targetAmount: body.targetAmount,
        targetDeadline: body.targetDeadline ?? null
    };

    try {
        return await apiFetch<CofrinhoBucketGoal>('/api/cofrinho-bucket-goals/by-bucket-year', {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    } catch (byBucketErr) {
        const byBucketMsg = byBucketErr instanceof Error ? byBucketErr.message : '';
        const routeMissing =
            byBucketMsg.includes('Cannot PUT') ||
            byBucketMsg.includes('desatualizado') ||
            byBucketMsg.includes('Não encontrado');

        if (!routeMissing) {
            throw byBucketErr;
        }
    }

    const goalId =
        body.goalId ??
        getBucketGoalForYear(knownGoals ?? [], body.bucketId, body.year)?.id ??
        null;

    if (goalId) {
        return apiFetch<CofrinhoBucketGoal>(`/api/cofrinho-bucket-goals/${goalId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    }

    try {
        return await apiFetch<CofrinhoBucketGoal>('/api/cofrinho-bucket-goals', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    } catch (postErr) {
        const postMsg = postErr instanceof Error ? postErr.message : '';
        const duplicate =
            postMsg.includes('Já existe meta') ||
            postMsg.includes('409') ||
            postMsg.toLowerCase().includes('already exists');
        if (!duplicate) throw postErr;

        let retryId = getBucketGoalForYear(knownGoals ?? [], body.bucketId, body.year)?.id ?? null;
        if (!retryId) {
            try {
                const resolved = await apiFetch<CofrinhoBucketGoal>(
                    `/api/cofrinho-bucket-goals/resolve?bucketId=${encodeURIComponent(body.bucketId)}&year=${body.year}`
                );
                retryId = resolved?.id ?? null;
            } catch {
                retryId = null;
            }
        }
        if (retryId) {
            return apiFetch<CofrinhoBucketGoal>(`/api/cofrinho-bucket-goals/${retryId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        }
        throw postErr;
    }
}

export function bucketGoalHasDeadline(goal: CofrinhoBucketGoal | null | undefined): boolean {
    return Boolean(cofrinhoGoalDeadlineFromGoal(goal));
}

export async function createCofrinhoApplication(body: {
    bucketId: string;
    amount: number;
    referenceMonth: string;
    accountId?: string | null;
}): Promise<CofrinhoApplication> {
    return apiFetch<CofrinhoApplication>('/api/cofrinho-applications', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}

export async function updateCofrinhoApplication(
    id: string,
    body: Partial<{
        bucketId: string;
        amount: number;
        accountId: string | null;
        status: string;
        referenceMonth: string;
        recordDate: string;
        description?: string;
    }>
): Promise<CofrinhoApplication> {
    return apiFetch<CofrinhoApplication>(`/api/cofrinho-applications/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}

export async function fetchPoolAvailable(yearMonth: string): Promise<number> {
    const r = await apiFetch<{ available: number }>(
        `/api/cofrinho-pool-available?yearMonth=${encodeURIComponent(yearMonth)}`
    );
    return Number(r.available) || 0;
}

export async function deleteCofrinhoApplication(id: string): Promise<void> {
    await apiFetch(`/api/cofrinho-applications/${id}`, { method: 'DELETE' });
}

export async function saveCofrinhoMonthlyBalanceBatch(body: {
    bucketId: string;
    referenceMonth: string;
    lines: { accountId: string; principalAmount: number; balanceWithYield: number }[];
}): Promise<{ lines: CofrinhoMonthlyBalance[] }> {
    return apiFetch<{ lines: CofrinhoMonthlyBalance[] }>('/api/cofrinho-monthly-balances/batch', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}

export async function deleteCofrinhoMonthlyBalanceMonth(
    bucketId: string,
    referenceMonth: string
): Promise<void> {
    const q = new URLSearchParams({ bucketId, referenceMonth });
    await apiFetch(`/api/cofrinho-monthly-balances/month?${q}`, { method: 'DELETE' });
}

export async function deleteCofrinhoMonthlyBalance(id: string): Promise<void> {
    await apiFetch(`/api/cofrinho-monthly-balances/${id}`, { method: 'DELETE' });
}