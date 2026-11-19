import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';

type Props = {
    title: string;
    seal: 'coral' | 'ouro' | 'turquesa' | 'oceano';
    children: ReactNode;
    defaultOpen?: boolean;
    className?: string;
};

type LaunchProps = {
    title: string;
    seal: Props['seal'];
    to: string;
    meta?: string;
    className?: string;
};

const DOT: Record<Props['seal'], string> = {
    coral: 'coral',
    ouro: 'ouro',
    turquesa: 'turquesa',
    oceano: 'turquesa'
};

/** Acordeão alinhado ao malote (`details.viagens-secao`). */
export function ViagemSecaoCard({ title, seal, children, defaultOpen = true, className }: Props) {
    return (
        <details className={['viagens-secao', className].filter(Boolean).join(' ')} defaultOpen={defaultOpen}>
            <summary className="viagens-secao__head">
                <span className={`viagens-secao__dot viagens-secao__dot--${DOT[seal]}`} aria-hidden />
                {title}
            </summary>
            <div className="viagens-secao__body">{children}</div>
        </details>
    );
}

/** Linha no mesmo visual do acordeão, mas abre outra tela. */
export function ViagemSecaoLaunch({ title, seal, to, meta, className }: LaunchProps) {
    return (
        <Link to={to} className={['viagens-secao', 'viagens-secao--launch', className].filter(Boolean).join(' ')}>
            <span className="viagens-secao__head">
                <span className={`viagens-secao__dot viagens-secao__dot--${DOT[seal]}`} aria-hidden />
                {title}
                {meta ? <span className="viagens-secao__meta">{meta}</span> : null}
                <span className="viagens-secao__chevron" aria-hidden>
                    <MaterialIcon name="chevron_right" variant="app" opticalSize={22} />
                </span>
            </span>
        </Link>
    );
}