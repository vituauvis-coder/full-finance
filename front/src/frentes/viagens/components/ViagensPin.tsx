import type { TripStatus } from '../types';

type Props = {
    status: TripStatus | string;
    hovering?: boolean;
    index?: number;
    isPrincipal?: boolean;
    size?: 'md' | 'sm';
    className?: string;
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
export function ViagensPin({ status, hovering, index = 0, isPrincipal, size = 'md', className = '' }: Props) {
    const key = status === 'em_curso' || status === 'realizada' ? status : 'planejada';
    const w = size === 'sm' ? 22 : 28;
    const h = size === 'sm' ? 28 : 36;
    const ring = key === 'em_curso';

    return (
        <span
            className={`viagens-pin-wrap ${key === 'planejada' ? 'viagens-pin-wrap--breathe' : ''} ${hovering ? 'viagens-pin-wrap--hover' : ''} ${className}`}
            style={{ animationDelay: `${index * 0.06}s` }}
        >
            {ring ? <span className="viagens-pin-ring" aria-hidden /> : null}
            <svg width={w} height={h} viewBox="0 0 28 36" className="viagens-pin-svg" aria-hidden>
                <path
                    d="M14 0a14 14 0 0 1 14 14c0 8-14 22-14 22S0 22 0 14A14 14 0 0 1 14 0z"
                    fill={fills[key]}
                    stroke={strokes[key]}
                    strokeWidth="1.6"
                />
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
            </svg>
        </span>
    );
}