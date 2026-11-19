export type LegacyPageId =
    | 'dashboard'
    | 'gains'
    | 'expenses'
    | 'zero-budget'
    | 'wallet'
    | 'cofrinhos'
    | 'debts'
    | 'viagens'
    | 'viagens-milhas'
    | 'tools'
    | 'profile';

export function legacyPageIdFromPath(pathname: string): LegacyPageId | null {
    if (pathname.startsWith('/perfil')) return 'profile';
    if (pathname.startsWith('/dashboard')) return 'dashboard';
    if (pathname.startsWith('/viagens/milhas')) return 'viagens-milhas';
    if (pathname.startsWith('/viagens')) return 'viagens';
    if (pathname.startsWith('/ferramentas')) return 'tools';
    if (pathname.startsWith('/dinheiro/entradas')) return 'gains';
    if (pathname.startsWith('/dinheiro/saidas')) return 'expenses';
    if (pathname.startsWith('/dinheiro/planejamento')) return 'zero-budget';
    if (pathname.startsWith('/dinheiro/carteira')) return 'wallet';
    if (pathname.startsWith('/dinheiro/cofrinhos')) return 'cofrinhos';
    if (pathname.startsWith('/dinheiro/dividas')) return 'debts';
    return null;
}

export const LEGACY_PAGE_HEADERS: Record<
    LegacyPageId,
    { icon: string; materialIcon?: string; title: string; headerClass?: string }
> = {
    dashboard: { icon: 'fa-chart-pie', materialIcon: 'space_dashboard', title: 'Dashboard' },
    gains: { icon: 'fa-arrow-up', title: 'Entradas', headerClass: 'app-header--gains' },
    expenses: { icon: 'fa-arrow-down', title: 'Saídas', headerClass: 'app-header--expenses' },
    'zero-budget': { icon: 'fa-bullseye', title: 'Planejamento', headerClass: 'app-header--zero-budget' },
    wallet: { icon: 'fa-wallet', title: 'Carteira', headerClass: 'app-header--wallet' },
    cofrinhos: { icon: 'fa-piggy-bank', title: 'Cofrinhos', headerClass: 'app-header--cofrinhos' },
    debts: { icon: 'fa-triangle-exclamation', title: 'Dívidas', headerClass: 'app-header--debts' },
    viagens: { icon: 'fa-map', materialIcon: 'flight', title: 'Viagens', headerClass: 'app-header--viagens' },
    'viagens-milhas': { icon: 'fa-map', materialIcon: 'loyalty', title: 'Milhas', headerClass: 'app-header--viagens' },
    tools: { icon: 'fa-tools', title: 'Ferramentas' },
    profile: { icon: 'fa-user', materialIcon: 'person', title: 'Meu Perfil' }
};