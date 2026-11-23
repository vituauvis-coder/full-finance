import { formatBRL } from '../../../../lib/format';
import {
    allocatedAllocationHint,
    allocatedSummaryMetricTone,
    remainingAllocationHint,
    remainingSummaryMetricTone
} from '../../domain/zeroBudgetPlanning';
import type { ZeroBudgetBarSegment } from '../../domain/buildZeroBudgetBarSegments';
import { ZeroBudgetAllocationBar } from './ZeroBudgetAllocationBar';

type Props = {
    currency: string;
    availableBalance: number;
    totalAllocated: number;
    remaining: number;
    isOverallocated: boolean;
    barSegments: ZeroBudgetBarSegment[];
    barDenom: number;
};

const BALANCO_MES_HINT =
    'Entradas do mês (inclui expectativa de estorno) menos fixas e faturas de cartão — mesmo balanço do painel e da carteira.';

export function ZeroBudgetSummaryHero({
    currency,
    availableBalance,
    totalAllocated,
    remaining,
    isOverallocated,
    barSegments,
    barDenom
}: Props) {
    const thirdLabel = isOverallocated ? 'Estourado' : 'Restante';
    const thirdValue = isOverallocated ? Math.abs(remaining) : remaining;
    const allocHint = allocatedAllocationHint(availableBalance, totalAllocated, isOverallocated);
    const allocTone = allocatedSummaryMetricTone(availableBalance, totalAllocated, isOverallocated);
    const thirdHint = remainingAllocationHint(availableBalance, remaining, isOverallocated);
    const thirdTone = remainingSummaryMetricTone(availableBalance, remaining, isOverallocated);

    const balancoTone =
        availableBalance > 0 ? 'positive' : availableBalance < 0 ? 'negative' : 'neutral';

    return (
        <section className="zero-budget__summary zero-budget__summary--minimal" aria-label="Resumo do planejamento do mês">
            <div className="zero-budget__summary-stack">
                <p className="zero-budget__summary-label" title={BALANCO_MES_HINT}>
                    Balanço do mês
                </p>

                <p
                    className={`zero-budget__summary-amount zero-budget__summary-amount--${balancoTone}`}
                >
                    {formatBRL(availableBalance, currency)}
                </p>

                <div className="zero-budget__summary-track">
                    <ZeroBudgetAllocationBar
                        className="zero-budget__bar--summary"
                        segments={barSegments}
                        denom={barDenom}
                        currency={currency}
                    />
                </div>

                <dl className="zero-budget__summary-ledger">
                    <div
                        className={`zero-budget__summary-ledger-item zero-budget__summary-ledger-item--start zero-budget__summary-ledger-item--${allocTone}`}
                    >
                        <dt>Alocado</dt>
                        <dd className="zero-budget__summary-ledger-value">{formatBRL(totalAllocated, currency)}</dd>
                        <dd className={`zero-budget__summary-ledger-note zero-budget__summary-ledger-note--${allocTone}`}>
                            {allocHint}
                        </dd>
                    </div>
                    <div
                        className={`zero-budget__summary-ledger-item zero-budget__summary-ledger-item--end zero-budget__summary-ledger-item--${thirdTone}`}
                    >
                        <dt>{thirdLabel}</dt>
                        <dd className="zero-budget__summary-ledger-value">{formatBRL(thirdValue, currency)}</dd>
                        <dd className={`zero-budget__summary-ledger-note zero-budget__summary-ledger-note--${thirdTone}`}>
                            {thirdHint}
                        </dd>
                    </div>
                </dl>
            </div>
        </section>
    );
}