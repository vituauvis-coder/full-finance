/** Paridade com `legacy-web/js/core/zero-budget-calculator.js` (cores dos blocos). */

export function getColorHex(colorClass: string | undefined): string {
    const colorMap: Record<string, string> = {
        'bg-rose-500': '#f43f5e',
        'bg-purple-500': '#a855f7',
        'bg-blue-500': '#3b82f6',
        'bg-cyan-500': '#06b6d4',
        'bg-emerald-500': '#10b981',
        'bg-amber-500': '#f2c94c',
        'bg-orange-500': '#f97316',
        'bg-fuchsia-500': '#d946ef',
        'bg-teal-500': '#14b8a6',
        'bg-red-500': '#ef4444',
        'bg-green-500': '#22c55e',
        'bg-indigo-500': '#6366f1',
        'bg-pink-500': '#ec4899',
        'bg-yellow-500': '#eab308',
        'bg-gray-500': '#6b7280'
    };
    return colorMap[String(colorClass || '').trim()] || '#f2c94c';
}

export const ZERO_BUDGET_COLORS = [
    { class: 'bg-rose-500', hex: '#f43f5e', label: 'Rosa' },
    { class: 'bg-purple-500', hex: '#a855f7', label: 'Roxo' },
    { class: 'bg-amber-500', hex: '#f2c94c', label: 'Âmbar' },
    { class: 'bg-yellow-500', hex: '#eab308', label: 'Amarelo' },
    { class: 'bg-blue-500', hex: '#3b82f6', label: 'Azul' },
    { class: 'bg-cyan-500', hex: '#06b6d4', label: 'Ciano' },
    { class: 'bg-teal-500', hex: '#14b8a6', label: 'Turquesa' },
    { class: 'bg-emerald-500', hex: '#10b981', label: 'Esmeralda' },
    { class: 'bg-orange-500', hex: '#f97316', label: 'Laranja' },
    { class: 'bg-red-500', hex: '#ef4444', label: 'Vermelho' },
    { class: 'bg-pink-500', hex: '#ec4899', label: 'Pink' },
    { class: 'bg-indigo-500', hex: '#6366f1', label: 'Índigo' },
    { class: 'bg-gray-500', hex: '#6b7280', label: 'Cinza' }
] as const;

const BAR_ALLOWED = new Set(ZERO_BUDGET_COLORS.map((c) => c.class));

export function zeroBudgetBarBgClass(cls: string | undefined): string {
    const s = String(cls || '').trim();
    return BAR_ALLOWED.has(s as (typeof ZERO_BUDGET_COLORS)[number]['class']) ? s : 'bg-amber-500';
}