import { CivilPeriodToolbar } from '../../../../components/finance/CivilPeriodToolbar';
import type { Account } from '../../../../lib/types/finance';
import type { CofrinhosPageModel } from '../../hooks/useCofrinhosPageModel';
import { CofrinhosSummaryPanel } from './CofrinhosSummaryPanel';
import { CofrinhosPendingBanner } from './CofrinhosPendingBanner';
import { CofrinhosChartPlaceholder } from './CofrinhosChartPlaceholder';
import { CofrinhoGoalCardsGrid } from './CofrinhoGoalCardsGrid';
import { CofrinhosApplicationsTable } from './CofrinhosApplicationsTable';
import type { CofrinhoBucket } from '../../domain/cofrinhoAggregations';

type Props = {
    model: CofrinhosPageModel;
    goalYear: number;
    accounts: Account[];
    period: string;
    year: number;
    onPeriodChange: (period: string) => void;
    onYearChange: (year: number) => void;
    onEditBucket: (bucket: CofrinhoBucket) => void;
    onAllocate: (bucketId?: string) => void;
    onRefresh: () => Promise<void>;
    onDeleteApplication: (id: string) => void;
};

export function CofrinhosPageWorkspace({
    model,
    goalYear,
    accounts,
    period,
    year,
    onPeriodChange,
    onYearChange,
    onEditBucket,
    onAllocate,
    onRefresh,
    onDeleteApplication
}: Props) {
    const { currency, yearMonth, buckets, applications, goals, expenses, summary } = model;

    return (
        <>
            <CivilPeriodToolbar
                period={period}
                year={year}
                onPeriodChange={onPeriodChange}
                onYearChange={onYearChange}
                accent="cofrinhos"
            />
            <CofrinhosSummaryPanel currency={currency} summary={summary} />
            <CofrinhosPendingBanner
                pending={summary.pending}
                yearMonth={yearMonth}
                currency={currency}
                onDistribute={() => onAllocate()}
            />
            <CofrinhosChartPlaceholder />
            <CofrinhoGoalCardsGrid
                buckets={buckets}
                applications={applications}
                expenses={expenses}
                goals={goals}
                currency={currency}
                goalYear={goalYear}
                onEdit={onEditBucket}
                onAllocate={onAllocate}
                onRefresh={onRefresh}
            />
            <CofrinhosApplicationsTable
                applications={applications}
                buckets={buckets}
                accounts={accounts}
                yearMonth={yearMonth}
                currency={currency}
                onDelete={onDeleteApplication}
            />
        </>
    );
}