/** Converte texto digitado (pt-BR ou 1234.56) em valor monetário não negativo. */
export function parseMoneyInput(raw) {
    const s = String(raw ?? '')
        .trim()
        .replace(/\s/g, '')
        .replace(/^R\$\s?/i, '');
    if (!s) return null;

    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    let normalized;
    if (hasComma) {
        normalized = s.replace(/\./g, '').replace(',', '.');
    } else if (hasDot) {
        const lastDot = s.lastIndexOf('.');
        const after = s.slice(lastDot + 1);
        const decimalCue = lastDot >= 0 && /^\d{1,2}$/.test(after);
        if (decimalCue) {
            const intPart = s.slice(0, lastDot).replace(/\./g, '');
            normalized = `${intPart || '0'}.${after}`;
        } else {
            normalized = s.replace(/\./g, '');
        }
    } else {
        normalized = s;
    }

    const n = parseFloat(normalized);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export function formatMoneyDraft(value) {
    if (!Number.isFinite(value)) return '';
    return value.toFixed(2).replace('.', ',');
}