import type { CSSProperties, ReactNode } from 'react';

type SkeletonProps = {
    className?: string;
    style?: CSSProperties;
    /** Bloqueio decorativo — não anuncia sozinho ao leitor de tela. */
    decorative?: boolean;
};

export function Skeleton({ className = '', style, decorative = true }: SkeletonProps) {
    return (
        <span
            className={`skeleton${className ? ` ${className}` : ''}`}
            aria-hidden={decorative ? true : undefined}
            style={style}
        />
    );
}

type PageLoadingShellProps = {
    label: string;
    children: ReactNode;
    className?: string;
};

/** Envelope de página em carregamento inicial — mantém o layout real e `aria-busy`. */
export function PageLoadingShell({ label, children, className = '' }: PageLoadingShellProps) {
    return (
        <div className={`skeleton-page${className ? ` ${className}` : ''}`} aria-busy="true" role="status" aria-label={label}>
            {children}
        </div>
    );
}