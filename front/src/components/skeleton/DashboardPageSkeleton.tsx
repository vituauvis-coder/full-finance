import { PageLoadingShell, Skeleton } from '../ui/Skeleton';
import { CivilPeriodToolbarSkeleton } from './CivilPeriodToolbarSkeleton';
import { MovementSummaryCardsSkeleton } from './MovementSummaryCardsSkeleton';

export function DashboardSkeletonLayout() {
    return (
        <>
            <CivilPeriodToolbarSkeleton accent="dashboard" />
            <MovementSummaryCardsSkeleton count={4} group="dashboard" ariaLabel="Resumo do painel" />
            <div className="dashboard-reports-section" aria-hidden="true">
                <div className="dashboard-reports-charts-grid dashboard-reports-charts-grid--single">
                    <div className="reports-chart-container dashboard-flux-chart-card skeleton-panel">
                        <div className="skeleton-panel__head">
                            <Skeleton className="skeleton-panel__title" style={{ width: '14rem' }} />
                            <Skeleton className="skeleton-panel__subtitle" />
                        </div>
                        <Skeleton className="skeleton-panel__body skeleton-panel__body--chart" />
                    </div>
                </div>
            </div>
            <div className="dashboard-cash-heatmap list-container skeleton-panel" aria-hidden="true">
                <div className="skeleton-panel__head">
                    <Skeleton className="skeleton-panel__title" style={{ width: '12rem' }} />
                </div>
                <Skeleton className="skeleton-panel__body skeleton-panel__body--heatmap" />
            </div>
        </>
    );
}

export function DashboardPageSkeleton() {
    const label = 'Carregando painel';

    return (
        <section id="dashboard-page" className="page active dashboard-page--modern">
            <PageLoadingShell label={label}>
                <p className="skeleton-visually-hidden">{label}</p>
                <DashboardSkeletonLayout />
            </PageLoadingShell>
        </section>
    );
}