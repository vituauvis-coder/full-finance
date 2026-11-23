import type { CofrinhoSummary } from '../../domain/cofrinhoSummaryStats';
import { CofrinhosSummaryMetrics } from './CofrinhosSummaryMetrics';

type Props = {
    currency: string;
    summary: CofrinhoSummary;
};

export function CofrinhosSummaryPanel({ currency, summary }: Props) {
    return <CofrinhosSummaryMetrics currency={currency} summary={summary} gridClassName="cofrinhos-page__summary" />;
}