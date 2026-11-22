import { apiFetch } from '../../../lib/http';
import type { CofrinhoApplication, CofrinhoBucket, CofrinhoBucketGoal } from '../domain/cofrinhoAggregations';

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

export async function upsertBucketGoal(body: {
    bucketId: string;
    year: number;
    targetAmount: number;
    goalId?: string | null;
}): Promise<CofrinhoBucketGoal> {
    if (body.goalId) {
        return apiFetch<CofrinhoBucketGoal>(`/api/cofrinho-bucket-goals/${body.goalId}`, {
            method: 'PUT',
            body: JSON.stringify({ targetAmount: body.targetAmount, year: body.year })
        });
    }
    try {
        return await apiFetch<CofrinhoBucketGoal>('/api/cofrinho-bucket-goals', {
            method: 'POST',
            body: JSON.stringify({
                bucketId: body.bucketId,
                year: body.year,
                targetAmount: body.targetAmount
            })
        });
    } catch (e) {
        if (e instanceof Error && e.message.includes('409')) {
            throw e;
        }
        throw e;
    }
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