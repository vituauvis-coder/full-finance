import type { ReactNode } from 'react';

export type MovementStatusKind = 'gain' | 'expense';

type Props = {
    kind: MovementStatusKind;
    /** `false` = pendente / a receber */
    paid: boolean;
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
    ariaLabel?: string;
};

/** Badge de status alinhado ao legado (`expense-status-badge` em `dashboard.css`). */
export function MovementStatusBadge({ kind, paid, children, onClick, disabled, title, ariaLabel }: Props) {
    const state = paid ? 'expense-status-badge--paid' : 'expense-status-badge--pending';
    const toggle = onClick ? (kind === 'gain' ? 'gain-received-toggle' : 'expense-paid-toggle') : '';
    const className = ['expense-status-badge', state, toggle].filter(Boolean).join(' ');

    if (!onClick) {
        return <span className={className}>{children}</span>;
    }

    const defaultTitle = paid ? 'Clique para marcar como pendente' : 'Clique para marcar como pago';

    return (
        <button
            type="button"
            className={className}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick();
            }}
            disabled={disabled}
            title={title ?? defaultTitle}
            aria-label={ariaLabel ?? title ?? defaultTitle}
            aria-pressed={paid}
            aria-busy={disabled ? true : undefined}
        >
            {children}
        </button>
    );
}