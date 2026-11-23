import { PageLoadingShell, Skeleton } from '../ui/Skeleton';
import { MovementSummaryCardsSkeleton } from './MovementSummaryCardsSkeleton';

function CofrinhosAnnualChartSkeleton() {
    return (
        <section className="cofrinhos-annual-chart skeleton-cofrinhos-annual-chart" aria-hidden="true">
            <header className="cofrinhos-annual-chart__head">
                <Skeleton className="skeleton-panel__title" style={{ width: '9.5rem' }} />
                <Skeleton className="skeleton-panel__subtitle" style={{ width: '14rem', maxWidth: '72%' }} />
            </header>
            <div className="cofrinhos-annual-chart__plot">
                <Skeleton className="cofrinhos-annual-chart__canvas skeleton-cofrinhos-annual-chart__canvas" />
                <div className="cofrinhos-annual-chart__months" aria-hidden="true">
                    {Array.from({ length: 12 }, (_, i) => (
                        <Skeleton key={i} className="skeleton-cofrinhos-annual-chart__month" />
                    ))}
                </div>
            </div>
            <footer className="cofrinhos-annual-chart__foot">
                <div className="skeleton-cofrinhos-annual-chart__legend">
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="skeleton-cofrinhos-annual-chart__legend-item" />
                    ))}
                </div>
            </footer>
        </section>
    );
}

function CofrinhoBucketTableRowSkeleton({ nameWidth }: { nameWidth: string }) {
    return (
        <li className="cofrinho-bucket-table__row skeleton-cofrinho-bucket-table__row" role="row">
            <span className="cofrinho-bucket-table__cell cofrinho-bucket-table__cell--name" role="cell">
                <Skeleton className="skeleton--circle" style={{ width: '1.65rem', height: '1.65rem', flexShrink: 0 }} />
                <span className="skeleton-cofrinho-bucket-table__name-wrap">
                    <Skeleton className="skeleton--line" style={{ width: nameWidth }} />
                    <Skeleton className="skeleton--line-sm" style={{ width: '3.25rem', marginTop: '0.2rem' }} />
                </span>
            </span>
            <span className="cofrinho-bucket-table__cell cofrinho-bucket-table__cell--valor" role="cell">
                <Skeleton className="skeleton--line" style={{ width: '4.25rem' }} />
            </span>
            <span className="cofrinho-bucket-table__cell cofrinho-bucket-table__cell--meta" role="cell">
                <Skeleton className="skeleton--line-sm" style={{ width: '3.75rem' }} />
            </span>
            <span className="cofrinho-bucket-table__cell cofrinho-bucket-table__cell--progress" role="cell">
                <Skeleton className="skeleton--line-sm" style={{ width: '2.25rem' }} />
                <Skeleton className="skeleton-cofrinho-bucket-table__progress" />
            </span>
            <span className="cofrinho-bucket-table__cell cofrinho-bucket-table__cell--actions" role="cell">
                <Skeleton className="skeleton-cofrinho-bucket-table__action" />
                <Skeleton className="skeleton--circle" style={{ width: '1.85rem', height: '1.85rem' }} />
            </span>
        </li>
    );
}

function CofrinhosBucketsTableSkeleton() {
    return (
        <section className="zero-budget__blocks-section cofrinhos-page__section" aria-hidden="true">
            <div className="cofrinhos-buckets-table skeleton-cofrinhos-buckets-table" id="cofrinhos-goal-cards">
                <div className="cofrinhos-buckets-table__header" role="row">
                    <Skeleton className="skeleton--line-sm" style={{ width: '3.6rem' }} />
                    <Skeleton className="skeleton--line-sm" style={{ width: '2.35rem' }} />
                    <Skeleton className="skeleton--line-sm" style={{ width: '2.1rem' }} />
                    <Skeleton className="skeleton--line-sm" style={{ width: '4.1rem' }} />
                    <Skeleton className="skeleton--line-sm" style={{ width: '2.5rem' }} />
                </div>
                <ul className="cofrinhos-buckets-table__body" role="rowgroup">
                    <li className="cofrinhos-buckets-table__category" role="row">
                        <div className="cofrinhos-buckets-table__category-inner" role="rowheader">
                            <Skeleton className="skeleton--line-sm" style={{ width: '4.75rem' }} />
                            <Skeleton className="skeleton--circle" style={{ width: '1.35rem', height: '1.1rem', borderRadius: 999 }} />
                        </div>
                    </li>
                    <CofrinhoBucketTableRowSkeleton nameWidth="6.5rem" />
                    <CofrinhoBucketTableRowSkeleton nameWidth="5.25rem" />
                    <CofrinhoBucketTableRowSkeleton nameWidth="7rem" />
                </ul>
            </div>
        </section>
    );
}

function CofrinhosLedgerFilterSkeleton() {
    return (
        <section
            className="movement-filter-ribbon cofrinhos-ledger-filter skeleton-cofrinhos-ledger-filter"
            data-filter-tone="cofrinhos"
            aria-hidden="true"
        >
            <div className="movement-filter-ribbon__track">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="movement-filter-ribbon__group">
                        <Skeleton className="skeleton-cofrinhos-ledger-filter__pill" />
                    </div>
                ))}
            </div>
        </section>
    );
}

function CofrinhosLedgerStatementSkeleton() {
    return (
        <section className="cofrinhos-ledger cofrinhos-ledger--with-filters skeleton-cofrinhos-ledger" aria-hidden="true">
            <header className="cofrinhos-ledger__head">
                <div>
                    <Skeleton className="skeleton-panel__title" style={{ width: '4.5rem', height: '1rem' }} />
                    <Skeleton className="skeleton-panel__subtitle" style={{ width: '7.5rem', marginTop: '0.35rem' }} />
                </div>
            </header>
            <CofrinhosLedgerFilterSkeleton />
            <div className="cofrinho-statement cofrinhos-ledger__statement" role="table">
                <div className="cofrinho-statement__header cofrinhos-ledger__header" role="row">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="skeleton--line-sm" style={{ width: i === 2 ? '4.5rem' : '3rem' }} />
                    ))}
                    <span className="cofrinhos-ledger__th-actions" aria-hidden="true" />
                </div>
                <ul className="cofrinho-statement__rows cofrinhos-ledger__body" role="rowgroup">
                    {[0, 1, 2].map((i) => (
                        <li key={i} className="cofrinho-statement__row cofrinhos-ledger__row" role="row">
                            <span className="cofrinho-statement__ref" role="cell">
                                <Skeleton className="skeleton--line-sm" style={{ width: '2.5rem' }} />
                            </span>
                            <span className="cofrinhos-ledger__bucket-cell" role="cell">
                                <span className="skeleton-cofrinhos-ledger__bucket-cell">
                                    <Skeleton className="skeleton--circle" style={{ width: '0.45rem', height: '0.45rem' }} />
                                    <Skeleton className="skeleton--line-sm" style={{ flex: 1, maxWidth: '4.5rem' }} />
                                </span>
                            </span>
                            <span className="cofrinhos-ledger__desc" role="cell">
                                <Skeleton className="skeleton--line" style={{ maxWidth: '7rem' }} />
                            </span>
                            <span className="cofrinho-statement__date" role="cell">
                                <Skeleton className="skeleton--line-sm" style={{ width: '3.25rem' }} />
                            </span>
                            <span className="cofrinhos-ledger__account-cell" role="cell">
                                <Skeleton className="skeleton-cofrinhos-ledger__account-tag" />
                            </span>
                            <span className="cofrinho-statement__amount" role="cell">
                                <Skeleton className="skeleton--line-sm" style={{ width: '3.75rem' }} />
                            </span>
                            <span className="cofrinhos-ledger__actions" role="cell">
                                <Skeleton className="skeleton--circle" style={{ width: '1.25rem', height: '1.25rem' }} />
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
            <footer className="cofrinhos-ledger__footer">
                <dl className="cofrinhos-ledger__summary">
                    {['in', 'out', 'net'].map((tone) => (
                        <div key={tone} className={`cofrinhos-ledger__summary-card is-${tone} skeleton-cofrinhos-ledger__summary-card`}>
                            <Skeleton className="skeleton--line-sm" style={{ width: '4.25rem' }} />
                            <Skeleton className="skeleton--metric" style={{ width: '5rem', height: '1.15rem', marginTop: '0.25rem' }} />
                        </div>
                    ))}
                </dl>
            </footer>
        </section>
    );
}

/** Blocos do skeleton — reutilizado na página e no véu de troca de rota. */
export function CofrinhosSkeletonLayout() {
    return (
        <>
            <div className="movements-treemap-hero movements-treemap-hero--cofrinhos" aria-hidden="true">
                <MovementSummaryCardsSkeleton
                    count={3}
                    group="cofrinhos"
                    ariaLabel="Resumo dos cofrinhos"
                    className="movements-treemap-hero__summary cofrinhos-summary-metrics--stack"
                />
                <div className="movements-treemap-hero__map treemap-container cofrinhos-hero__chart">
                    <CofrinhosAnnualChartSkeleton />
                </div>
            </div>
            <CofrinhosBucketsTableSkeleton />
            <CofrinhosLedgerStatementSkeleton />
        </>
    );
}

export function CofrinhosPageSkeleton() {
    return (
        <PageLoadingShell label="Carregando cofrinhos" className="skeleton-cofrinhos-page">
            <p className="skeleton-visually-hidden">Carregando cofrinhos</p>
            <CofrinhosSkeletonLayout />
        </PageLoadingShell>
    );
}