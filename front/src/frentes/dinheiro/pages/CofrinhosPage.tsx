import { CofrinhosPageSkeleton } from '../../../components/skeleton/CofrinhosPageSkeleton';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { useCivilPeriodState } from '../../../hooks/useCivilPeriodState';
import { useSkeletonMinDuration } from '../../../hooks/useSkeletonMinDuration';
import { useCofrinhosHeaderRegistration } from '../context/CofrinhosHeaderSlotContext';
import { useCofrinhosPageModel } from '../hooks/useCofrinhosPageModel';
import { useCofrinhosModals } from '../hooks/useCofrinhosModals';
import { useCofrinhosApplicationActions } from '../hooks/useCofrinhosApplicationActions';
import { CofrinhosPageModals, CofrinhosPageShell, CofrinhosPageWorkspace } from '../components/cofrinhos';

export function CofrinhosPage() {
    const { data, loading, error, refresh } = useFinanceData();
    const showSkeleton = useSkeletonMinDuration(loading || !data);
    const { period, year, onPeriodChange, onYearChange } = useCivilPeriodState();
    const modals = useCofrinhosModals();
    const model = useCofrinhosPageModel(data, period, year);
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
                goalYear={year}
                accounts={data.userAccounts}
                period={period}
                year={year}
                onPeriodChange={onPeriodChange}
                onYearChange={onYearChange}
                onEditBucket={modals.openEditBucket}
                onAllocate={modals.openAllocate}
                onRefresh={refresh}
                onDeleteApplication={(id) => void deleteApplication(id)}
            />
            <CofrinhosPageModals
                model={model}
                goalYear={year}
                bucketModalOpen={modals.bucketModalOpen}
                editingBucket={modals.editingBucket}
                applicationModalOpen={modals.applicationModalOpen}
                allocateBucketId={modals.allocateBucketId}
                onCloseBucket={modals.closeBucketModal}
                onCloseApplication={modals.closeApplicationModal}
                onSaved={refresh}
            />
        </CofrinhosPageShell>
    );
}