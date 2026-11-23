import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { prefersReducedSkeletonMotion, SKELETON_MIN_MS } from '../../lib/skeletonTiming';

function isTransporteTabSwap(prev: string, next: string): boolean {
    const m = (p: string) => {
        const hit = p.match(/^\/viagens\/[^/]+\/transporte\/(voos|terrestre)\/?$/);
        return hit?.[1] ?? null;
    };
    const a = m(prev);
    const b = m(next);
    return Boolean(a && b && a !== b);
}

const RouteTransitionPendingContext = createContext(false);

export function useRouteTransitionPending(): boolean {
    return useContext(RouteTransitionPendingContext);
}

/** Estado compartilhado do véu de troca de rota (header + conteúdo). */
export function RouteTransitionProvider({ children }: { children: ReactNode }) {
    const { pathname } = useLocation();
    const prevPath = useRef(pathname);
    const pendingUntilMs = useRef(0);
    const [, setTick] = useState(0);

    if (prevPath.current !== pathname) {
        const from = prevPath.current;
        prevPath.current = pathname;
        if (!isTransporteTabSwap(from, pathname) && !prefersReducedSkeletonMotion()) {
            pendingUntilMs.current = Date.now() + SKELETON_MIN_MS;
        }
    }

    const pending = !prefersReducedSkeletonMotion() && Date.now() < pendingUntilMs.current;

    useEffect(() => {
        const remaining = pendingUntilMs.current - Date.now();
        if (remaining <= 0) return;
        const timer = window.setTimeout(() => setTick((n) => n + 1), remaining);
        return () => window.clearTimeout(timer);
    }, [pathname]);

    return <RouteTransitionPendingContext.Provider value={pending}>{children}</RouteTransitionPendingContext.Provider>;
}