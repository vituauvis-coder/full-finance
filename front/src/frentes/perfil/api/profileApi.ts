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