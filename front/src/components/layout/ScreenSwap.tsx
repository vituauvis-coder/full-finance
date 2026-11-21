import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ScreenLoader } from '../ui/ScreenLoader';

const SWAP_MS = 380;

/** Troca só entre abas Voos ↔ Transporte terrestre na mesma viagem (sem véu). */
function isTransporteTabSwap(prev: string, next: string): boolean {
    const m = (p: string) => {
        const hit = p.match(/^\/viagens\/[^/]+\/transporte\/(voos|terrestre)\/?$/);
        return hit?.[1] ?? null;
    };
    const a = m(prev);
    const b = m(next);
    return Boolean(a && b && a !== b);
}

type Props = {
    children: ReactNode;
    /** Viagens imersiva e outras rotas sem o chrome do app. */
    fullscreen?: boolean;
};

/**
 * Na troca de rota, cobre o conteúdo com o loader.
 * A página nova continua montada por baixo, para o fetch e os gráficos medirem o layout.
 */
export function ScreenSwap({ children, fullscreen = false }: Props) {
    const { pathname } = useLocation();
    const prevPath = useRef(pathname);
    const [pending, setPending] = useState(false);

    useEffect(() => {
        if (prevPath.current === pathname) return;
        const from = prevPath.current;
        prevPath.current = pathname;
        if (isTransporteTabSwap(from, pathname)) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        setPending(true);
        const timer = window.setTimeout(() => setPending(false), SWAP_MS);
        return () => window.clearTimeout(timer);
    }, [pathname]);

    return (
        <div className={`screen-swap${fullscreen ? ' screen-swap--fullscreen' : ''}`}>
            <div
                className={pending ? 'screen-swap__stage screen-swap__stage--pending' : 'screen-swap__stage'}
                aria-hidden={pending || undefined}
                inert={pending || undefined}
            >
                {children}
            </div>
            {pending ? <ScreenLoader variant={fullscreen ? 'fullscreen' : 'page'} veil /> : null}
        </div>
    );
}
