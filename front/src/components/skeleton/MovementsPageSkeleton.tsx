import { PageLoadingShell, Skeleton } from '../ui/Skeleton';
import { CivilPeriodToolbarSkeleton } from './CivilPeriodToolbarSkeleton';
import { MovementSummaryCardsSkeleton } from './MovementSummaryCardsSkeleton';

export type MovementsSkeletonConfig = {
    summaryGroup: 'gains' | 'expenses';
    summaryAriaLabel: string;
    cardCount: number;
};

type Props = MovementsSkeletonConfig & {
    pageId: 'gains-page' | 'expenses-page';
    label: string;
};

export function MovementsSkeletonLayout({ summaryGroup, summaryAriaLabel, cardCount }: MovementsSkeletonConfig) {
    return (
        <>
            <CivilPeriodToolbarSkeleton
                accent={summaryGroup === 'gains' ? 'gains' : 'expenses'}
                inMovementsToolbar
            />
            <MovementSummaryCardsSkeleton count={cardCount} group={summaryGroup} ariaLabel={summaryAriaLabel} />
            <div className="treemap-container" aria-hidden="true">
                <div className="treemap-header skeleton-panel__head">
                    <Skeleton className="skeleton-panel__title" />
                    <Skeleton className="skeleton-panel__subtitle" />
                </div>
                <Skeleton className="skeleton-panel__body skeleton-panel__body--treemap" />
            </div>
            <div className="table-container data-table-host skeleton-table-host" aria-hidden="true">
                <div className="skeleton-table-row skeleton-table-head">
                    <Skeleton className="skeleton--circle" style={{ width: '1rem', height: '1rem' }} />
                    <Skeleton />
                    <Skeleton />
                    <Skeleton />
                    <Skeleton />
                    <Skeleton style={{ width: '2rem' }} />
                </div>
                {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="skeleton-table-row">
                        <Skeleton className="skeleton--circle" style={{ width: '1rem', height: '1rem' }} />
                        <Skeleton />
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

export function MovementsPageSkeleton({
    pageId,
    label,
    summaryGroup,
    summaryAriaLabel,
    cardCount
}: Props) {
    return (
        <section id={pageId} className="page active movements-page--modern">
            <PageLoadingShell label={label}>
                <p className="skeleton-visually-hidden">{label}</p>
                <MovementsSkeletonLayout
                    summaryGroup={summaryGroup}
                    summaryAriaLabel={summaryAriaLabel}
                    cardCount={cardCount}
                />
            </PageLoadingShell>
        </section>
    );
}