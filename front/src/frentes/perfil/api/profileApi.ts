import { apiFetch } from '../../../lib/http';
import { fetchProfile as fetchProfileGet } from '../../../lib/profileHttp';
import type { ProfileUser } from '../types/profile';

export function fetchProfile(): Promise<ProfileUser> {
    return fetchProfileGet();
}

export type ProfilePatchBody = Partial<Pick<ProfileUser, 'name' | 'currency'>> & {
    profilePhotoURL?: string | null;
    financePreferences?: ProfileUser['financePreferences'];
};

export function patchProfile(body: ProfilePatchBody) {
    return apiFetch('/api/profile', { method: 'PATCH', body: JSON.stringify(body) });
}

/** Nova senha descartável — só para checar a atual sem alterar (API rejeita senha com menos de 6 chars). */
const PASSWORD_VERIFY_PROBE = 'x';

function isPasswordVerifyNotFound(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return msg === 'não encontrado' || msg.includes('not found');
}

/** Confirma a senha atual sem gravar uma nova (funciona mesmo sem `/password/verify` no servidor). */
export async function verifyCurrentPassword(currentPassword: string): Promise<{ ok: boolean }> {
    try {
        return await apiFetch<{ ok: boolean }>('/api/profile/password/verify', {
            method: 'POST',
            body: JSON.stringify({ currentPassword })
        });
    } catch (err) {
        if (!isPasswordVerifyNotFound(err)) throw err;
    }

    try {
        await changePassword({ currentPassword, newPassword: PASSWORD_VERIFY_PROBE });
        throw new Error('Não foi possível verificar a senha.');
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/incorreta|wrong-password|senha atual/i.test(msg)) {
            throw new Error('Senha atual incorreta.');
        }
        if (/fraca|weak|6 caracteres|mínimo/i.test(msg)) {
            return { ok: true };
        }
        throw err instanceof Error ? err : new Error(msg);
    }
}

export function changePassword(body: { currentPassword: string; newPassword: string }) {
    return apiFetch('/api/profile/password', { method: 'POST', body: JSON.stringify(body) });
}

export function postProfileBalance(balance: number) {
    return apiFetch<{ ok: boolean; balance: number }>('/api/profile/balance', {
        method: 'POST',
        body: JSON.stringify({ balance })
    });
}

export function deleteUserAccount() {
    return apiFetch('/api/user', { method: 'DELETE' });
}