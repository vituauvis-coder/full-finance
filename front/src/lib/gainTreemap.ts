import type { Movement } from './types/finance';
import { aggregateByCategory } from './treemapData';

export function gainCountsInTotals(t: Movement) {
    return Boolean(t && !t.referenceOnly);
}

export function gainTopLevelCategory(t: Movement) {
    const c = String(t.category ?? '').trim();
    return c || '—';
}

/** Linhas elegíveis ao treemap de entradas (sem referenceOnly, categoria top-level). */
export function prepareGainsForTreemap(rows: Movement[]) {
    return rows.filter(gainCountsInTotals).map((t) => ({
        ...t,
        category: gainTopLevelCategory(t),
        subcategory: (t.subcategory && String(t.subcategory).trim()) || 'Geral'
    }));
}

export function buildGainTreemapBlocks(rows: Movement[]) {
    return aggregateByCategory(prepareGainsForTreemap(rows));
}