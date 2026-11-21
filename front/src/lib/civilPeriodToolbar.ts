export const CIVIL_PERIOD_TOOLBAR_ACCENTS = ['dashboard', 'zero-budget', 'expenses', 'gains', 'cofrinhos', 'wallet'] as const;

export type CivilPeriodToolbarAccent = (typeof CIVIL_PERIOD_TOOLBAR_ACCENTS)[number];

export const CIVIL_PERIOD_TIMELINE_SURFACED_CLASS = 'civil-period-timeline--surfaced';

export function civilPeriodTimelineAccentClass(accent: CivilPeriodToolbarAccent): string {
    return `civil-period-timeline--${accent}`;
}

/** Classes do timeline montado via `CivilPeriodToolbar` (acento + painel). */
export function civilPeriodTimelineToolbarClasses(accent: CivilPeriodToolbarAccent): string {
    return [civilPeriodTimelineAccentClass(accent), CIVIL_PERIOD_TIMELINE_SURFACED_CLASS].join(' ');
}

const DEFAULT_ARIA_LABEL: Record<CivilPeriodToolbarAccent, string> = {
    dashboard: 'Mês do painel',
    'zero-budget': 'Mês do planejamento',
    expenses: 'Mês das saídas',
    gains: 'Mês das entradas',
    cofrinhos: 'Mês de referência dos cofrinhos',
    wallet: 'Mês da carteira'
};

export function civilPeriodToolbarAriaLabel(
    accent: CivilPeriodToolbarAccent,
    override?: string
): string {
    return override ?? DEFAULT_ARIA_LABEL[accent];
}