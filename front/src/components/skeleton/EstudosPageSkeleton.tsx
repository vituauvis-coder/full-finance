import { Skeleton } from '../ui/Skeleton';

export function EstudosHomeSkeletonLayout() {
    return (
        <div className="estudos-page__inner" aria-hidden="true">
            <div className="estudos-hero">
                <div>
                    <Skeleton className="estudos-skel-line estudos-skel-line--sm" />
                    <Skeleton className="estudos-skel-line estudos-skel-line--lg" />
                    <Skeleton className="estudos-skel-line estudos-skel-line--md" />
                </div>
                <Skeleton className="estudos-skel-btn" />
            </div>
            <div className="estudos-card-grid">
                <Skeleton className="estudos-skel-card" />
                <Skeleton className="estudos-skel-card" />
            </div>
        </div>
    );
}