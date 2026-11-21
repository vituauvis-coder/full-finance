import type { CofrinhoBucket, CofrinhoBucketGoal } from '../../domain/cofrinhoAggregations';
import { CofrinhoBucketModal } from './CofrinhoBucketModal';
import { CofrinhoApplicationModal } from './CofrinhoApplicationModal';
import type { CofrinhosPageModel } from '../../hooks/useCofrinhosPageModel';

type Props = {
    model: CofrinhosPageModel;
    goalYear: number;
    bucketModalOpen: boolean;
    editingBucket: CofrinhoBucket | null;
    applicationModalOpen: boolean;
    allocateBucketId: string | null;
    onCloseBucket: () => void;
    onCloseApplication: () => void;
    onSaved: () => Promise<void>;
};

export function CofrinhosPageModals({
    model,
    goalYear,
    bucketModalOpen,
    editingBucket,
    applicationModalOpen,
    allocateBucketId,
    onCloseBucket,
    onCloseApplication,
    onSaved
}: Props) {
    const goals = model.goals as CofrinhoBucketGoal[];

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
                yearMonth={model.yearMonth}
                currency={model.currency}
                preselectedBucketId={allocateBucketId}
                onSaved={onSaved}
            />
        </>
    );
}