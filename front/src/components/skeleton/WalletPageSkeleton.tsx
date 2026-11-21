import { PageLoadingShell, Skeleton } from '../ui/Skeleton';
import { CivilPeriodToolbarSkeleton } from './CivilPeriodToolbarSkeleton';
import { MovementSummaryCardsSkeleton } from './MovementSummaryCardsSkeleton';

export function WalletSkeletonLayout() {
    return (
        <>
            <CivilPeriodToolbarSkeleton accent="wallet" inMovementsToolbar />
            <MovementSummaryCardsSkeleton count={4} group="wallet" ariaLabel="Resumo da carteira" />
            <div className="wallet-institutions-list" aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {Array.from({ length: 2 }, (_, i) => (
                    <Skeleton key={i} style={{ height: '5.75rem', borderRadius: '10px', width: '100%' }} />
                ))}
            </div>
        </>
    );
}

export function WalletPageSkeleton() {
    return (
        <PageLoadingShell label="Carregando carteira">
            <section id="wallet-page" className="page active wallet-page wallet-page--modern skeleton-page">
                <WalletSkeletonLayout />
            </section>
        </PageLoadingShell>
    );
}