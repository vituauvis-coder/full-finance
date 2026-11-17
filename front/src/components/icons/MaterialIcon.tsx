import type { CSSProperties, ReactNode } from 'react';

type Props = {
    /** Nome do glifo Material Symbols (ex.: `mail`, `lock`). */
    name: string;
    className?: string;
  /** Preenchido (FILL 1). No shell/dashboard o padrão é `true`. */
    filled?: boolean;
    /** Peso do traço (Material `wght`). */
    weight?: number;
    /** Tamanho óptico (`opsz`). */
    opticalSize?: number;
    /** `auth` — landing/login; `app` — shell e dashboard. */
    variant?: 'auth' | 'app';
    'aria-label'?: string;
    children?: ReactNode;
};

function variationStyle(filled: boolean, weight: number, opticalSize: number): CSSProperties {
    return {
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${opticalSize}`
    };
}

export function MaterialIcon({
    name,
    className = '',
    filled,
    weight,
    opticalSize,
    variant = 'auth',
    'aria-label': ariaLabel
}: Props) {
    const isApp = variant === 'app';
    const useFilled = filled ?? isApp;
    const wght = weight ?? (isApp ? 600 : 400);
    const opsz = opticalSize ?? (isApp ? 24 : 24);

    const variantClass = isApp ? 'app-icon' : 'auth-icon';

    return (
        <span
            className={`material-symbols-rounded ${variantClass} ${className}`.trim()}
            style={variationStyle(useFilled, wght, opsz)}
            aria-hidden={ariaLabel ? undefined : true}
            aria-label={ariaLabel}
            translate="no"
        >
            {name}
        </span>
    );
}