import { useViagensRouteShellGate } from './useViagensRouteShellGate';

/** Skeleton da ficha/módulos de viagem durante fetch da trip ou troca de rota. */
export function useTripPageSkeleton(tripLoading: boolean) {
    return useViagensRouteShellGate(tripLoading);
}