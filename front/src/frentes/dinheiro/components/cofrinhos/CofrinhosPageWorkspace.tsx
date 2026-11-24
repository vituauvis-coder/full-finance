import type { Account } from '../../../../lib/types/finance';
import type { CofrinhosPageModel } from '../../hooks/useCofrinhosPageModel';
import { CofrinhosPendingBanner } from './CofrinhosPendingBanner';
import { CofrinhoGoalCardsGrid } from './CofrinhoGoalCardsGrid';
import { CofrinhosLedgerStatement } from './CofrinhosLedgerStatement';
import { CofrinhosTreemapHero } from './CofrinhosTreemapHero';
import type { CofrinhoBucket } from '../../domain/cofrinhoAggregations';

type Props = {
    model: CofrinhosPageModel;
    accounts: Account[];
    onEditBucket: (bucket: CofrinhoBucket) => void;
    onAllocate: (bucketId?: string, poolYearMonth?: string) => void;
    onOpenHistory: (bucket: CofrinhoBucket) => void;
    onReconcile: (bucket: CofrinhoBucket) => void;
    onDeleteApplication: (id: string) => void;
    onDeleteMonthlyBalance: (id: string) => void;
    onDeleteMonthlyBalanceMonth: (bucketId: string, yearMonth: string) => void;
    onRefresh: () => Promise<void>;
};

export function CofrinhosPageWorkspace({
    model,
    accounts,
    onEditBucket,
    onAllocate,
    onOpenHistory,
    onReconcile,
    onDeleteApplication,
    onDeleteMonthlyBalance,
    onDeleteMonthlyBalanceMonth,
    onRefresh
}: Props) {
    const {
        currency,
        chartYear,
        goalYear,
        buckets,
        applications,
        goals,
        expenses,
        tripPayloadOutflows,
        monthlyBalances,
        summary,
        pendingByMonth
    } = model;

    return (
        <>
            <CofrinhosTreemapHero
                currency={currency}
                summary={summary}
                chartYear={chartYear}
                buckets={buckets}
                applications={applications}
                expenses={expenses}
                monthlyBalances={monthlyBalances}
            />
            <CofrinhosPendingBanner
                items={pendingByMonth}
                currency={currency}
                onDistribute={() => onAllocate()}
            />
            <CofrinhoGoalCardsGrid
                buckets={buckets}
                applications={applications}
                expenses={expenses}
                goals={goals}
                monthlyBalances={monthlyBalances}
                currency={currency}
                goalYear={goalYear}
                onEdit={onEditBucket}
                onAllocate={onAllocate}
                onOpenHistory={onOpenHistory}
                onReconcile={onReconcile}
            />
            <CofrinhosLedgerStatement
                expenses={expenses}
                tripPayloadOutflows={tripPayloadOutflows}
                applications={applications}
                buckets={buckets}
                monthlyBalances={monthlyBalances}
                accounts={accounts}
                currency={currency}
                onDeleteApplication={onDeleteApplication}
                onDeleteMonthlyBalance={onDeleteMonthlyBalance}
                onDeleteMonthlyBalanceMonth={onDeleteMonthlyBalanceMonth}
                onRefresh={onRefresh}
            />
        </>
    );
}