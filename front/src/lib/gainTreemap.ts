import { gainTopLevelCategory as gainTopLevelCategoryMotor, prepareGainsForTreemap as prepareGainsForTreemapMotor } from '@motor/dinheiro/gain-treemap.js';
import type { Movement } from './types/finance';
import { aggregateByCategory } from './treemapData';

/** Legado / APIs que ainda distinguem pré-âncora; listas e gráficos somam todas as linhas visíveis. */
export function gainCountsInTotals(t: Movement) {
    return Boolean(t && !t.referenceOnly);
}

export function gainTopLevelCategory(t: Movement) {
    return gainTopLevelCategoryMotor(t);
}

/** Treemap Entradas: mesma base do extrato visível (inclui referenceOnly se estiver na lista). */
export function prepareGainsForTreemap(rows: Movement[]) {
    return prepareGainsForTreemapMotor(rows) as Movement[];
}

export function buildGainTreemapBlocks(rows: Movement[]) {
    return aggregateByCategory(prepareGainsForTreemap(rows));
}