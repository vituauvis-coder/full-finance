/** Paridade com `legacy-web/js/features/cofrinhos/constants.js`. */

export const EXPENSE_COFRINHO_CATEGORY = 'Cofrinhos';
export const COFRINHO_POOL_SUBCATEGORY = 'Pool';

export function isCofrinhoPoolSubcategoryName(subcategory: string | null | undefined): boolean {
    const s = String(subcategory ?? '').trim();
    return !s || s.toLowerCase() === COFRINHO_POOL_SUBCATEGORY.toLowerCase();
}

export const BUCKET_COLOR_KEYS = ['fuchsia', 'violet', 'emerald', 'cyan', 'amber', 'rose', 'indigo'] as const;

export type BucketColorKey = (typeof BUCKET_COLOR_KEYS)[number];

export const BUCKET_COLOR_LABELS: Record<BucketColorKey, string> = {
    fuchsia: 'Fúcsia',
    violet: 'Violeta',
    emerald: 'Esmeralda',
    cyan: 'Ciano',
    amber: 'Âmbar',
    rose: 'Rosa',
    indigo: 'Índigo'
};

const BUCKET_COLOR_HEX: Record<BucketColorKey, string> = {
    fuchsia: '#d946ef',
    violet: '#8b5cf6',
    emerald: '#10b981',
    cyan: '#06b6d4',
    amber: '#f59e0b',
    rose: '#f43f5e',
    indigo: '#6366f1'
};

export function bucketColorHex(colorKey: string | undefined): string {
    const key = String(colorKey ?? '').trim() as BucketColorKey;
    return BUCKET_COLOR_HEX[key] ?? BUCKET_COLOR_HEX.violet;
}