import { MovementSummaryCard, MovementSummaryCardsGrid } from '../../../../components/finance/MovementSummaryCard';
import { SummaryMomVariation } from '../../../../components/finance/SummaryMomVariation';
import { formatBRL } from '../../../../lib/format';
import { DEBTS_SUMMARY_COPY, debtsSummaryTitles } from '../../../../lib/movementSummaryCopy';
import type { DebtsSummary } from '../../domain/debtAggregations';
import { debtsSummaryMonthMom } from '../../domain/debtSummaryStats';

type Props = {
    currency: string;
    summary: DebtsSummary;
};

export function DebtsSummaryPanel({ currency, summary }: Props) {
    const titles = debtsSummaryTitles();
    const monthMom = debtsSummaryMonthMom(summary);

    return (
        <MovementSummaryCardsGrid group="debts" ariaLabel="Resumo das dívidas" className="debts-page__summary">
            <MovementSummaryCard
                cardId="debts-summary-total"
                tone="debts"
                icon="fa-landmark"
                title={titles.totalToday}
                description={DEBTS_SUMMARY_COPY.totalToday}
                value={formatBRL(summary.totalToday, currency)}
            />
            <MovementSummaryCard
                cardId="debts-summary-month"
                tone="debts"
                icon="fa-chart-line"
                title={titles.monthTotal}
                description={DEBTS_SUMMARY_COPY.monthTotal}
                value={formatBRL(summary.totalCurrentMonth, currency)}
                footer={<SummaryMomVariation state={monthMom} />}
            />
            <MovementSummaryCard
                cardId="debts-summary-banks"
                tone="debts"
                icon="fa-building-columns"
                title={titles.bankCount}
                description={DEBTS_SUMMARY_COPY.bankCount}
                hint="com saldo registrado"
                value={String(summary.bankCount)}
            />
        </MovementSummaryCardsGrid>
    );
}