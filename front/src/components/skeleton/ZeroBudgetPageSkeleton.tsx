import { PageLoadingShell, Skeleton } from '../ui/Skeleton';
import { CivilPeriodToolbarSkeleton } from './CivilPeriodToolbarSkeleton';

export function ZeroBudgetSkeletonLayout() {
    return (
        <div className="zero-budget">
            <CivilPeriodToolbarSkeleton accent="zero-budget" />
            <section
                className="zero-budget__summary zero-budget__summary--minimal skeleton-zero-budget-summary"
                aria-hidden="true"
            >
                <div className="zero-budget__summary-stack">
                    <Skeleton className="skeleton--line-sm" style={{ width: '4.5rem' }} />
                    <Skeleton className="skeleton-zero-budget__hero-value" />
                    <div className="zero-budget__summary-track">
                        <div className="zero-budget__bar skeleton-zero-budget__bar">
                            <Skeleton className="skeleton-zero-budget__bar-fill" />
                        </div>
                    </div>
                    <div className="zero-budget__summary-ledger">
                        <div className="zero-budget__summary-ledger-item zero-budget__summary-ledger-item--start">
                            <Skeleton className="skeleton--line-sm" style={{ width: '3.25rem' }} />
                            <Skeleton className="skeleton--title" style={{ width: '5.5rem', marginTop: '0.2rem' }} />
                            <Skeleton className="skeleton--line-sm" style={{ width: '6.25rem', marginTop: '0.3rem' }} />
                        </div>
                        <div className="zero-budget__summary-ledger-item zero-budget__summary-ledger-item--end">
                            <Skeleton className="skeleton--line-sm" style={{ width: '3.25rem' }} />
                            <Skeleton className="skeleton--title" style={{ width: '5.5rem', marginTop: '0.2rem' }} />
                            <Skeleton className="skeleton--line-sm" style={{ width: '6.25rem', marginTop: '0.3rem' }} />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

export function ZeroBudgetPageSkeleton() {
    return (
        <section id="zero-budget-page" className="page active zero-budget-page" aria-label="Planejamento Base Zero">
            <PageLoadingShell label="Carregando planejamento" className="skeleton-zero-budget-page">
                <p className="skeleton-visually-hidden">Carregando planejamento</p>
                <ZeroBudgetSkeletonLayout />
            </PageLoadingShell>
        </section>
    );
}