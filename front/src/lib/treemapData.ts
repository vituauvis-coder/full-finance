import type { Movement } from './types/finance';

/** Quantas categorias próprias no mapa antes de agrupar o resto em «Demais». */
export const TREEMAP_MAX_BLOCKS = 7;
/** Abaixo disso (% do período), vai para «Demais categorias» (tile legível). */
export const TREEMAP_MIN_TILE_PCT = 0.04;
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

export type TreemapCapResult = { blocks: CategoryBlock[]; mergedCount: number };

export function capTreemapBlocks(sorted: CategoryBlock[]): TreemapCapResult {
    const positive = sorted.filter((c) => c.total > 0);
    const total = positive.reduce((s, c) => s + c.total, 0);
    if (total <= 0) return { blocks: [], mergedCount: 0 };

    const head: CategoryBlock[] = [];
    const tail: CategoryBlock[] = [];

    for (const c of positive) {
        const pct = c.total / total;
        const slotLeft = head.length < TREEMAP_MAX_BLOCKS - 1;
        if (slotLeft && pct >= TREEMAP_MIN_TILE_PCT) {
            head.push(c);
        } else {
            tail.push(c);
        }
    }

    while (head.length > TREEMAP_MAX_BLOCKS - 1) {
        tail.unshift(head.pop()!);
    }

    if (tail.length === 0) {
        return { blocks: head, mergedCount: 0 };
    }

    const demaisTotal = tail.reduce((s, c) => s + c.total, 0);
    const subcategories = tail
        .map((c) => ({ name: c.name, total: c.total }))
        .sort((a, b) => b.total - a.total);

    return {
        blocks: [...head, { name: TREEMAP_DEMAIS, total: demaisTotal, subcategories }],
        mergedCount: tail.length
    };
}

/** Cofrinhos — mantém caixinhas zeradas; não agrupar em «Demais» até 12 blocos. */
export function capCofrinhoTreemapBlocks(sorted: CategoryBlock[]): TreemapCapResult {
    const blocks = [...sorted];
    const positiveCount = blocks.filter((c) => c.total > 0).length;
    if (blocks.length <= 12 || positiveCount <= 12) {
        return { blocks, mergedCount: 0 };
    }
    const positive = blocks.filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
    return capTreemapBlocks(positive);
}

/** Pesos de layout — fatia mínima para tiles pequenos continuarem legíveis (valores reais ficam nos blocos). */
export function treemapLayoutWeights(totals: number[], minShare = 0.11): number[] {
    const sum = totals.reduce((s, v) => s + v, 0);
    const n = totals.length;
    if (sum <= 0 || n <= 1) return totals;
    const effectiveMin =
        n <= 4 ? Math.max(minShare, 0.82 / n) : n <= 6 ? Math.max(minShare, 0.55 / n) : minShare;
    const floor = sum * effectiveMin;
    const boosted = totals.map((v) => Math.max(v, floor));
    const boostedSum = boosted.reduce((s, v) => s + v, 0);
    return boosted.map((v) => (v / boostedSum) * sum);
}

/** Tons turquesa — paridade com `--gains-accent` / `--dash-v-turquesa` (família única, tiles distintos). */
export const INCOME_TREEMAP_PALETTE = [
    '#2ec4b6',
    '#1a8f85',
    '#14b8a6',
    '#0d9488',
    '#0f766e',
    '#115e59',
    '#134e4a',
    '#16796f',
    '#1e9a8f',
    '#26a69a',
    '#00897b',
    '#00796b',
    '#00695c',
    '#0d5c56'
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