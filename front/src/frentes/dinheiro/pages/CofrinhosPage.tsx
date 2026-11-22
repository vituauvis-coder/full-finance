import { CofrinhosPageSkeleton } from '../../../components/skeleton/CofrinhosPageSkeleton';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { useCofrinhosPeriodState } from '../hooks/useCofrinhosPeriodState';
import { useSkeletonMinDuration } from '../../../hooks/useSkeletonMinDuration';
import { useCofrinhosHeaderRegistration } from '../context/CofrinhosHeaderSlotContext';
import { useCofrinhosPageModel } from '../hooks/useCofrinhosPageModel';
import { useCofrinhosModals } from '../hooks/useCofrinhosModals';
import { useCofrinhosApplicationActions } from '../hooks/useCofrinhosApplicationActions';
import { CofrinhosPageModals, CofrinhosPageShell, CofrinhosPageWorkspace } from '../components/cofrinhos';

export function CofrinhosPage() {
    const { data, loading, error, refresh } = useFinanceData();
    const showSkeleton = useSkeletonMinDuration(loading || !data);
    useCofrinhosPeriodState();
    const modals = useCofrinhosModals();
    const model = useCofrinhosPageModel(data);
    const { deleteApplication } = useCofrinhosApplicationActions(refresh);

    useCofrinhosHeaderRegistration(modals.openCreateBucket);

    if (showSkeleton) {
        return (
            <CofrinhosPageShell>
                <CofrinhosPageSkeleton />
            </CofrinhosPageShell>
        );
    }

    if (error || !data || !model) {
        return (
            <CofrinhosPageShell>
                <p role="alert">{error ?? 'Sem dados'}</p>
            </CofrinhosPageShell>
        );
    }

    return (
        <CofrinhosPageShell>
            <CofrinhosPageWorkspace
                model={model}
                accounts={data.userAccounts}
                onEditBucket={modals.openEditBucket}
                onAllocate={modals.openAllocate}
                onOpenHistory={modals.openHistory}
                onDeleteApplication={(id) => void deleteApplication(id)}
                onRefresh={refresh}
            />
            <CofrinhosPageModals
                model={model}
                goalYear={model.goalYear}
                accounts={data.userAccounts}
                bucketModalOpen={modals.bucketModalOpen}
                editingBucket={modals.editingBucket}
                applicationModalOpen={modals.applicationModalOpen}
                allocateBucketId={modals.allocateBucketId}
                allocatePoolYearMonth={modals.allocatePoolYearMonth}
                historyBucket={modals.historyBucket}
                onCloseBucket={modals.closeBucketModal}
                onCloseApplication={modals.closeApplicationModal}
                onCloseHistory={modals.closeHistory}
                onSaved={refresh}
            />
        </CofrinhosPageShell>
    );
}