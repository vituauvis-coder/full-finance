import { useMemo } from 'react';
import { MovementSummaryCard, MovementSummaryCardsGrid } from '../../../../components/finance/MovementSummaryCard';
import { formatBRL } from '../../../../lib/format';
import { COFRINHOS_SUMMARY_COPY, COFRINHOS_SUMMARY_TITLES } from '../../../../lib/cofrinhoSummaryCopy';
import { defaultCivilYear, defaultPeriod, MONTH_NAMES, monthIndexFromPeriod } from '../../../../lib/period';
import type { CofrinhoSummary } from '../../domain/cofrinhoSummaryStats';
import type { Movement } from '../../../../lib/types/finance';
import type { CofrinhoApplication, CofrinhoBucket } from '../../domain/cofrinhoAggregations';
import { CofrinhosAnnualChart } from './CofrinhosAnnualChart';

type Props = {
    currency: string;
    summary: CofrinhoSummary;
    chartYear: number;
    buckets: CofrinhoBucket[];
    applications: CofrinhoApplication[];
    expenses: Movement[];
};

export function CofrinhosTreemapHero({
    currency,
    summary,
    chartYear,
    buckets,
    applications,
    expenses
}: Props) {
    const chartPeriod = useMemo(() => defaultPeriod(), []);
    const monthLabel = useMemo(() => {
        const mi = monthIndexFromPeriod(chartPeriod);
        return `${MONTH_NAMES[mi]} ${defaultCivilYear()}`;
    }, [chartPeriod]);

    return (
        <div className="movements-treemap-hero movements-treemap-hero--cofrinhos">
            <MovementSummaryCardsGrid
                group="cofrinhos"
                ariaLabel="Resumo dos cofrinhos"
                className="movements-treemap-hero__summary"
            >
                <MovementSummaryCard
                    cardId="cofrinhos-summary-total"
                    tone="balance"
                    icon="savings"
                    title={COFRINHOS_SUMMARY_TITLES.totalInBuckets}
                    description={COFRINHOS_SUMMARY_COPY.totalInBuckets}
                    value={formatBRL(summary.totalInBuckets, currency)}
                />
                <MovementSummaryCard
                    cardId="cofrinhos-summary-month"
                    tone="cofrinhos"
                    icon="savings"
                    title={`${COFRINHOS_SUMMARY_TITLES.monthAllocated} (${monthLabel})`}
                    description={COFRINHOS_SUMMARY_COPY.monthAllocated}
                    value={formatBRL(summary.monthAllocated, currency)}
                />
                <MovementSummaryCard
                    cardId="cofrinhos-summary-pending"
                    tone="projection"
                    icon="hourglass_top"
                    title={COFRINHOS_SUMMARY_TITLES.pending}
                    description={COFRINHOS_SUMMARY_COPY.pending}
                    value={formatBRL(summary.pending, currency)}
                />
            </MovementSummaryCardsGrid>
            <div
                className="movements-treemap-hero__map treemap-container cofrinhos-hero__chart"
                aria-label="Gráfico anual de alocação"
            >
                <CofrinhosAnnualChart
                    year={chartYear}
                    period={chartPeriod}
                    currency={currency}
                    buckets={buckets}
                    applications={applications}
                    expenses={expenses}
                />
            </div>
        </div>
    );
}