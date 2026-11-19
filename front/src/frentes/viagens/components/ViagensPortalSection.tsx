import type { ReactNode } from 'react';

type Props = {
    children: ReactNode;
    /** Oculta o header global «Viagens» (ficha da viagem). */
    ficha?: boolean;
};

/** Envelopa o conteúdo de Viagens no chrome do portal (sidebar + header), com tokens malote.css. */
export function ViagensPortalSection({ children, ficha = false }: Props) {
    return (
        <section
            id="viagens-page"
            className={`viagens-page${ficha ? ' viagens-page--ficha' : ''}`}
            aria-label="Viagens"
        >
            {children}
        </section>
    );
}