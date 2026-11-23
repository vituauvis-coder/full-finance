import { PageLoadingShell, Skeleton } from '../ui/Skeleton';
import { CivilPeriodToolbarSkeleton } from './CivilPeriodToolbarSkeleton';

function WalletCatalogRowSkeleton() {
    return (
        <article className="skeleton-wallet-catalog-row" aria-hidden="true">
            <Skeleton className="skeleton-wallet-catalog-row__plastic" />
            <div className="skeleton-wallet-catalog-row__copy">
                <Skeleton className="skeleton--line-sm" style={{ width: '58%' }} />
                <Skeleton className="skeleton--line" style={{ width: '72%', marginTop: '0.35rem' }} />
                <div className="skeleton-wallet-catalog-row__kpis">
                    <Skeleton className="skeleton--line-sm" style={{ width: '3.2rem' }} />
                    <Skeleton className="skeleton--line-sm" style={{ width: '3.8rem' }} />
                </div>
            </div>
        </article>
    );
}

function WalletLedgerSkeletonRows() {
    return (
        <div className="skeleton-wallet-ledger__rows" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-wallet-ledger__row">
                    <Skeleton className="skeleton--circle" style={{ width: '1.75rem', height: '1.75rem' }} />
                    <Skeleton className="skeleton--line" style={{ flex: 1, maxWidth: '9rem' }} />
                    <Skeleton className="skeleton--line-sm" style={{ width: '3.5rem' }} />
                </div>
            ))}
        </div>
    );
}

export function WalletSkeletonLayout() {
    return (
        <>
            <CivilPeriodToolbarSkeleton accent="wallet" inMovementsToolbar />
            <div
                className="wallet-tri-column dashboard-tri-column skeleton-wallet-tri-column"
                aria-hidden="true"
            >
                <div className="dashboard-tri-col dashboard-tri-col--wallet skeleton-wallet-tri-col">
                    <div className="skeleton-panel__head">
                        <Skeleton className="skeleton-panel__title" style={{ width: '5.25rem' }} />
                    </div>
                    <Skeleton className="skeleton--metric" style={{ width: '72%', height: '1.65rem', marginTop: '0.15rem' }} />
                    <Skeleton className="skeleton--line-sm" style={{ width: '55%', marginTop: '0.35rem' }} />
                    <div className="skeleton-wallet-buckets">
                        {[0, 1, 2, 3].map((i) => (
                            <WalletSkeletonBucket key={i} variant={i} />
                        ))}
                    </div>
                </div>
                <div className="dashboard-tri-col dashboard-tri-col--heatmap skeleton-wallet-tri-col">
                    <div className="skeleton-panel__head">
                        <Skeleton className="skeleton-panel__title" style={{ width: '7.5rem' }} />
                        <Skeleton className="skeleton-panel__subtitle" style={{ width: '4.25rem' }} />
                    </div>
                    <Skeleton className="skeleton-panel__body skeleton-panel__body--heatmap" />
                </div>
                <div className="dashboard-tri-col dashboard-tri-col--ledger skeleton-wallet-tri-col skeleton-wallet-ledger">
                    <div className="skeleton-panel__head">
                        <Skeleton className="skeleton-panel__title" style={{ width: '6.5rem' }} />
                        <Skeleton className="skeleton-panel__subtitle" style={{ width: '5rem' }} />
                    </div>
                    <WalletLedgerSkeletonRows />
                </div>
            </div>
            <section
                className="wallet-card-catalog wallet-card-catalog--tiles skeleton-wallet-catalog"
                aria-hidden="true"
            >
                <header className="wallet-card-catalog__head">
                    <Skeleton className="skeleton-panel__title" style={{ width: '9.5rem', height: '1rem' }} />
                </header>
                <div className="wallet-card-catalog__list">
                    {[0, 1, 2].map((i) => (
                        <WalletCatalogRowSkeleton key={i} />
                    ))}
                </div>
            </section>
        </>
    );
}

function WalletSkeletonBucket({ variant }: { variant: number }) {
    return (
        <div className="skeleton-wallet-bucket">
            <Skeleton className="skeleton--circle" style={{ width: '1.5rem', height: '1.5rem' }} />
            <Skeleton
                className="skeleton--line-sm"
                style={{ flex: 1, maxWidth: variant % 2 === 0 ? '6.5rem' : '5.25rem' }}
            />
            <Skeleton className="skeleton--line-sm" style={{ width: '3.25rem' }} />
        </div>
    );
}

export function WalletPageSkeleton() {
    return (
        <PageLoadingShell label="Carregando carteira">
            <section
                id="wallet-page"
                className="page active wallet-page wallet-page--modern wallet-page--compact skeleton-page"
            >
                <p className="skeleton-visually-hidden">Carregando carteira</p>
                <WalletSkeletonLayout />
            </section>
        </PageLoadingShell>
    );
}