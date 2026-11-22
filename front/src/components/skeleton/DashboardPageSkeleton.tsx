import { PageLoadingShell, Skeleton } from '../ui/Skeleton';
import { CivilPeriodToolbarSkeleton } from './CivilPeriodToolbarSkeleton';
export function DashboardSkeletonLayout() {
    return (
        <>
            <CivilPeriodToolbarSkeleton accent="dashboard" />
            <div className="skeleton-dashboard-tri-column" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton-dashboard-tri-col skeleton-panel">
                        <div className="skeleton-panel__head">
                            <Skeleton className="skeleton-panel__title" style={{ width: '6rem' }} />
                        </div>
                        <Skeleton className="skeleton-panel__body" style={{ flex: 1, minHeight: '12rem' }} />
                    </div>
                ))}
            </div>
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
        </>
    );
}

export function DashboardPageSkeleton() {
    const label = 'Carregando painel';

    return (
        <section id="dashboard-page" className="page active dashboard-page--modern dashboard-page--compact">
            <PageLoadingShell label={label}>
                <p className="skeleton-visually-hidden">{label}</p>
                <DashboardSkeletonLayout />
            </PageLoadingShell>
        </section>
    );
}