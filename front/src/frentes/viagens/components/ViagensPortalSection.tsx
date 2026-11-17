import type { ReactNode } from 'react';

/** Envelopa o conteúdo de Viagens no chrome do portal (sidebar + header), com tokens malote.css. */
export function ViagensPortalSection({ children }: { children: ReactNode }) {
    return (
        <section id="viagens-page" className="viagens-page" aria-label="Viagens">
            {children}
        </section>
    );
}