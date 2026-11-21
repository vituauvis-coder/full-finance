import type { ReactNode } from 'react';
import { MaterialIcon } from '../icons/MaterialIcon';

export type MovementSummaryTone =
    | 'balance'
    | 'income'
    | 'expense'
    | 'projection'
    | 'savings'
    | 'cofrinhos'
    | 'debts'
    | 'investments';

type Props = {
    cardId: string;
    tone: MovementSummaryTone;
    /** Glifo Material Symbols ou classe legada Font Awesome (`fa-*`). */
    icon: string;
    title: string;
  /** Texto auxiliar sob o título (antes do valor). */
    subtitle?: ReactNode;
    value: ReactNode;
    description?: string;
    footer?: ReactNode;
    hint?: ReactNode;
    titleId?: string;
    valueId?: string;
    variationId?: string;
    iconTooltip?: boolean;
    /** Classes extras no quadrado do ícone (ex.: `wallet-summary-kpi-icon--limit`). */
    iconClassName?: string;
    /** Classes extras no valor (ex.: negativo no poder de compra). */
    valueClassName?: string;
};

export function MovementSummaryCard({
    cardId,
    tone,
    icon,
    title,
    subtitle,
    value,
    description,
    footer,
    hint,
    titleId,
    valueId,
    variationId,
    iconTooltip = true,
    iconClassName,
    valueClassName
}: Props) {
    const tooltipAttr =
        iconTooltip && description && !subtitle
            ? { 'data-portal-tooltip': description }
            : ({} as Record<string, string>);

    return (
        <div className="card movement-summary-card">
            <div
                className={[
                    'card-icon',
                    tone,
                    iconTooltip ? 'movements-summary-card-icon' : '',
                    iconClassName
                ]
                    .filter(Boolean)
                    .join(' ')}
                id={`${cardId}-icon`}
                {...tooltipAttr}
            >
                {icon.startsWith('fa-') ? (
                    <i className={`fas ${icon}`} aria-hidden="true"></i>
                ) : (
                    <MaterialIcon name={icon} variant="app" />
                )}
            </div>
            <div className="card-content">
                <h3 id={titleId ?? `${cardId}-title`}>{title}</h3>
                {subtitle ? <p className="movement-summary-card__subtitle">{subtitle}</p> : null}
                <p
                    className={['movement-summary-card__value', valueClassName].filter(Boolean).join(' ')}
                    id={valueId ?? cardId}
                >
                    {value}
                </p>
                {(footer || hint || variationId) && (
                    <div className="movement-summary-card__footer" aria-hidden={false}>
                        {hint ? <span className="card-metric-hint">{hint}</span> : null}
                        {footer}
                        {variationId ? <span id={variationId} className="dashboard-card-scope" /> : null}
                    </div>
                )}
            </div>
        </div>
    );
}

type GridProps = {
    group: string;
    ariaLabel: string;
    children: ReactNode;
    className?: string;
};

export function MovementSummaryCardsGrid({ group, ariaLabel, children, className = '' }: GridProps) {
    return (
        <div
            className={`summary-cards movements-summary${className ? ` ${className}` : ''}`}
            data-summary-group={group}
            aria-label={ariaLabel}
        >
            {children}
        </div>
    );
}