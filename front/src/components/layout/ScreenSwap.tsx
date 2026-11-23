import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ScreenLoader } from '../ui/ScreenLoader';
import { viagensSkeletonVariantFromLocation } from '../skeleton/viagens/viagensSkeletonRoute';
import { RouteTransitionVeil } from './RouteTransitionVeil';
import { useRouteTransitionPending } from './RouteTransitionContext';

type Props = {
    children: ReactNode;
    /** Viagens imersiva e outras rotas sem o chrome do app. */
    fullscreen?: boolean;
};

/**
 * Na troca de rota, cobre o conteúdo com skeleton (rotas mapeadas) ou spinner (fallback).
 * A página nova continua montada por baixo, para o fetch e os gráficos medirem o layout.
 */
export function ScreenSwap({ children, fullscreen = false }: Props) {
    const pending = useRouteTransitionPending();
    const { pathname, search } = useLocation();
    const viagensVariant = viagensSkeletonVariantFromLocation(pathname, search);
    const useRouteVeil = pending && viagensVariant !== 'atlas' && viagensVariant != null ? false : pending;
    const obscureStage = useRouteVeil;

    return (
        <div className={`screen-swap${fullscreen ? ' screen-swap--fullscreen' : ''}`}>
            <div
                className={obscureStage ? 'screen-swap__stage screen-swap__stage--pending' : 'screen-swap__stage'}
                aria-hidden={obscureStage || undefined}
                inert={obscureStage || undefined}
            >
                {children}
            </div>
            {useRouteVeil ? (
                fullscreen ? (
                    <ScreenLoader variant="fullscreen" veil />
                ) : (
                    <RouteTransitionVeil />
                )
            ) : null}
        </div>
    );
}
