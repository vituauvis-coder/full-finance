/** Dev: sempre `/api` via proxy do Vite (cookie na mesma origem). Prod: `VITE_API_URL` opcional. */
const API = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');

export async function apiFetch(path: string, init?: RequestInit) {
    const res = await fetch(`${API}${path}`, {
        ...init,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers ?? {})
        }
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
    }
    return res.json();
}