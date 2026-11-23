import { MovementSummaryCard, MovementSummaryCardsGrid } from '../../../../components/finance/MovementSummaryCard';
import { SummaryMomVariation } from '../../../../components/finance/SummaryMomVariation';
import { formatBRL } from '../../../../lib/format';
import { DEBTS_SUMMARY_COPY, debtsSummaryTitles } from '../../../../lib/movementSummaryCopy';
import type { DebtsSummary } from '../../domain/debtAggregations';
import { debtsSummaryMonthMom } from '../../domain/debtSummaryStats';

type Props = {
    currency: string;
    summary: DebtsSummary;
    gridClassName?: string;
};

export function DebtsSummaryPanel({ currency, summary, gridClassName = '' }: Props) {
    const titles = debtsSummaryTitles();
    const monthMom = debtsSummaryMonthMom(summary);
    const gridClass = ['debts-page__summary', gridClassName].filter(Boolean).join(' ');

    return (
        <MovementSummaryCardsGrid group="debts" ariaLabel="Resumo das dívidas" className={gridClass}>
            <MovementSummaryCard
                cardId="debts-summary-total"
                tone="debts"
                icon="account_balance"
                iconTooltip={false}
                title={titles.totalToday}
                description={DEBTS_SUMMARY_COPY.totalToday}
                value={formatBRL(summary.totalToday, currency)}
            />
            <MovementSummaryCard
                cardId="debts-summary-month"
                tone="debts"
                icon="monitoring"
                iconTooltip={false}
                title={titles.monthTotal}
                description={DEBTS_SUMMARY_COPY.monthTotal}
                value={formatBRL(summary.totalCurrentMonth, currency)}
                footer={<SummaryMomVariation state={monthMom} />}
            />
            <MovementSummaryCard
                cardId="debts-summary-banks"
                tone="debts"
                icon="domain"
                iconTooltip={false}
                title={titles.bankCount}
                description={DEBTS_SUMMARY_COPY.bankCount}
                hint="com saldo registrado"
                value={String(summary.bankCount)}
            />
        </MovementSummaryCardsGrid>
    );
}