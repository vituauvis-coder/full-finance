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

export function WalletSkeletonLayout() {
    return (
        <>
            <CivilPeriodToolbarSkeleton accent="wallet" inMovementsToolbar />
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