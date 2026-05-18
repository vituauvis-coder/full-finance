/** Categoria de saída que alimenta o saldo pendente de cofrinhos. */
export const EXPENSE_COFRINHO_CATEGORY = 'Cofrinhos';

export const GOAL_STATUS_OPTIONS = [
    'Em andamento',
    'Concluído',
    'Superado',
    'Pendente'
];

export const BUCKET_COLOR_KEYS = ['fuchsia', 'violet', 'emerald', 'cyan', 'amber', 'rose', 'indigo'];

export const BUCKET_COLOR_LABELS = {
    fuchsia: 'Fúcsia',
    violet: 'Violeta',
    emerald: 'Esmeralda',
    cyan: 'Ciano',
    amber: 'Âmbar',
    rose: 'Rosa',
    indigo: 'Índigo'
};

export const BUCKET_COLOR_HEX = {
    fuchsia: '#d946ef',
    violet: '#8b5cf6',
    emerald: '#10b981',
    cyan: '#06b6d4',
    amber: '#f59e0b',
    rose: '#f43f5e',
    indigo: '#6366f1'
};

export function bucketColorHex(colorKey) {
    return BUCKET_COLOR_HEX[colorKey] || BUCKET_COLOR_HEX.violet;
}

export const BUCKET_ICON_OPTIONS = [
    'fa-bullseye',
    'fa-chart-line',
    'fa-shield-halved',
    'fa-coins',
    'fa-piggy-bank',
    'fa-gem',
    'fa-rocket'
];
