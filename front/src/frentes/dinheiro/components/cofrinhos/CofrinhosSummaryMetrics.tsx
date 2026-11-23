import { formatBRL } from '../../../../lib/format';
import { COFRINHOS_SUMMARY_COPY, COFRINHOS_SUMMARY_TITLES } from '../../../../lib/cofrinhoSummaryCopy';
import { MovementSummaryCard, MovementSummaryCardsGrid } from '../../../../components/finance/MovementSummaryCard';
import type { CofrinhoSummary } from '../../domain/cofrinhoSummaryStats';

type Props = {
    currency: string;
    summary: CofrinhoSummary;
    gridClassName?: string;
};

export function CofrinhosSummaryMetrics({ currency, summary, gridClassName = '' }: Props) {
    const hasYield = summary.totalYield > 0.001;
    const yieldDelta = Math.round((summary.totalAccumulated - summary.totalContributed) * 100) / 100;

    return (
        <MovementSummaryCardsGrid
            group="cofrinhos"
            ariaLabel="Resumo dos cofrinhos"
            className={['cofrinhos-summary-metrics cofrinhos-summary-metrics--stack', gridClassName]
                .filter(Boolean)
                .join(' ')}
        >
            <MovementSummaryCard
                cardId="cofrinhos-summary-contributed"
                tone="balance"
                icon="savings"
                title={COFRINHOS_SUMMARY_TITLES.totalContributed}
                description={COFRINHOS_SUMMARY_COPY.totalContributed}
                value={formatBRL(summary.totalContributed, currency)}
            />
            <MovementSummaryCard
                cardId="cofrinhos-summary-accumulated"
                tone="savings"
                icon="account_balance_wallet"
                title={COFRINHOS_SUMMARY_TITLES.totalAccumulated}
                description={COFRINHOS_SUMMARY_COPY.totalAccumulated}
                value={formatBRL(summary.totalAccumulated, currency)}
                valueClassName="cofrinhos-summary__value--yield"
                hint={hasYield ? `+${formatBRL(yieldDelta, currency)} de rendimento` : undefined}
            />
            <MovementSummaryCard
                cardId="cofrinhos-summary-average"
                tone="cofrinhos"
                icon="calendar_month"
                title={COFRINHOS_SUMMARY_TITLES.averageMonthly}
                description={COFRINHOS_SUMMARY_COPY.averageMonthly}
                value={formatBRL(summary.averageMonthlyContribution, currency)}
            />
        </MovementSummaryCardsGrid>
    );
}