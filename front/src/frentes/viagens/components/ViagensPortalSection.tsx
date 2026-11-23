import type { ReactNode } from 'react';
import '../styles/viagens-skeleton.css';

type Props = {
    children: ReactNode;
    /** Oculta o header global «Viagens» (ficha da viagem). */
    ficha?: boolean;
    /** Home do atlas com superfícies estilo dashboard. */
    atlasModern?: boolean;
};

/** Envelopa o conteúdo de Viagens no chrome do portal (sidebar + header), com tokens malote.css. */
export function ViagensPortalSection({ children, ficha = false, atlasModern = false }: Props) {
    return (
        <section
            id="viagens-page"
            className={[
                'viagens-page',
                ficha ? 'viagens-page--ficha' : '',
                atlasModern ? 'viagens-page--atlas-modern' : ''
            ]
                .filter(Boolean)
                .join(' ')}
            aria-label="Viagens"
        >
            {children}
        </section>
    );
}