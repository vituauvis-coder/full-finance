import { PageLoadingShell, Skeleton } from '../ui/Skeleton';
import { CivilPeriodToolbarSkeleton } from './CivilPeriodToolbarSkeleton';

export function WalletSkeletonLayout() {
    return (
        <>
            <CivilPeriodToolbarSkeleton accent="wallet" inMovementsToolbar />
            <Skeleton style={{ height: '12rem', borderRadius: 'var(--dash-surface-radius, 12px)', width: '100%' }} />
            <Skeleton style={{ height: '8rem', borderRadius: 'var(--dash-surface-radius, 12px)', width: '100%' }} />
        </>
    );
}

export function WalletPageSkeleton() {
    return (
        <PageLoadingShell label="Carregando carteira">
            <section id="wallet-page" className="page active wallet-page wallet-page--modern wallet-page--compact skeleton-page">
                <WalletSkeletonLayout />
            </section>
        </PageLoadingShell>
    );
}