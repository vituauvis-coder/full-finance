/** Converte texto digitado (pt-BR) em valor monetário não negativo. */
export function parseMoneyInput(raw: string): number | null {
    const t = raw.trim().replace(/\./g, '').replace(',', '.');
    const n = parseFloat(t);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}