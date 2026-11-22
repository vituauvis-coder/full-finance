export function formatBRL(value: number, currency = 'BRL') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
}

/** Rótulos do eixo Y em gráficos — evita cortar valores longos. */
export function formatBRLChartAxis(value: number, currency = 'BRL') {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    const abs = Math.abs(n);
    if (abs >= 1_000_000) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency,
            notation: 'compact',
            maximumFractionDigits: 1
        }).format(n);
    }
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: abs >= 1_000 ? 0 : 2
    }).format(n);
}