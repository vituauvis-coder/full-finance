import type { ProfileUser } from './types/profile';

export const PROFILE_UPDATED_EVENT = 'profile-updated';

export function notifyProfileUpdated(profile?: ProfileUser | null) {
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: profile ?? null }));
}