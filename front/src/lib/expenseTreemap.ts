import type { Movement } from './types/finance';
import { aggregateByCategory } from './treemapData';

/** Linhas elegíveis ao treemap no período já filtrado (exclui referenceOnly). */
export function buildExpenseTreemapBlocks(rows: Movement[]) {
    const eligible = rows.filter((t) => t && !t.referenceOnly && (Number(t.amount) || 0) > 0);
    return aggregateByCategory(eligible);
}