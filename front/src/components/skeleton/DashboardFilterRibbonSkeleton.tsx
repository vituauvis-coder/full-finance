import { Skeleton } from '../ui/Skeleton';
import { DASHBOARD_EXPENSE_FACETS } from '../../frentes/dashboard/components/header/dashboardFacetChips';

const PILL_H = '2.125rem';

export function DashboardFilterRibbonSkeleton() {
    return (
        <section
            id="dashboard-header-actions"
            className="movement-filter-ribbon dashboard-page-filter-ribbon dashboard-page-filter-ribbon--in-header page-toolbar header-page-actions skeleton-dashboard-header-ribbon"
            data-filter-tone="dashboard"
            aria-hidden="true"
        >
            <div className="movement-filter-ribbon__track">
                <div
                    className="movement-filter-ribbon__status dashboard-page-filter-ribbon__gains"
                    data-treemap-toolbar-accent="gains"
                >
                    <div className="movement-status-pills">
                        <Skeleton className="skeleton--pill" style={{ width: '5.15rem', height: PILL_H }} />
                        <Skeleton className="skeleton--pill" style={{ width: '5.05rem', height: PILL_H }} />
                    </div>
                </div>

                <span className="movement-filter-ribbon__divider" aria-hidden />

                <div
                    className="movement-filter-ribbon__status dashboard-page-filter-ribbon__expenses"
                    data-treemap-toolbar-accent="expenses"
                >
                    <div className="movement-status-pills">
                        {DASHBOARD_EXPENSE_FACETS.map(([facet]) => (
                            <Skeleton
                                key={facet}
                                className="skeleton--pill"
                                style={{
                                    width: facet === 'recurring' || facet === 'unpaid' ? '4.4rem' : '3.65rem',
                                    height: PILL_H
                                }}
                            />
                        ))}
                    </div>
                </div>

                <span className="movement-filter-ribbon__divider" aria-hidden />

                <div className="movement-filter-ribbon__group movement-filter-ribbon__group--grow dashboard-page-filter-ribbon__categories">
                    <Skeleton className="skeleton--pill skeleton-dashboard-header-ribbon__category" style={{ height: PILL_H, width: '100%', minWidth: '7.5rem', maxWidth: '11rem' }} />
                </div>
            </div>
        </section>
    );
}