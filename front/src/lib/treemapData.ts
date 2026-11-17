import type { Movement } from './types/finance';

export const TREEMAP_MAX_BLOCKS = 16;
export const TREEMAP_DEMAIS = 'Demais categorias';

export type CategoryBlock = {
    name: string;
    total: number;
    subcategories: { name: string; total: number }[];
};

export function aggregateByCategory(rows: Movement[]): CategoryBlock[] {
    const totals = new Map<string, number>();
    const subs = new Map<string, Map<string, number>>();

    for (const t of rows) {
        const amt = Number(t.amount) || 0;
        if (amt <= 0) continue;
        const cat = (t.category && String(t.category).trim()) || 'Sem categoria';
        const sub = (t.subcategory && String(t.subcategory).trim()) || 'Geral';
        totals.set(cat, (totals.get(cat) ?? 0) + amt);
        if (!subs.has(cat)) subs.set(cat, new Map());
        const sm = subs.get(cat)!;
        sm.set(sub, (sm.get(sub) ?? 0) + amt);
    }

    return [...totals.entries()]
        .map(([name, total]) => ({
            name,
            total,
            subcategories: [...(subs.get(name)?.entries() ?? [])]
                .map(([n, v]) => ({ name: n, total: v }))
                .sort((a, b) => b.total - a.total)
        }))
        .sort((a, b) => b.total - a.total);
}

export function capTreemapBlocks(sorted: CategoryBlock[]) {
    if (sorted.length <= TREEMAP_MAX_BLOCKS) return { blocks: sorted, mergedCount: 0 };
    const head = sorted.slice(0, TREEMAP_MAX_BLOCKS - 1);
    const tail = sorted.slice(TREEMAP_MAX_BLOCKS - 1);
    const demaisTotal = tail.reduce((s, c) => s + c.total, 0);
    const subcategories = tail
        .map((c) => ({ name: c.name, total: c.total }))
        .sort((a, b) => b.total - a.total);
    return {
        blocks: [...head, { name: TREEMAP_DEMAIS, total: demaisTotal, subcategories }],
        mergedCount: tail.length
    };
}

export const INCOME_TREEMAP_PALETTE = [
    '#22c55e',
    '#10b981',
    '#059669',
    '#0d9488',
    '#14b8a6',
    '#16a34a',
    '#15803d',
    '#166534',
    '#047857',
    '#065f46',
    '#0f766e',
    '#115e59',
    '#65a30d',
    '#4d7c0f'
];

export const EXPENSE_TREEMAP_PALETTE = [
    '#3b82f6',
    '#10b981',
    '#f43f5e',
    '#f59e0b',
    '#06b6d4',
    '#64748b',
    '#ec4899',
    '#0ea5e9',
    '#14b8a6',
    '#f97316',
    '#84cc16',
    '#ef4444',
    '#78716c',
    '#2563eb'
];