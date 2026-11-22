import type { ReactNode } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
export type TripFichaPanelTone = 'oceano' | 'turquesa' | 'coral' | 'ouro';

type PanelProps = {
    children: ReactNode;
    className?: string;
    'aria-label': string;
};

export function TripFichaPanel({ children, className, ...rest }: PanelProps) {
    const extra = className?.trim() ?? '';
    return (
        <article className={`viagens-ficha-panel viagens-panel${extra ? ` ${extra}` : ''}`} {...rest}>
            {children}
        </article>
    );
}

type HeaderProps = {
    icon: string;
    title: string;
    tone?: TripFichaPanelTone;
    actions?: ReactNode;
    meta?: ReactNode;
    className?: string;
};

export function TripFichaPanelBody({
    children,
    className
}: {
    children: ReactNode;
    className?: string;
}) {
    const extra = className?.trim() ?? '';
    return <div className={`viagens-ficha-panel__body${extra ? ` ${extra}` : ''}`}>{children}</div>;
}

export function TripFichaPanelFooter({ children }: { children: ReactNode }) {
    return <footer className="viagens-ficha-panel__footer">{children}</footer>;
}

export function TripFichaPanelHeader({ icon, title, tone = 'oceano', actions, meta, className }: HeaderProps) {
    const mod = className?.trim() ?? '';
    return (
        <header className={`viagens-ficha-panel__head${mod ? ` ${mod}` : ''}`}>
            <div className="viagens-ficha-panel__head-row">
                <div className="viagens-ficha-panel__head-main">
                    <span
                        className={`viagens-ficha-panel__icon-well viagens-ficha-panel__icon-well--${tone}`}
                        aria-hidden
                    >
                        <MaterialIcon name={icon} variant="app" opticalSize={16} />
                    </span>
                    <h3 className="viagens-ficha-panel__title">{title}</h3>
                </div>
                {actions ? <div className="viagens-ficha-panel__actions">{actions}</div> : null}
            </div>
            {meta ? <div className="viagens-ficha-panel__meta">{meta}</div> : null}
        </header>
    );
}