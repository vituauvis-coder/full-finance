import { useRouteTransitionPending } from '../components/layout/RouteTransitionContext';
import { useViagensContentLoading } from '../frentes/viagens/context/ViagensShellVeilContext';
import { useSkeletonMinDuration } from './useSkeletonMinDuration';

export type ViagensRouteSkeletonMode = 'atlas' | 'trip';

/**
 * Viagens: atlas usa véu (`RouteTransitionVeil`); módulos da ficha montam skeleton no portal (`#viagens-page`).
 */
export function useViagensRouteShellGate(loading: boolean, mode: ViagensRouteSkeletonMode = 'trip') {
    const routePending = useRouteTransitionPending();
    const showDataSkeleton = useSkeletonMinDuration(loading);
    const shellBusy = showDataSkeleton || routePending;

    useViagensContentLoading(shellBusy);

    return {
        routePending,
        showPageSkeleton:
            mode === 'atlas' ? !routePending && showDataSkeleton : showDataSkeleton || routePending
    };
}