import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
    busy?: boolean;
    /** Rótulo enquanto `busy` (como `data-loading-label` no legado). */
    busyLabel?: string;
    children: ReactNode;
};

/**
 * Botão com estado busy alinhado a `legacy-web/js/core/button-loading.js`
 * (classe `btn-busy`, `aria-busy`, spinner + label).
 */
export function BusyButton({
    busy = false,
    busyLabel,
    children,
    className = '',
    disabled,
    type = 'button',
    ...rest
}: Props) {
    const cls = [className, busy ? 'btn-busy' : ''].filter(Boolean).join(' ');

    return (
        <button
            type={type}
            className={cls}
            disabled={Boolean(disabled) || busy}
            aria-busy={busy || undefined}
            {...rest}
        >
            {busy ? (
                <>
                    <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                    {busyLabel ? <span className="btn-busy-label">{busyLabel}</span> : null}
                </>
            ) : (
                children
            )}
        </button>
    );
}