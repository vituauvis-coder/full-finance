const RECIFE_OFFSET = '-03:00';

/**
 * Data do cliente: `{ seconds }` (legado), ISO string ou `YYYY-MM-DD` (meio-dia America/Recife).
 * @returns {string} ISO 8601
 */
export function parseClientDate(body) {
    if (body?.date && typeof body.date === 'object' && body.date.seconds != null) {
        return new Date(body.date.seconds * 1000).toISOString();
    }
    if (body?.date && typeof body.date === 'string') {
        const s = body.date.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            return `${s}T12:00:00${RECIFE_OFFSET}`;
        }
        return s;
    }
    return new Date().toISOString();
}