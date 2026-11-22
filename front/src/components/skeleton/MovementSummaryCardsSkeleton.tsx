import { MovementSummaryCardsGrid } from '../finance/MovementSummaryCard';

type Props = {
    count: number;
    group: string;
    ariaLabel: string;
    className?: string;
};

function MovementSummaryCardSkeleton() {
    return (
        <div className="card movement-summary-card skeleton-movement-summary-card" aria-hidden="true">
            <div className="card-icon skeleton-movement-summary-card__icon" />
            <div className="card-content">
                <h3>&nbsp;</h3>
                <p className="movement-summary-card__value">&nbsp;</p>
                <div className="movement-summary-card__footer">&nbsp;</div>
            </div>
        </div>
    );
}

export function MovementSummaryCardsSkeleton({ count, group, ariaLabel, className }: Props) {
    return (
        <MovementSummaryCardsGrid group={group} ariaLabel={ariaLabel} className={className}>
            {Array.from({ length: count }, (_, i) => (
                <MovementSummaryCardSkeleton key={i} />
            ))}
        </MovementSummaryCardsGrid>
    );
}