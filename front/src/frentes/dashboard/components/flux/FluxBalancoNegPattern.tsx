import { useId } from 'react';
import { colorWithAlpha } from './fluxChartTheme';

type Props = {
    patternId: string;
    /** Mesma cor do balanço positivo — só o preenchimento é tracejado. */
    saldoPos: string;
};

/** Padrão tracejado para coluna de balanço negativo (mesma escala, barra para cima). */
export function FluxBalancoNegPattern({ patternId, saldoPos }: Props) {
    return (
        <defs>
            <pattern
                id={patternId}
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(-38)"
            >
                <rect width="8" height="8" fill={colorWithAlpha(saldoPos, 0.28)} />
                <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="8"
                    stroke={colorWithAlpha(saldoPos, 0.92)}
                    strokeWidth="2.25"
                    strokeDasharray="3 2.5"
                />
            </pattern>
        </defs>
    );
}

export function balancoNegPatternUrl(patternId: string) {
    return `url(#${patternId})`;
}

export function useBalancoNegPatternId() {
    const rawId = useId();
    return `flux-balanco-neg-${rawId.replace(/:/g, '')}`;
}