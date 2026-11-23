import type { LegacyPageId } from '../../legacy/routeMap';
import { Skeleton } from '../ui/Skeleton';
import { DashboardFilterRibbonSkeleton } from './DashboardFilterRibbonSkeleton';

type MovementToolbarProps = {
    id: string;
    tone: 'gains' | 'expenses';
    showQuickStatus?: boolean;
};

export function AppHeaderTitleSkeleton() {
    return (
        <div className="header-page-heading header-page-heading--emoji-swap skeleton-header-title" aria-hidden="true">
            <span className="header-page-emoji skeleton-header-title__emoji">
                <Skeleton className="skeleton--circle" style={{ width: '2.35rem', height: '2.35rem' }} />
            </span>
            <Skeleton className="skeleton--line skeleton-header-title__label" style={{ width: '6.25rem', height: '1.05rem' }} />
        </div>
    );
}

export function HeaderNotificationsSkeleton() {
    return (
        <span className="header-notifications skeleton-header-notifications" aria-hidden="true">
            <Skeleton className="skeleton--circle" style={{ width: '2.5rem', height: '2.5rem' }} />
        </span>
    );
}

export function MovementHeaderToolbarSkeleton({ id, tone, showQuickStatus = true }: MovementToolbarProps) {
    return (
        <div
            id={id}
            className="page-toolbar header-page-actions skeleton-header-toolbar"
            data-toolbar-accent={tone}
            aria-hidden="true"
        >
            {showQuickStatus ? (
                <div className="page-toolbar__cluster" data-tone={tone}>
                    <Skeleton className="skeleton--pill" style={{ width: '4.5rem', height: '2.125rem' }} />
                    <Skeleton className="skeleton--pill" style={{ width: '4.65rem', height: '2.125rem' }} />
                </div>
            ) : null}
            <div className="page-toolbar__tools">
                <Skeleton className="skeleton--pill skeleton-header-toolbar__cta" style={{ width: '5.15rem', height: '2.5rem' }} />
            </div>
        </div>
    );
}

export function HeaderCtaToolbarSkeleton({
    id,
    accent
}: {
    id: string;
    accent: string;
}) {
    return (
        <div
            id={id}
            className="page-toolbar header-page-actions skeleton-header-toolbar"
            data-toolbar-accent={accent}
            aria-hidden="true"
        >
            <div className="page-toolbar__tools">
                <Skeleton className="skeleton--pill skeleton-header-toolbar__cta" style={{ width: '5.15rem', height: '2.5rem' }} />
            </div>
        </div>
    );
}

export function HeaderRightSkeleton({
    pageId,
    viagensAtlas = false
}: {
    pageId: LegacyPageId;
    viagensAtlas?: boolean;
}) {
    switch (pageId) {
        case 'dashboard':
            return <DashboardFilterRibbonSkeleton />;
        case 'gains':
            return (
                <MovementHeaderToolbarSkeleton
                    id="gains-header-actions"
                    tone="gains"
                    showQuickStatus={false}
                />
            );
        case 'expenses':
            return (
                <MovementHeaderToolbarSkeleton
                    id="expenses-header-actions"
                    tone="expenses"
                    showQuickStatus={false}
                />
            );
        case 'wallet':
            return <HeaderCtaToolbarSkeleton id="wallet-header-actions" accent="wallet" />;
        case 'cofrinhos':
            return <HeaderCtaToolbarSkeleton id="cofrinhos-header-actions" accent="cofrinhos" />;
        case 'debts':
            return <HeaderCtaToolbarSkeleton id="debts-header-actions" accent="debts" />;
        case 'zero-budget':
            return <HeaderCtaToolbarSkeleton id="zero-budget-header-actions" accent="zero-budget" />;
        case 'viagens':
            return viagensAtlas ? (
                <HeaderCtaToolbarSkeleton id="viagens-header-actions" accent="viagens" />
            ) : null;
        default:
            return null;
    }
}