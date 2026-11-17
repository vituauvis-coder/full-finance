import { apiFetch } from './http';
import type { ProfileUser } from './types/profile';

export function fetchProfile(): Promise<ProfileUser> {
    return apiFetch('/api/profile');
}