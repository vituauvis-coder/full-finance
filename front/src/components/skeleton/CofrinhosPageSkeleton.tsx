import { PageLoadingShell, Skeleton } from '../ui/Skeleton';
import { MovementSummaryCardsSkeleton } from './MovementSummaryCardsSkeleton';

function CofrinhosBlockCardSkeleton() {
    return (
        <div className="zero-budget__block-card skeleton-zero-budget__block-card" aria-hidden="true">
            <Skeleton className="skeleton--line-sm" style={{ width: '5.5rem' }} />
            <Skeleton className="skeleton--title" style={{ width: '7.5rem', marginTop: '0.15rem' }} />
            <Skeleton className="skeleton--line-sm" style={{ width: '4.25rem', marginTop: '0.1rem' }} />
            <Skeleton className="skeleton-zero-budget__slider" />
        </div>
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
                    className="movements-treemap-hero__summary"
                />
                <Skeleton className="skeleton-panel skeleton-panel--treemap movements-treemap-hero__map" />
            </div>
            <section className="zero-budget__blocks-section cofrinhos-page__section" aria-hidden="true">
                <div className="zero-budget__blocks-grid">
                    {Array.from({ length: 3 }, (_, i) => (
                        <CofrinhosBlockCardSkeleton key={i} />
                    ))}
                </div>
            </section>
            <div className="table-container data-table-host skeleton-table-host" aria-hidden="true">
                <div className="skeleton-table-row skeleton-table-head">
                    <Skeleton />
                    <Skeleton />
                    <Skeleton />
                    <Skeleton />
                </div>
                {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="skeleton-table-row">
                        <Skeleton />
                        <Skeleton />
                        <Skeleton />
                        <Skeleton style={{ width: '2rem' }} />
                    </div>
                ))}
            </div>
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