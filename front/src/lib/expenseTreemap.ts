import { prepareExpenseRowsForTreemap } from '@motor/dinheiro/expense-treemap.js';
import type { Account, Movement } from './types/finance';
import { aggregateByCategory } from './treemapData';

/** Linhas elegíveis ao treemap no período já filtrado (inclui referenceOnly; valor = parcela). */
export function buildExpenseTreemapBlocks(rows: Movement[], accounts: Account[] = []) {
    return aggregateByCategory(prepareExpenseRowsForTreemap(rows, accounts) as Movement[]);
}
