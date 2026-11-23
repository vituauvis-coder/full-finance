import { useLocation } from 'react-router-dom';
import { useRouteTransitionPending } from '../components/layout/RouteTransitionContext';
import { useViagensShellVeilState } from '../frentes/viagens/context/ViagensShellVeilContext';
import { legacyPageIdFromPath, type LegacyPageId } from '../legacy/routeMap';
import { useViagensRouteShellGate } from './useViagensRouteShellGate';

const VIAGENS_VEIL_PAGES = new Set<LegacyPageId>(['viagens', 'viagens-milhas']);

/** Skeleton no app-header durante fetch ou troca de rota nas telas de Viagens. */
export function useViagensShellVeil(pageId: LegacyPageId): boolean {
    const { pathname } = useLocation();
    const active = legacyPageIdFromPath(pathname);
    const routePending = useRouteTransitionPending();
    const contentLoading = useViagensShellVeilState();

    if (!VIAGENS_VEIL_PAGES.has(pageId)) return false;
    if (active !== pageId) return false;

    return contentLoading || routePending;
}

/** Corpo do atlas: véu na navegação + skeleton local no F5 / fetch. */
export function useViagensAtlasSkeleton(loading: boolean) {
    return useViagensRouteShellGate(loading, 'atlas');
}