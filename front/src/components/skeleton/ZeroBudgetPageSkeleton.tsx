import { PageLoadingShell, Skeleton } from '../ui/Skeleton';
import { CivilPeriodToolbarSkeleton } from './CivilPeriodToolbarSkeleton';

function ZeroBudgetSummaryBarSkeleton() {
    const segments = ['0.42', '0.28', '0.18', '0.12'] as const;
    return (
        <div className="zero-budget__summary-track">
            <div
                className="zero-budget__bar zero-budget__bar--summary skeleton-zero-budget__bar--segments"
                aria-hidden="true"
            >
                {segments.map((flex, i) => (
                    <Skeleton
                        key={i}
                        className="skeleton-zero-budget__bar-seg"
                        style={{ flex: `${flex} 1 0` }}
                    />
                ))}
            </div>
        </div>
    );
}

function ZeroBudgetBlockCardSkeleton({ amountWidth }: { amountWidth: string }) {
    return (
        <article className="zero-budget__block-card skeleton-zero-budget__block-card" aria-hidden="true">
            <header className="zero-budget__block-head">
                <div className="zero-budget__block-title-row">
                    <Skeleton className="skeleton-zero-budget__block-dot" />
                    <Skeleton className="skeleton--line" style={{ width: '5.75rem', maxWidth: '72%' }} />
                </div>
                <Skeleton className="skeleton-zero-budget__block-delete" />
            </header>
            <Skeleton className="skeleton-zero-budget__block-amount" style={{ width: amountWidth }} />
            <Skeleton className="skeleton-zero-budget__slider" />
            <p className="zero-budget__block-slider-meta">
                <Skeleton className="skeleton--line-sm" style={{ width: '4.25rem' }} />
                <span aria-hidden="true">·</span>
                <Skeleton className="skeleton--line-sm" style={{ width: '5.5rem' }} />
            </p>
            <footer className="zero-budget__block-foot">
                <Skeleton className="skeleton-zero-budget__color-toggle" />
                <Skeleton className="skeleton-zero-budget__list-btn" />
            </footer>
        </article>
    );
}

export function ZeroBudgetSkeletonLayout() {
    return (
        <div className="zero-budget">
            <CivilPeriodToolbarSkeleton accent="zero-budget" />
            <section
                className="zero-budget__summary zero-budget__summary--minimal skeleton-zero-budget-summary"
                aria-hidden="true"
            >
                <div className="zero-budget__summary-stack">
                    <Skeleton className="skeleton--line-sm" style={{ width: '4.75rem' }} />
                    <Skeleton className="skeleton-zero-budget__hero-value" />
                    <ZeroBudgetSummaryBarSkeleton />
                    <dl className="zero-budget__summary-ledger">
                        <div className="zero-budget__summary-ledger-item zero-budget__summary-ledger-item--start">
                            <Skeleton className="skeleton--line-sm" style={{ width: '3.35rem' }} />
                            <Skeleton className="skeleton--title" style={{ width: '5.75rem', marginTop: '0.2rem' }} />
                            <Skeleton className="skeleton--line-sm" style={{ width: '7.25rem', marginTop: '0.3rem' }} />
                        </div>
                        <div className="zero-budget__summary-ledger-item zero-budget__summary-ledger-item--end">
                            <Skeleton className="skeleton--line-sm" style={{ width: '3.5rem' }} />
                            <Skeleton className="skeleton--title" style={{ width: '5.5rem', marginTop: '0.2rem' }} />
                            <Skeleton className="skeleton--line-sm" style={{ width: '6.75rem', marginTop: '0.3rem' }} />
                        </div>
                    </dl>
                </div>
            </section>
            <section className="zero-budget__blocks-section" aria-hidden="true" aria-label="Blocos de orçamento">
                <div className="zero-budget__blocks-grid" data-zb-blocks>
                    <ZeroBudgetBlockCardSkeleton amountWidth="6.25rem" />
                    <ZeroBudgetBlockCardSkeleton amountWidth="5.5rem" />
                    <ZeroBudgetBlockCardSkeleton amountWidth="6.75rem" />
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