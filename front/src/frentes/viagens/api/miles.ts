import { apiFetch } from '../../../lib/http';

function asMilesError(e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (!msg || msg === 'Not Found' || msg === 'Não encontrado' || /not found/i.test(msg)) {
        return 'A Central de pontos não respondeu. Atualize a página.';
    }
    return msg;
}

async function milesFetch<T>(path: string, init?: RequestInit): Promise<T> {
    try {
        return (await apiFetch(path, init)) as T;
    } catch (e) {
        throw new Error(asMilesError(e));
    }
}

export const WALLET_CHANGED = 'viagens-wallet-changed';

export function notifyWalletChanged() {
    window.dispatchEvent(new Event(WALLET_CHANGED));
}

export function fetchMilesPrograms() {
    return milesFetch<{
        programs: Array<{
            id: string;
            name: string;
            brand: string;
            issuer: string;
            unit: string;
            notes: string;
            expiresOn: string | null;
            balance: number;
            milheiro: string;
            transferBonusPercent?: number;
            clubActive?: boolean;
            clubFeeBrl?: string;
            clubStartedOn?: string | null;
            clubPointsPerMonth?: number;
            buyMilheiro?: string;
        }>;
        presets: Array<{ brand: string; name: string; issuer: string; unit: string }>;
        rates: Array<{
            fromProgramId: string;
            toProgramId: string;
            conversionFrom: number;
            conversionTo: number;
            bonusPercent: number;
        }>;
    }>('/api/miles/programs');
}

export function createMilesProgram(body: Record<string, unknown>) {
    return milesFetch('/api/miles/programs', { method: 'POST', body: JSON.stringify(body) });
}

export function patchMilesProgram(id: string, body: Record<string, unknown>) {
    return milesFetch(`/api/miles/programs/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function fetchMilesDashboard(tripId?: string) {
    const q = tripId ? `?tripId=${encodeURIComponent(tripId)}` : '';
    return milesFetch(`/api/miles/dashboard${q}`);
}

export function fetchMilesMovements(programId?: string) {
    const q = programId ? `?programId=${encodeURIComponent(programId)}` : '';
    return milesFetch(`/api/miles/movements${q}`);
}

export function postMilesMovement(body: Record<string, unknown>) {
    return milesFetch('/api/miles/movements', { method: 'POST', body: JSON.stringify(body) });
}

export function deleteMilesMovement(id: string) {
    return milesFetch(`/api/miles/movements/${id}`, { method: 'DELETE' });
}

export function setMilesBalance(programId: string, balance: number) {
    return milesFetch(`/api/miles/programs/${programId}/set-balance`, {
        method: 'POST',
        body: JSON.stringify({ balance })
    });
}

export function fetchEmissions(tripId: string) {
    return milesFetch(`/api/miles/emissions?tripId=${encodeURIComponent(tripId)}`);
}

export function fetchEmission(id: string) {
    return milesFetch(`/api/miles/emissions/${id}`);
}

export function createEmission(body: Record<string, unknown>) {
    return milesFetch('/api/miles/emissions', { method: 'POST', body: JSON.stringify(body) });
}

export function patchEmission(id: string, body: Record<string, unknown>) {
    return milesFetch(`/api/miles/emissions/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function reserveEmission(id: string) {
    return milesFetch(`/api/miles/emissions/${id}/reserve`, { method: 'POST', body: '{}' });
}

export function emitEmission(id: string) {
    return milesFetch(`/api/miles/emissions/${id}/emit`, { method: 'POST', body: '{}' });
}
