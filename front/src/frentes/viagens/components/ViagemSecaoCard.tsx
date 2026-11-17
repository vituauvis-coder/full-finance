import type { ReactNode } from 'react';

type Props = {
    title: string;
    seal: 'coral' | 'ouro' | 'turquesa' | 'oceano';
    children: ReactNode;
    defaultOpen?: boolean;
};

const DOT: Record<Props['seal'], string> = {
    coral: 'coral',
    ouro: 'ouro',
    turquesa: 'turquesa',
    oceano: 'turquesa'
};

/** Acordeão alinhado ao malote (`details.viagens-secao`). */
export function ViagemSecaoCard({ title, seal, children, defaultOpen = true }: Props) {
    return (
        <details className="viagens-secao" defaultOpen={defaultOpen}>
            <summary className="viagens-secao__head">
                <span className={`viagens-secao__dot viagens-secao__dot--${DOT[seal]}`} aria-hidden />
                {title}
            </summary>
            <div className="viagens-secao__body">{children}</div>
        </details>
    );
}