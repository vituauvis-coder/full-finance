import { MovementSummaryCard, MovementSummaryCardsGrid } from '../../../../components/finance/MovementSummaryCard';
import { formatBRL } from '../../../../lib/format';
import { COFRINHOS_SUMMARY_COPY, COFRINHOS_SUMMARY_TITLES } from '../../../../lib/cofrinhoSummaryCopy';
import type { CofrinhoSummary } from '../../domain/cofrinhoSummaryStats';

type Props = {
    currency: string;
    summary: CofrinhoSummary;
};

export function CofrinhosSummaryPanel({ currency, summary }: Props) {
    return (
        <MovementSummaryCardsGrid group="cofrinhos" ariaLabel="Resumo dos cofrinhos" className="cofrinhos-page__summary">
            <MovementSummaryCard
                cardId="cofrinhos-summary-total"
                tone="balance"
                icon="fa-chart-line"
                title={COFRINHOS_SUMMARY_TITLES.totalInBuckets}
                description={COFRINHOS_SUMMARY_COPY.totalInBuckets}
                value={formatBRL(summary.totalInBuckets, currency)}
            />
            <MovementSummaryCard
                cardId="cofrinhos-summary-month"
                tone="cofrinhos"
                icon="fa-piggy-bank"
                title={COFRINHOS_SUMMARY_TITLES.monthAllocated}
                description={COFRINHOS_SUMMARY_COPY.monthAllocated}
                value={formatBRL(summary.monthAllocated, currency)}
            />
            <MovementSummaryCard
                cardId="cofrinhos-summary-pending"
                tone="projection"
                icon="fa-hourglass-half"
                title={COFRINHOS_SUMMARY_TITLES.pending}
                description={COFRINHOS_SUMMARY_COPY.pending}
                value={formatBRL(summary.pending, currency)}
            />
        </MovementSummaryCardsGrid>
    );
}