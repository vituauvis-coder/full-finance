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

function DebtsBalanceChartSkeleton() {
    return (
        <section className="debts-balance-chart" aria-hidden="true">
            <header className="debts-balance-chart__head">
                <Skeleton className="skeleton-panel__title" style={{ width: '9.5rem' }} />
                <Skeleton className="skeleton-panel__subtitle" style={{ width: '14rem', maxWidth: '72%' }} />
            </header>
            <Skeleton className="debts-balance-chart__canvas skeleton-panel__body--chart" />
        </section>
    );
}

export function DebtsSkeletonLayout() {
    return (
        <>
            <div className="movements-treemap-hero movements-treemap-hero--debts" aria-hidden="true">
                <MovementSummaryCardsSkeleton
                    count={3}
                    group="debts"
                    ariaLabel="Resumo das dívidas"
                    className="movements-treemap-hero__summary debts-summary-metrics--stack"
                />
                <div className="movements-treemap-hero__map treemap-container debts-hero__chart">
                    <DebtsBalanceChartSkeleton />
                </div>
            </div>
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