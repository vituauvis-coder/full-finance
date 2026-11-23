/**
 * Prepara linhas já filtradas pelo período da lista de Entradas para o mapa (treemap).
 * Inclui `referenceOnly` (pré-âncora) — mesma base dos cards e da lista.
 */
export function gainTopLevelCategory(t) {
    const c = String(t?.category ?? '').trim();
    return c || '—';
}

export function prepareGainsForTreemap(rows) {
    return (rows ?? []).map((t) => ({
        ...t,
        category: gainTopLevelCategory(t),
        subcategory: (t.subcategory && String(t.subcategory).trim()) || 'Geral'
    }));
}