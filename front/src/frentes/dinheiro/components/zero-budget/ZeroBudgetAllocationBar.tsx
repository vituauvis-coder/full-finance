import { formatBRL } from '../../../../lib/format';
import { getColorHex } from '../../domain/zeroBudgetColors';
import type { ZeroBudgetBarSegment } from '../../domain/buildZeroBudgetBarSegments';

type Props = {
    segments: ZeroBudgetBarSegment[];
    denom: number;
    currency: string;
    className?: string;
};

export function ZeroBudgetAllocationBar({ segments, denom, currency, className }: Props) {
    const barClass = className ? `zero-budget__bar ${className}` : 'zero-budget__bar';

    return (
        <div className={barClass} role="img" aria-label="Distribuição do saldo entre blocos no mês">
            {segments.length === 0 ? (
                <div className="zero-budget__bar-seg zero-budget__bar-seg--empty"></div>
            ) : (
                segments.map((seg) => {
                    const pctBar = denom > 0 ? ((seg.valor / denom) * 100).toFixed(1) : '0.0';
                    const w = Math.max(0, Math.round(seg.valor * 100));
                    const accentHex = seg.rest ? '' : getColorHex(seg.colorClass);
                    const klass = seg.rest ? 'zero-budget__bar-seg zero-budget__bar-seg--rest' : 'zero-budget__bar-seg';
                    const pctClass = seg.rest
                        ? 'zero-budget__bar-tip-pct zero-budget__bar-tip-pct--muted'
                        : 'zero-budget__bar-tip-pct';
                    const aria = `${seg.nome}: ${formatBRL(seg.valor, currency)}, ${pctBar}% do orçamento`;

                    return (
                        <div
                            key={seg.key}
                            className={klass}
                            style={{
                                flex: `${w} 1 0`,
                                minWidth: 0,
                                ...(seg.rest ? {} : { backgroundColor: accentHex })
                            }}
                            role="img"
                            aria-label={aria}
                            tabIndex={0}
                        >
                            <div className="zero-budget__bar-tip">
                                <span className="zero-budget__bar-tip-name">{seg.nome}</span>
                                <span className="zero-budget__bar-tip-value">{formatBRL(seg.valor, currency)}</span>
                                <span className={pctClass} style={seg.rest ? undefined : { color: accentHex }}>
                                    {pctBar}% do orçamento
                                </span>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}