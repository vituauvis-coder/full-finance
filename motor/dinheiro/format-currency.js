export function formatCurrency(amount, currency = 'BRL') {
    const n = Number(amount);
    const value = Number.isFinite(n) ? n : 0;
    try {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: String(currency || 'BRL') }).format(value);
    } catch {
        return `R$ ${value.toFixed(2)}`;
    }
}