/** Cores dos cards de dívida — paleta ampla e bem separada no círculo cromático. */

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
];

export const DEBT_COLOR_LABELS = {
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

export const DEBT_COLOR_HEX = {
    wine: '#9f1239',
    red: '#dc2626',
    rose: '#e11d48',
    orange: '#ea580c',
    amber: '#f59e0b',
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

export function debtColorHex(colorKey) {
    return DEBT_COLOR_HEX[colorKey] || DEBT_COLOR_HEX.wine;
}

/** Ordem estável dos cards: A→Z pelo nome da instituição (pt-BR). */
export function compareDebtsByCompany(a, b) {
    return String(a?.company ?? '').localeCompare(String(b?.company ?? ''), 'pt-BR', {
        sensitivity: 'base'
    });
}

export function sortDebtsByCompany(debts) {
    return [...(debts || [])].sort(compareDebtsByCompany);
}
