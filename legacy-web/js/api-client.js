/**
 * Cliente HTTP para a API local (sessão por cookie).
 * Em desenvolvimento (Vite), usar sempre URLs relativas (/api) para o proxy
 * encaminhar à API na mesma PORT que scripts/dev.mjs — evita VITE_API_URL fixo
 * em .env apontar para porta errada e parecer que "nada salva no banco".
 */
const base = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL || '';

function buildUrl(path) {
    if (path.startsWith('http')) return path;
    return `${base}${path}`;
}

export async function api(path, options = {}) {
    const { headers = {}, body, ...rest } = options;
    const isJson = body && typeof body === 'string' && !(body instanceof FormData);
    const res = await fetch(buildUrl(path), {
        credentials: 'include',
        headers: isJson ? { 'Content-Type': 'application/json', ...headers } : headers,
        body,
        ...rest
    });
    if (!res.ok) {
        let payload;
        try {
            payload = await res.json();
        } catch {
            payload = { error: res.statusText };
        }
        const err = new Error(payload.error || payload.message || 'Erro na requisição');
        err.code = payload.code;
        err.status = res.status;
        throw err;
    }
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type');
    if (ct && ct.includes('application/json')) return res.json();
    return res.text();
}

export async function apiUpload(formData) {
    const res = await fetch(buildUrl('/api/upload'), {
        method: 'POST',
        credentials: 'include',
        body: formData
    });
    if (!res.ok) {
        let payload;
        try {
            payload = await res.json();
        } catch {
            payload = { error: res.statusText };
        }
        const err = new Error(payload.error || 'Falha no upload');
        err.code = payload.code;
        throw err;
    }
    return res.json();
}
