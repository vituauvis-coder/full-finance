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
        throw new Error(
            (typeof body.error === 'string' && body.error) ||
                (res.status === 404 ? 'Não encontrado' : res.statusText)
        );
    }
    return res.json();
}