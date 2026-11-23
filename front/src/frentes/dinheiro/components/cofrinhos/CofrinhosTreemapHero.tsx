import { useMemo } from 'react';
import { defaultPeriod } from '../../../../lib/period';
import type { CofrinhoSummary } from '../../domain/cofrinhoSummaryStats';
import { CofrinhosSummaryMetrics } from './CofrinhosSummaryMetrics';
import type { Movement } from '../../../../lib/types/finance';
import type { CofrinhoApplication, CofrinhoBucket } from '../../domain/cofrinhoAggregations';
import type { CofrinhoMonthlyBalance } from '../../domain/cofrinhoMonthlyBalances';
import { CofrinhosAnnualChart } from './CofrinhosAnnualChart';

type Props = {
    currency: string;
    summary: CofrinhoSummary;
    chartYear: number;
    buckets: CofrinhoBucket[];
    applications: CofrinhoApplication[];
    expenses: Movement[];
    monthlyBalances: CofrinhoMonthlyBalance[];
};

export function CofrinhosTreemapHero({
    currency,
    summary,
    chartYear,
    buckets,
    applications,
    expenses,
    monthlyBalances
}: Props) {
    const chartPeriod = useMemo(() => defaultPeriod(), []);

    return (
        <div className="movements-treemap-hero movements-treemap-hero--cofrinhos">
            <CofrinhosSummaryMetrics
                currency={currency}
                summary={summary}
                gridClassName="movements-treemap-hero__summary"
            />
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
                    monthlyBalances={monthlyBalances}
                />
            </div>
        </div>
    );
}