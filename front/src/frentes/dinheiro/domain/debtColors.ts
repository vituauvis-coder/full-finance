/** Paridade com `legacy-web/js/features/debts/constants.js`. */

export const DEBT_COLOR_KEYS = [
    'wine',
    'red',
    'rose',
    'orange',
    'amber',
    'gold',
    'lime',
    'emerald',
    'teal',
    'cyan',
    'sky',
    'blue',
    'indigo',
    'violet',
    'purple',
    'magenta',
    'fuchsia',
    'pink',
    'brown',
    'slate'
] as const;

export type DebtColorKey = (typeof DEBT_COLOR_KEYS)[number];

export const DEBT_COLOR_LABELS: Record<string, string> = {
    wine: 'Vinho',
    red: 'Vermelho',
    rose: 'Rosa',
    orange: 'Laranja',
    amber: 'Âmbar',
    gold: 'Dourado',
    lime: 'Lima',
    emerald: 'Esmeralda',
    teal: 'Turquesa',
    cyan: 'Ciano',
    sky: 'Azul claro',
    blue: 'Azul',
    indigo: 'Índigo',
    violet: 'Violeta',
    purple: 'Roxo',
    magenta: 'Magenta',
    fuchsia: 'Fúcsia',
    pink: 'Pink',
    brown: 'Marrom',
    slate: 'Grafite'
};

export const DEBT_COLOR_HEX: Record<string, string> = {
    wine: '#9f1239',
    red: '#dc2626',
    rose: '#e11d48',
    orange: '#ea580c',
    amber: '#f2c94c',
    gold: '#ca8a04',
    lime: '#65a30d',
    emerald: '#059669',
    teal: '#0d9488',
    cyan: '#0891b2',
    sky: '#0284c7',
    blue: '#2563eb',
    indigo: '#4f46e5',
    violet: '#7c3aed',
    purple: '#9333ea',
    magenta: '#c026d3',
    fuchsia: '#d946ef',
    pink: '#db2777',
    brown: '#78350f',
    slate: '#475569'
};

export function debtColorHex(colorKey?: string | null): string {
    return DEBT_COLOR_HEX[colorKey ?? ''] ?? DEBT_COLOR_HEX.wine;
}

export function compareDebtsByCompany(a: { company?: string }, b: { company?: string }): number {
    return String(a?.company ?? '').localeCompare(String(b?.company ?? ''), 'pt-BR', { sensitivity: 'base' });
}

export function sortDebtsByCompany<T extends { company?: string }>(debts: T[]): T[] {
    return [...debts].sort(compareDebtsByCompany);
}

/** Ativas primeiro (A–Z); quitadas no final (A–Z). */
export function sortDebtsForDisplay<T extends { company?: string; isClosed?: boolean }>(debts: T[]): T[] {
    const open = sortDebtsByCompany(debts.filter((d) => d.isClosed !== true));
    const closed = sortDebtsByCompany(debts.filter((d) => d.isClosed === true));
    return [...open, ...closed];
}