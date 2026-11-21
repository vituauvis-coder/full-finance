import type { ReactNode } from 'react';

type Props = {
    children: ReactNode;
};

/** Envelope da rota — id e classes legadas usados pelo CSS de cofrinhos. */
export function CofrinhosPageShell({ children }: Props) {
    return (
        <section id="cofrinhos-page" className="page active cofrinhos-page cofrinhos-page--modern" aria-label="Cofrinhos">
            {children}
        </section>
    );
}