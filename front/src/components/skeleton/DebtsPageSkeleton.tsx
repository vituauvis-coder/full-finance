import { PageLoadingShell, Skeleton } from '../ui/Skeleton';
import { MovementSummaryCardsSkeleton } from './MovementSummaryCardsSkeleton';

function DebtGoalCardSkeleton() {
    return (
        <div className="zero-budget__block-card debt-bucket-card skeleton-panel" aria-hidden="true">
            <Skeleton className="skeleton--line-sm" style={{ width: '6rem' }} />
            <Skeleton className="skeleton--title" style={{ width: '8rem', marginTop: '0.75rem' }} />
            <Skeleton className="skeleton-panel__body" style={{ minHeight: '4.5rem', marginTop: '1rem' }} />
        </div>
    );
}

export function DebtsSkeletonLayout() {
    return (
        <>
            <MovementSummaryCardsSkeleton count={3} group="debts" ariaLabel="Resumo das dívidas" />
            <section className="dashboard-reports-section debts-page__charts-section" aria-hidden="true">
                <div className="debts-page__charts dashboard-reports-charts-grid dashboard-reports-charts-grid--single">
                    <div className="reports-chart-container dashboard-flux-chart-card debts-page__chart-card skeleton-panel">
                        <div className="skeleton-panel__head">
                            <Skeleton className="skeleton-panel__title" style={{ width: '10rem' }} />
                            <Skeleton className="skeleton-panel__subtitle" />
                        </div>
                        <Skeleton className="skeleton-panel__body skeleton-panel__body--chart debts-page__chart-wrapper" />
                    </div>
                </div>
            </section>
            <section className="zero-budget__blocks-section" aria-hidden="true">
                <div className="zero-budget__blocks-grid">
                    {Array.from({ length: 3 }, (_, i) => (
                        <DebtGoalCardSkeleton key={i} />
                    ))}
                </div>
            </section>
        </>
    );
}

export function DebtsPageSkeleton() {
    return (
        <PageLoadingShell label="Carregando dívidas" className="skeleton-debts-page">
            <p className="skeleton-visually-hidden">Carregando dívidas</p>
            <DebtsSkeletonLayout />
        </PageLoadingShell>
    );
}