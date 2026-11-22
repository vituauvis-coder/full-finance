import type { CategoryBlock } from '../../../lib/treemapData';
import { capCofrinhoTreemapBlocks } from '../../../lib/treemapData';
import type { Movement } from '../../../lib/types/finance';
import { movementDate } from '../../../lib/period';
import {
    type CofrinhoApplication,
    type CofrinhoBucket,
    sumAllocatedByBucket
} from './cofrinhoAggregations';
import { EXPENSE_COFRINHO_CATEGORY } from './cofrinhoConstants';
import { toYearMonthKey } from './cofrinhoPeriod';
import {
    applicationMatchesCofrinhoScope,
    type CofrinhoPeriodScope,
    resolveCofrinhoPeriodScope
} from './cofrinhoPeriodScope';

/**
 * Roxo pastel escuro — família do `--cofrinhos-accent`, matizes distintos (índigo → violeta → ameixa).
 */
export const COFRINHO_TREEMAP_PALETTE = [
    '#5f548f',
    '#6e5ca8',
    '#7a63b2',
    '#574b85',
    '#8a6fbf',
    '#6a5f9c',
    '#7364ab',
    '#65599a',
    '#9178c4',
    '#5a4f82',
    '#7d6aad',
    '#62548f',
    '#846cb5'
];

/** Separa matizes quando há poucas caixinhas (evita 3 roxos quase iguais). */
const COFRINHO_PALETTE_SLOTS = [0, 4, 8, 2, 6, 10, 1, 5, 9, 3, 7, 11, 12];

function mixHexWithWhite(hex: string, whiteMix: number): string {
    const h = hex.replace('#', '');
    if (h.length !== 6) return hex;
    const parse = (start: number) => parseInt(h.slice(start, start + 2), 16);
    const mix = (c: number) => Math.round(c + (255 - c) * whiteMix);
    return `rgb(${mix(parse(0))}, ${mix(parse(2))}, ${mix(parse(4))})`;
}

/** Roxo pastel para barras do gráfico anual (matizes distintos, família cofrinhos). */
export function cofrinhoChartBarColor(bucketIndex: number): string {
    const slot = COFRINHO_PALETTE_SLOTS[bucketIndex % COFRINHO_PALETTE_SLOTS.length];
    const base = COFRINHO_TREEMAP_PALETTE[slot % COFRINHO_TREEMAP_PALETTE.length];
    return mixHexWithWhite(base, 0.4);
}

export const COFRINHO_CHART_LINE_PURPLE = '#5b21b6';

export const COFRINHO_CHART_BAR_STROKE = 'var(--cofrinhos-chart-bar-stroke, rgba(255, 255, 255, 0.42))';

const bucketName = (b: CofrinhoBucket) => String(b.name ?? '').trim() || 'Caixinha';

function expenseMatchesScope(ym: string, scope: CofrinhoPeriodScope): boolean {
    if (!ym) return false;
    if (scope.kind === 'all-years') return true;
    if (scope.kind === 'civil-year') return ym.startsWith(`${scope.year}-`);
    return ym === scope.yearMonth;
}

function expensesForBucketInScope(
    bucket: CofrinhoBucket,
    expenses: Movement[],
    scope: CofrinhoPeriodScope
): number {
    const sub = bucketName(bucket);
    return (expenses ?? [])
        .filter((e) => {
            if (String(e.category ?? '').trim() !== EXPENSE_COFRINHO_CATEGORY) return false;
            if (String(e.subcategory ?? '').trim() !== sub) return false;
            if (e.isPaid === false) return false;
            const ym = toYearMonthKey(
                typeof e.date === 'string' ? e.date : movementDate(e).toISOString()
            );
            return expenseMatchesScope(ym, scope);
        })
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);
}

function bucketAllocatedInScope(
    bucketId: string,
    applications: CofrinhoApplication[],
    scope: CofrinhoPeriodScope
): number {
    return (applications ?? [])
        .filter(
            (a) =>
                String(a.bucketId ?? '') === bucketId && applicationMatchesCofrinhoScope(a, scope)
        )
        .reduce((s, a) => s + (Number(a.amount) || 0), 0);
}

/**
 * Valor no mapa: aportes/despesas no recorte; em ano/todos, se vazio no recorte,
 * mostra o saldo atual da caixinha para manter todas visíveis.
 */
function bucketTreemapTotal(
    bucket: CofrinhoBucket,
    allBuckets: CofrinhoBucket[],
    applications: CofrinhoApplication[],
    expenses: Movement[],
    scope: CofrinhoPeriodScope
): number {
    const fromApps = bucketAllocatedInScope(bucket.id, applications, scope);
    const fromExpenses = expensesForBucketInScope(bucket, expenses, scope);
    const scoped = fromApps + fromExpenses;
    if (scoped > 0) return scoped;
    if (scope.kind === 'month') return 0;
    return sumAllocatedByBucket(expenses, bucket, applications, allBuckets);
}

/** Todas as caixinhas — inclusive zeradas no mês sem movimento. */
export function buildCofrinhoTreemapBlocks(
    buckets: CofrinhoBucket[],
    applications: CofrinhoApplication[],
    expenses: Movement[],
    period: string,
    year: number
): CategoryBlock[] {
    const scope = resolveCofrinhoPeriodScope(period, year);
    const sorted = [...(buckets ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const subLabel = scope.kind === 'month' ? 'Aporte' : 'Saldo';
    const blocks: CategoryBlock[] = sorted.map((bucket) => {
        const total = bucketTreemapTotal(bucket, sorted, applications, expenses, scope);
        return {
            name: bucketName(bucket),
            total,
            subcategories: [{ name: subLabel, total }]
        };
    });

    blocks.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    return capCofrinhoTreemapBlocks(blocks).blocks;
}

/** Tiles do mapa — violeta claro; zeradas em lavanda mais clara (sem transparência). */
export function paletteForCofrinhoTreemap(blocks: CategoryBlock[], buckets: CofrinhoBucket[]): string[] {
    const sorted = [...(buckets ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const orderIndex = new Map(sorted.map((b, i) => [bucketName(b), i]));
    return blocks.map((block, index) => {
        const slot = orderIndex.get(block.name) ?? index;
        const paletteIndex = COFRINHO_PALETTE_SLOTS[slot % COFRINHO_PALETTE_SLOTS.length];
        const base = COFRINHO_TREEMAP_PALETTE[paletteIndex % COFRINHO_TREEMAP_PALETTE.length];
        if (block.total > 0) return base;
        return mixHexWithWhite(base, 0.28);
    });
}