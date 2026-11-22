export type SidebarLeaf = {
    to: string;
    page: string;
    icon: string;
    label: string;
    subtitle?: string;
    /** Só ativo na rota exata. */
    end?: boolean;
    /** Ativo só com `?modulo=` na ficha da viagem (orçamento, roteiros, hospedagens). */
    modulo?: string;
};

export type SidebarGroupConfig = {
    id: 'financas' | 'viagens';
    label: string;
    subtitle: string;
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
    label: 'Ferramentas',
    subtitle: 'Calculadoras e utilitários'
};

const FINANCAS_ITEMS: readonly SidebarLeaf[] = [
    {
        to: '/dinheiro/entradas',
        page: 'gains',
        icon: 'trending_up',
        label: 'Entradas',
        subtitle: 'Receitas e ganhos'
    },
    {
        to: '/dinheiro/saidas',
        page: 'expenses',
        icon: 'trending_down',
        label: 'Saídas',
        subtitle: 'Despesas do mês'
    },
    {
        to: '/dinheiro/carteira',
        page: 'wallet',
        icon: 'account_balance_wallet',
        label: 'Carteira',
        subtitle: 'Contas e saldos'
    },
    {
        to: '/dinheiro/cofrinhos',
        page: 'cofrinhos',
        icon: 'savings',
        label: 'Cofrinhos',
        subtitle: 'Metas e reservas'
    },
    {
        to: '/dinheiro/planejamento',
        page: 'zero-budget',
        icon: 'track_changes',
        label: 'Planejamento',
        subtitle: 'Orçamento zero'
    }
];

const VIAGENS_MODULOS = [
    { modulo: 'orcamento', label: 'Orçamento', subtitle: 'Custos da viagem', icon: 'account_balance_wallet' },
    { modulo: 'transporte', label: 'Transportes', subtitle: 'Voos e deslocamentos', icon: 'flight' },
    { modulo: 'hospedagens', label: 'Hospedagens', subtitle: 'Onde ficar', icon: 'apartment' },
    { modulo: 'roteiros', label: 'Roteiros', subtitle: 'Dias e atividades', icon: 'map' }
] as const;

const LAST_TRIP_KEY = 'meu-mundo:last-trip-id';

/** Segmentos de URL que não são ID de viagem (módulos / hubs). */
const RESERVED_TRIP_SLUGS = new Set(['milhas', 'nova', 'voos', 'transporte', 'hospedagens', 'orcamento', 'roteiros']);

export function isNavigableTripId(id: string | null | undefined): id is string {
    const s = String(id ?? '').trim();
    if (!s || RESERVED_TRIP_SLUGS.has(s)) return false;
    return true;
}

export const SIDEBAR_GROUPS: readonly SidebarGroupConfig[] = [
    {
        id: 'financas',
        label: 'Finanças',
        subtitle: 'Dashboard e movimentos',
        icon: 'payments',
        to: '/dashboard',
        pages: ['dashboard', ...FINANCAS_ITEMS.map((item) => item.page)],
        items: FINANCAS_ITEMS
    },
    {
        id: 'viagens',
        label: 'Viagens',
        subtitle: 'Atlas e planejamento',
        icon: 'flight',
        to: '/viagens',
        pages: ['viagens', 'viagens-milhas'],
        items: []
    }
];

export function tripIdFromPathname(pathname: string): string | null {
    const match = pathname.match(/^\/viagens\/([^/]+)/);
    if (!match) return null;
    const slug = match[1];
    if (!isNavigableTripId(slug)) return null;
    return slug;
}

export function rememberLastTripId(tripId: string): void {
    if (!isNavigableTripId(tripId)) return;
    try {
        localStorage.setItem(LAST_TRIP_KEY, tripId);
    } catch {
        /* storage indisponível */
    }
}

export function readLastTripId(): string | null {
    try {
        const raw = localStorage.getItem(LAST_TRIP_KEY);
        return isNavigableTripId(raw) ? raw : null;
    } catch {
        return null;
    }
}

function resolveTripIdForNav(pathTripId: string | null): string | null {
    if (isNavigableTripId(pathTripId)) return pathTripId;
    return readLastTripId();
}

/** Submenus da viagem: módulos da ficha. Sem viagem aberta, caem na página Viagens. */
export function viagensModuleItems(tripId: string | null): SidebarLeaf[] {
    const navTripId = resolveTripIdForNav(tripId);
    const base = navTripId ? `/viagens/${navTripId}` : null;
    return VIAGENS_MODULOS.map((modulo) => {
        if (modulo.modulo === 'transporte') {
            return {
                to: base ? `${base}/transporte` : '/viagens',
                page: 'viagens',
                icon: modulo.icon,
                label: modulo.label,
                subtitle: modulo.subtitle,
                modulo: 'transporte' as const
            };
        }
        if (modulo.modulo === 'hospedagens') {
            return {
                to: base ? `${base}/hospedagens` : '/viagens/hospedagens',
                page: 'viagens',
                icon: modulo.icon,
                label: modulo.label,
                subtitle: modulo.subtitle,
                modulo: 'hospedagens' as const
            };
        }
        if (modulo.modulo === 'roteiros') {
            return {
                to: base ? `${base}/roteiros` : '/viagens/roteiros',
                page: 'viagens',
                icon: modulo.icon,
                label: modulo.label,
                subtitle: modulo.subtitle,
                modulo: 'roteiros' as const
            };
        }
        if (!base) {
            return {
                to: '/viagens',
                page: 'viagens',
                icon: modulo.icon,
                label: modulo.label,
                subtitle: modulo.subtitle,
                end: true,
                modulo: modulo.modulo
            };
        }
        return {
            to: `${base}?modulo=${modulo.modulo}`,
            page: 'viagens',
            icon: modulo.icon,
            label: modulo.label,
            subtitle: modulo.subtitle,
            modulo: modulo.modulo
        };
    });
}

export function sidebarLeafActive(pathname: string, search: string, item: SidebarLeaf): boolean {
    const url = new URL(item.to, 'http://local');
    const path = url.pathname;
    if (item.modulo === 'transporte' || item.modulo === 'hospedagens' || item.modulo === 'roteiros') {
        if (item.modulo === 'hospedagens' && pathname === '/viagens/hospedagens') return true;
        if (item.modulo === 'roteiros' && pathname === '/viagens/roteiros') return true;
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
    if (pathname === '/viagens/milhas') return false;
    const tripId = tripIdFromPathname(pathname);
    if (!tripId) return false;
    if (pathname === `/viagens/${tripId}`) return !new URLSearchParams(search).get('modulo');
    if (pathname.startsWith(`/viagens/${tripId}/transporte`)) return false;
    if (pathname.startsWith(`/viagens/${tripId}/voos`)) return false;
    if (pathname.startsWith(`/viagens/${tripId}/hospedagens`)) return false;
    if (pathname.startsWith(`/viagens/${tripId}/roteiros`)) return false;
    return false;
}
