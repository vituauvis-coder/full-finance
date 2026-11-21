export type SidebarLeaf = {
    to: string;
    page: string;
    icon: string;
    label: string;
    /** Só ativo na rota exata. */
    end?: boolean;
    /** Ativo só com `?modulo=` na ficha da viagem (orçamento, roteiros, hospedagens). */
    modulo?: string;
};

export type SidebarGroupConfig = {
    id: 'financas' | 'viagens';
    label: string;
    icon: string;
    /** Página que abre ao clicar no nome do grupo. */
    to: string;
    pages: readonly string[];
    items: readonly SidebarLeaf[];
};

export const SIDEBAR_FERRAMENTAS: SidebarLeaf = {
    to: '/ferramentas',
    page: 'ferramentas',
    icon: 'handyman',
    label: 'Ferramentas'
};

const FINANCAS_ITEMS: readonly SidebarLeaf[] = [
    { to: '/dashboard', page: 'dashboard', icon: 'pie_chart', label: 'Dashboard', end: true },
    { to: '/dinheiro/entradas', page: 'gains', icon: 'trending_up', label: 'Entradas' },
    { to: '/dinheiro/saidas', page: 'expenses', icon: 'trending_down', label: 'Saídas' },
    { to: '/dinheiro/planejamento', page: 'zero-budget', icon: 'track_changes', label: 'Planejamento' },
    { to: '/dinheiro/carteira', page: 'wallet', icon: 'account_balance_wallet', label: 'Carteira' },
    { to: '/dinheiro/cofrinhos', page: 'cofrinhos', icon: 'savings', label: 'Cofrinhos' },
    { to: '/dinheiro/dividas', page: 'debts', icon: 'warning', label: 'Dívidas' }
];

const VIAGENS_MODULOS = [
    { modulo: 'orcamento', label: 'Orçamento', icon: 'account_balance_wallet' },
    { modulo: 'voos', label: 'Voos', icon: 'flight' },
    { modulo: 'roteiros', label: 'Roteiros', icon: 'map' },
    { modulo: 'hospedagens', label: 'Hospedagens', icon: 'apartment' }
] as const;

const LAST_TRIP_KEY = 'meu-mundo:last-trip-id';

export const SIDEBAR_GROUPS: readonly SidebarGroupConfig[] = [
    {
        id: 'financas',
        label: 'Finanças',
        icon: 'payments',
        to: '/dashboard',
        pages: ['dashboard', ...FINANCAS_ITEMS.map((item) => item.page)],
        items: FINANCAS_ITEMS
    },
    {
        id: 'viagens',
        label: 'Viagens',
        icon: 'flight',
        to: '/viagens',
        pages: ['viagens', 'viagens-milhas'],
        items: []
    }
];

export function tripIdFromPathname(pathname: string): string | null {
    const match = pathname.match(/^\/viagens\/([^/]+)/);
    if (!match) return null;
    if (match[1] === 'milhas' || match[1] === 'nova') return null;
    return match[1];
}

export function rememberLastTripId(tripId: string): void {
    try {
        localStorage.setItem(LAST_TRIP_KEY, tripId);
    } catch {
        /* storage indisponível */
    }
}

export function readLastTripId(): string | null {
    try {
        return localStorage.getItem(LAST_TRIP_KEY);
    } catch {
        return null;
    }
}

/** Submenus da viagem: módulos da ficha. Sem viagem aberta, caem na página Viagens. */
export function viagensModuleItems(tripId: string | null): SidebarLeaf[] {
    const base = tripId ? `/viagens/${tripId}` : null;
    return VIAGENS_MODULOS.map((modulo) => {
        if (!base) {
            return {
                to: '/viagens',
                page: 'viagens',
                icon: modulo.icon,
                label: modulo.label,
                end: true,
                modulo: modulo.modulo
            };
        }
        if (modulo.modulo === 'voos') {
            return {
                to: `${base}/voos`,
                page: 'viagens',
                icon: modulo.icon,
                label: modulo.label
            };
        }
        return {
            to: `${base}?modulo=${modulo.modulo}`,
            page: 'viagens',
            icon: modulo.icon,
            label: modulo.label,
            modulo: modulo.modulo
        };
    });
}

export function sidebarLeafActive(pathname: string, search: string, item: SidebarLeaf): boolean {
    const url = new URL(item.to, 'http://local');
    const path = url.pathname;
    if (item.modulo === 'voos') {
        return path !== '/viagens' && (pathname === path || pathname.startsWith(`${path}/`));
    }
    if (item.modulo) {
        return pathname === path && new URLSearchParams(search).get('modulo') === item.modulo;
    }
    if (item.end) return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
}

export function sidebarGroupLandingActive(
    group: SidebarGroupConfig,
    pathname: string,
    search: string
): boolean {
    if (group.id === 'financas') return pathname === '/dashboard';
    if (pathname === '/viagens') return true;
    const tripId = tripIdFromPathname(pathname);
    if (!tripId || pathname !== `/viagens/${tripId}`) return false;
    return !new URLSearchParams(search).get('modulo');
}
