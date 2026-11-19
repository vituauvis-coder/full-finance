export type SidebarLeaf = {
    to: string;
    page: string;
    icon: string;
    label: string;
    /** Só ativo na rota exata (ex.: atlas em /viagens). */
    end?: boolean;
};

export type SidebarGroupConfig = {
    id: 'dinheiro' | 'viagens';
    label: string;
    icon: string;
    items: readonly SidebarLeaf[];
};

export const SIDEBAR_DASHBOARD: SidebarLeaf = {
    to: '/dashboard',
    page: 'dashboard',
    icon: 'dashboard',
    label: 'Dashboard'
};

export const SIDEBAR_FERRAMENTAS: SidebarLeaf = {
    to: '/ferramentas',
    page: 'ferramentas',
    icon: 'handyman',
    label: 'Ferramentas'
};

export const SIDEBAR_GROUPS: readonly SidebarGroupConfig[] = [
    {
        id: 'dinheiro',
        label: 'Dinheiro',
        icon: 'payments',
        items: [
            { to: '/dinheiro/entradas', page: 'gains', icon: 'trending_up', label: 'Entradas' },
            { to: '/dinheiro/saidas', page: 'expenses', icon: 'trending_down', label: 'Saídas' },
            { to: '/dinheiro/planejamento', page: 'zero-budget', icon: 'track_changes', label: 'Planejamento' },
            { to: '/dinheiro/carteira', page: 'wallet', icon: 'account_balance_wallet', label: 'Carteira' },
            { to: '/dinheiro/cofrinhos', page: 'cofrinhos', icon: 'savings', label: 'Cofrinhos' },
            { to: '/dinheiro/dividas', page: 'debts', icon: 'warning', label: 'Dívidas' }
        ]
    },
    {
        id: 'viagens',
        label: 'Viagens',
        icon: 'flight',
        items: [
            { to: '/viagens', page: 'viagens', icon: 'map', label: 'Viagens', end: true },
            { to: '/viagens/milhas', page: 'viagens-milhas', icon: 'loyalty', label: 'Milhas' }
        ]
    }
] as const;

export function leafPageIds(group: SidebarGroupConfig): string[] {
    return group.items.map((i) => i.page);
}