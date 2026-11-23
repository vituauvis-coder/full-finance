import type { Debt, DebtUpdate } from '../../domain/debtTypes';
import type { DebtsSummary } from '../../domain/debtAggregations';
import { DebtsBalanceChart } from './DebtsBalanceChart';
import { DebtsSummaryPanel } from './DebtsSummaryPanel';

type Props = {
    currency: string;
    summary: DebtsSummary;
    debts: Debt[];
    updates: DebtUpdate[];
};

export function DebtsTreemapHero({ currency, summary, debts, updates }: Props) {
    return (
        <div className="movements-treemap-hero movements-treemap-hero--debts">
            <DebtsSummaryPanel
                currency={currency}
                summary={summary}
                gridClassName="movements-treemap-hero__summary debts-summary-metrics--stack"
            />
            <div
                className="movements-treemap-hero__map treemap-container debts-hero__chart"
                aria-label="Evolução das dívidas por banco"
            >
                <DebtsBalanceChart debts={debts} updates={updates} currency={currency} />
            </div>
        </div>
    );
}