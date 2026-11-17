type Variant = 'page' | 'fullscreen' | 'inline';

type Props = {
    /** Legenda visível. Em `inline`, omita para mostrar só o anel. */
    label?: string;
    variant?: Variant;
    /** Cobre a página nova durante a troca de rota, sem tirar ela do layout. */
    veil?: boolean;
};

/**
 * Estado de espera compartilhado: sessão, troca de rota e carregamento de página.
 */
export function ScreenLoader({ label, variant = 'page', veil = false }: Props) {
    const caption = label ?? (variant === 'inline' ? undefined : 'Carregando');
    const aria = caption ?? 'Carregando';

    return (
        <div
            className={`screen-loader screen-loader--${variant}${veil ? ' screen-loader--veil' : ''}`}
            role="status"
            aria-live="polite"
            aria-label={aria}
        >
            <div className="screen-loader__cluster">
                <span className="screen-loader__ring" aria-hidden="true" />
                {caption ? <p className="screen-loader__label">{caption}</p> : null}
            </div>
        </div>
    );
}
