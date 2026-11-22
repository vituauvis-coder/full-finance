/** Paridade com `legacy-web/js/features/cofrinhos/constants.js`. */

export const EXPENSE_COFRINHO_CATEGORY = 'Cofrinhos';
export const COFRINHO_POOL_SUBCATEGORY = 'Pool';

export function isCofrinhoPoolSubcategoryName(subcategory: string | null | undefined): boolean {
    const s = String(subcategory ?? '').trim();
    return !s || s.toLowerCase() === COFRINHO_POOL_SUBCATEGORY.toLowerCase();
}

export const BUCKET_COLOR_KEYS = [
    'fuchsia',
    'violet',
    'purple',
    'indigo',
    'blue',
    'sky',
    'cyan',
    'teal',
    'emerald',
    'lime',
    'amber',
    'orange',
    'rose',
    'pink',
    'red',
    'slate'
] as const;

export type BucketColorKey = (typeof BUCKET_COLOR_KEYS)[number];

export const BUCKET_COLOR_LABELS: Record<BucketColorKey, string> = {
    fuchsia: 'Fúcsia',
    violet: 'Violeta',
    purple: 'Roxo',
    indigo: 'Índigo',
    blue: 'Azul',
    sky: 'Céu',
    cyan: 'Ciano',
    teal: 'Turquesa',
    emerald: 'Esmeralda',
    lime: 'Lima',
    amber: 'Âmbar',
    orange: 'Laranja',
    rose: 'Rosa',
    pink: 'Pink',
    red: 'Vermelho',
    slate: 'Grafite'
};

const BUCKET_COLOR_HEX: Record<BucketColorKey, string> = {
    fuchsia: '#d946ef',
    violet: '#8b5cf6',
    purple: '#a855f7',
    indigo: '#6366f1',
    blue: '#3b82f6',
    sky: '#0ea5e9',
    cyan: '#06b6d4',
    teal: '#14b8a6',
    emerald: '#10b981',
    lime: '#84cc16',
    amber: '#f2c94c',
    orange: '#f97316',
    rose: '#f43f5e',
    pink: '#ec4899',
    red: '#ef4444',
    slate: '#64748b'
};

export const BUCKET_CUSTOM_COLOR_PREFIX = 'custom:';

const HEX_6 = /^#([0-9a-f]{6})$/i;

export function normalizeBucketHex(input: string | undefined): string | null {
    const s = String(input ?? '').trim();
    if (HEX_6.test(s)) return s.toLowerCase();
    return null;
}

export function parseCustomBucketHex(colorKey: string | undefined): string | null {
    const raw = String(colorKey ?? '').trim();
    const direct = normalizeBucketHex(raw);
    if (direct) return direct;
    if (raw.startsWith(BUCKET_CUSTOM_COLOR_PREFIX)) {
        return normalizeBucketHex(raw.slice(BUCKET_CUSTOM_COLOR_PREFIX.length));
    }
    return null;
}

export function encodeCustomBucketColor(hex: string): string {
    const n = normalizeBucketHex(hex) ?? '#8b5cf6';
    return `${BUCKET_CUSTOM_COLOR_PREFIX}${n}`;
}

export function isPresetBucketColorKey(colorKey: string | undefined): colorKey is BucketColorKey {
    const k = String(colorKey ?? '').trim();
    return (BUCKET_COLOR_KEYS as readonly string[]).includes(k);
}

export function bucketColorHex(colorKey: string | undefined): string {
    const custom = parseCustomBucketHex(colorKey);
    if (custom) return custom;
    const key = String(colorKey ?? '').trim() as BucketColorKey;
    return BUCKET_COLOR_HEX[key] ?? BUCKET_COLOR_HEX.violet;
}

function mixHexWithWhite(hex: string, whiteMix: number): string {
    const h = hex.replace('#', '');
    if (h.length !== 6) return hex;
    const parse = (start: number) => parseInt(h.slice(start, start + 2), 16);
    const mix = (c: number) => Math.round(c + (255 - c) * whiteMix);
    return `rgb(${mix(parse(0))}, ${mix(parse(2))}, ${mix(parse(4))})`;
}

/** Pastel uniforme (legado do gráfico). */
export function bucketChartBarPastel(colorKey: string | undefined, whiteMix = 0.38): string {
    return mixHexWithWhite(bucketColorHex(colorKey), whiteMix);
}

/** Gradiente vertical das barras — topo mais claro, base na cor da caixinha. */
export function bucketChartBarGradient(colorKey: string | undefined): { top: string; bottom: string } {
    const base = bucketColorHex(colorKey);
    return {
        top: mixHexWithWhite(base, 0.42),
        bottom: mixHexWithWhite(base, 0.08)
    };
}