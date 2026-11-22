/** Dev: `/api` via proxy. Prod: URL relativa na mesma origem; `VITE_API_URL` só se for outro host. */
function resolveApiBase(): string {
    if (import.meta.env.DEV) return '';
    const envUrl = String(import.meta.env.VITE_API_URL ?? '').trim();
    if (!envUrl) return '';
    if (typeof window === 'undefined') return envUrl.replace(/\/$/, '');
    try {
        const target = new URL(envUrl, window.location.href);
        if (target.origin === window.location.origin) return '';
        return envUrl.replace(/\/$/, '');
    } catch {
        return '';
    }
}

const API = resolveApiBase();

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
        throw new Error(
            (typeof body.error === 'string' && body.error) ||
                (res.status === 404 ? 'Não encontrado' : res.statusText)
        );
    }
    return res.json();
}