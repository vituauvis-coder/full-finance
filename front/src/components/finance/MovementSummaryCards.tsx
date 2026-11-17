import type { MomVariationState } from '../../frentes/dashboard/domain/momVariation';
import { DASHBOARD_SUMMARY_COPY } from './dashboardCopy';
import { MovementSummaryCard, MovementSummaryCardsGrid } from './MovementSummaryCard';
import { SummaryMomVariation } from './SummaryMomVariation';

type Props = {
    balance: string;
    income: string;
    expenses: string;
    projection: string;
    incomeReady: boolean;
    expensesReady: boolean;
    projectionReady: boolean;
    incomeMom?: MomVariationState;
    expensesMom?: MomVariationState;
    projectionMom?: MomVariationState;
    balanceMom?: MomVariationState;
};

export function DashboardSummaryCards({
    balance,
    income,
    expenses,
    projection,
    incomeReady,
    expensesReady,
    projectionReady,
    incomeMom,
    expensesMom,
    projectionMom,
    balanceMom
}: Props) {
    return (
        <MovementSummaryCardsGrid group="dashboard" ariaLabel="Resumo do painel">
            <MovementSummaryCard
                cardId="dashboard-balance"
                tone="balance"
                icon="account_balance"
                title={DASHBOARD_SUMMARY_COPY.titles.balance}
                value={balance}
                valueId="dashboard-balance-total"
                description={DASHBOARD_SUMMARY_COPY.balance}
                footer={balanceMom ? <SummaryMomVariation state={balanceMom} /> : null}
            />
            <MovementSummaryCard
                cardId="monthly-income"
                tone="income"
                icon="trending_up"
                title={DASHBOARD_SUMMARY_COPY.titles.income}
                value={incomeReady ? income : '—'}
                valueId="monthly-income"
                description={DASHBOARD_SUMMARY_COPY.income}
                hint={!incomeReady ? DASHBOARD_SUMMARY_COPY.incomeFacetHint : undefined}
                footer={incomeReady && incomeMom ? <SummaryMomVariation state={incomeMom} /> : null}
            />
            <MovementSummaryCard
                cardId="monthly-expenses"
                tone="expense"
                icon="trending_down"
                title={DASHBOARD_SUMMARY_COPY.titles.expenses}
                value={expensesReady ? expenses : '—'}
                valueId="monthly-expenses"
                description={DASHBOARD_SUMMARY_COPY.expenses}
                hint={!expensesReady ? DASHBOARD_SUMMARY_COPY.expenseFacetHint : undefined}
                footer={expensesReady && expensesMom ? <SummaryMomVariation state={expensesMom} /> : null}
            />
            <MovementSummaryCard
                cardId="dashboard-projection"
                tone="projection"
                icon="query_stats"
                title={DASHBOARD_SUMMARY_COPY.titles.projection}
                value={projectionReady ? projection : '—'}
                valueId="dashboard-projection-total"
                description={DASHBOARD_SUMMARY_COPY.projection}
                hint={!projectionReady ? DASHBOARD_SUMMARY_COPY.projectionFacetHint : undefined}
                footer={projectionReady && projectionMom ? <SummaryMomVariation state={projectionMom} /> : null}
            />
        </MovementSummaryCardsGrid>
    );
}