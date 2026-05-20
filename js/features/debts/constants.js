/** Cores dos cards de dívida (compartilha paleta com cofrinhos + vinho padrão). */

export const DEBT_COLOR_KEYS = ['wine', 'rose', 'amber', 'violet', 'fuchsia', 'cyan', 'emerald', 'indigo'];

export const DEBT_COLOR_LABELS = {
    wine: 'Vinho',
    rose: 'Rosa',
    amber: 'Âmbar',
    violet: 'Violeta',
    fuchsia: 'Fúcsia',
    cyan: 'Ciano',
    emerald: 'Esmeralda',
    indigo: 'Índigo'
};

export const DEBT_COLOR_HEX = {
    wine: '#9f1239',
    rose: '#f43f5e',
    amber: '#f59e0b',
    violet: '#8b5cf6',
    fuchsia: '#d946ef',
    cyan: '#06b6d4',
    emerald: '#10b981',
    indigo: '#6366f1'
};

export function debtColorHex(colorKey) {
    return DEBT_COLOR_HEX[colorKey] || DEBT_COLOR_HEX.wine;
}
