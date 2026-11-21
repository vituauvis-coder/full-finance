import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { TripStatus } from '../types';

type Props = {
    status: TripStatus | string;
    hovering?: boolean;
    index?: number;
    isPrincipal?: boolean;
    size?: 'md' | 'sm';
    className?: string;
    /** Saída fixa Recife */
    variant?: 'default' | 'home';
};

const fills: Record<string, string> = {
    realizada: 'var(--v-coral)',
    em_curso: 'var(--v-turquesa)',
    planejada: 'rgba(242, 201, 76, 0.28)'
};

const strokes: Record<string, string> = {
    realizada: 'var(--v-coral)',
    em_curso: 'var(--v-turquesa)',
    planejada: 'var(--v-ouro)'
};

/** Forma de gota espelhando `ViagensPinShape` no Mac. */
export function ViagensPin({
    status,
    hovering,
    index = 0,
    isPrincipal,
    size = 'md',
    className = '',
    variant = 'default'
}: Props) {
    const isHome = variant === 'home';
    const key = isHome ? 'em_curso' : status === 'em_curso' || status === 'realizada' ? status : 'planejada';
    const w = size === 'sm' ? 22 : 28;
    const h = size === 'sm' ? 28 : 36;
    const ring = key === 'em_curso' && !isHome;
    const iconSize = size === 'sm' ? 12 : 14;

    return (
        <span
            className={[
                'viagens-pin-wrap',
                isHome ? 'viagens-pin-wrap--home' : '',
                !isHome && key === 'planejada' ? 'viagens-pin-wrap--breathe' : '',
                hovering ? 'viagens-pin-wrap--hover' : '',
                className
            ]
                .filter(Boolean)
                .join(' ')}
            style={{ animationDelay: `${index * 0.06}s` }}
        >
            {ring ? <span className="viagens-pin-ring" aria-hidden /> : null}
            <svg width={w} height={h} viewBox="0 0 28 36" className="viagens-pin-svg" aria-hidden>
                <path
                    d="M14 0a14 14 0 0 1 14 14c0 8-14 22-14 22S0 22 0 14A14 14 0 0 1 14 0z"
                    fill={isHome ? 'var(--v-turquesa)' : fills[key]}
                    stroke={isHome ? 'var(--v-oceano)' : strokes[key]}
                    strokeWidth="1.6"
                />
                {isHome ? null : (
                    <text
                        x="14"
                        y="16"
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="700"
                        fill={isPrincipal ? 'var(--v-ouro)' : 'var(--v-areia)'}
                    >
                        {isPrincipal ? '★' : '✈'}
                    </text>
                )}
            </svg>
            {isHome ? (
                <span className="viagens-pin-wrap__home-icon" aria-hidden>
                    <MaterialIcon name="home" variant="app" opticalSize={iconSize} filled />
                </span>
            ) : null}
        </span>
    );
}