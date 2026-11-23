import type { Account } from '../../../../lib/types/finance';
import type { CofrinhoBucket, CofrinhoBucketGoal } from '../../domain/cofrinhoAggregations';
import { CofrinhoBucketModal } from './CofrinhoBucketModal';
import { CofrinhoApplicationModal } from './CofrinhoApplicationModal';
import { CofrinhoBucketHistoryModal } from './CofrinhoBucketHistoryModal';
import { CofrinhoMonthlyReconcileModal } from './CofrinhoMonthlyReconcileModal';
import type { CofrinhosPageModel } from '../../hooks/useCofrinhosPageModel';
import { pickPoolYearMonthForAllocation } from '../../domain/cofrinhoPending';
import { cofrinhoPaymentAccounts } from '../../domain/cofrinhoPaymentAccounts';

type Props = {
    model: CofrinhosPageModel;
    goalYear: number;
    bucketModalOpen: boolean;
    editingBucket: CofrinhoBucket | null;
    applicationModalOpen: boolean;
    allocateBucketId: string | null;
    allocatePoolYearMonth: string | null;
    historyBucket: CofrinhoBucket | null;
    reconcileBucket: CofrinhoBucket | null;
    accounts: Account[];
    onCloseBucket: () => void;
    onCloseApplication: () => void;
    onCloseHistory: () => void;
    onCloseReconcile: () => void;
    onSaved: () => Promise<void>;
};

export function CofrinhosPageModals({
    model,
    goalYear,
    bucketModalOpen,
    editingBucket,
    applicationModalOpen,
    allocateBucketId,
    allocatePoolYearMonth,
    historyBucket,
    reconcileBucket,
    accounts,
    onCloseBucket,
    onCloseApplication,
    onCloseHistory,
    onCloseReconcile,
    onSaved
}: Props) {
    const goals = model.goals as CofrinhoBucketGoal[];
    const poolYearMonth = pickPoolYearMonthForAllocation(
        allocatePoolYearMonth,
        model.pendingByMonth,
        model.yearMonth
    );
    const paymentAccounts = cofrinhoPaymentAccounts(accounts);

    return (
        <>
            <CofrinhoBucketModal
                open={bucketModalOpen}
                onClose={onCloseBucket}
                editing={editingBucket}
                goals={goals}
                goalYear={goalYear}
                onSaved={onSaved}
            />
            <CofrinhoApplicationModal
                open={applicationModalOpen}
                onClose={onCloseApplication}
                buckets={model.buckets}
                yearMonth={poolYearMonth}
                poolMonths={model.pendingByMonth}
                currency={model.currency}
                paymentAccounts={paymentAccounts}
                preselectedBucketId={allocateBucketId}
                onSaved={onSaved}
            />
            <CofrinhoBucketHistoryModal
                open={historyBucket != null}
                onClose={onCloseHistory}
                bucket={historyBucket}
                buckets={model.buckets}
                applications={model.applications}
                expenses={model.expenses}
                accounts={accounts}
                currency={model.currency}
            />
            <CofrinhoMonthlyReconcileModal
                open={reconcileBucket != null}
                onClose={onCloseReconcile}
                bucket={reconcileBucket}
                buckets={model.buckets}
                applications={model.applications}
                expenses={model.expenses}
                monthlyBalances={model.monthlyBalances}
                accounts={accounts}
                tripPayloadOutflows={model.tripPayloadOutflows}
                currency={model.currency}
                onSaved={onSaved}
            />
        </>
    );
}