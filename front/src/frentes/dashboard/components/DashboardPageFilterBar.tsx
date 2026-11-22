import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { useDashboardFacets } from '../context/DashboardFacetsContext';
import { DASHBOARD_EXPENSE_FACETS } from './header/dashboardFacetChips';
import { DashboardCategoryMultiSelect } from './DashboardCategoryMultiSelect';

function statusPill(active: boolean) {
    return `movement-status-pill${active ? ' is-on' : ''}`;
}

export function DashboardPageFilterBar() {
    const ctx = useDashboardFacets();
    if (!ctx) return null;

    const { facets, toggleFacet } = ctx;
    const gainsPaid = facets.gains.has('paid');
    const gainsUnpaid = facets.gains.has('unpaid');

    return (
        <section
            id="dashboard-page-filters"
            className="movement-filter-ribbon dashboard-page-filter-ribbon"
            data-filter-tone="dashboard"
            aria-label="Filtros do painel"
        >
            <div className="movement-filter-ribbon__track">
                <div
                    className="movement-filter-ribbon__status dashboard-page-filter-ribbon__gains"
                    data-treemap-toolbar-accent="gains"
                    role="group"
                    aria-label="Entradas"
                >
                    <div className="movement-status-pills">
                        <button
                            type="button"
                            className={statusPill(gainsPaid)}
                            aria-pressed={gainsPaid}
                            onClick={() => toggleFacet('gains', 'paid')}
                        >
                            <MaterialIcon name="task_alt" variant="app" opticalSize={17} filled={gainsPaid} />
                            Recebido
                        </button>
                        <button
                            type="button"
                            className={statusPill(gainsUnpaid)}
                            aria-pressed={gainsUnpaid}
                            onClick={() => toggleFacet('gains', 'unpaid')}
                        >
                            <MaterialIcon name="schedule" variant="app" opticalSize={17} filled={gainsUnpaid} />
                            Pendente
                        </button>
                    </div>
                </div>

                <span className="movement-filter-ribbon__divider" aria-hidden />

                <div
                    className="movement-filter-ribbon__status dashboard-page-filter-ribbon__expenses"
                    data-treemap-toolbar-accent="expenses"
                    role="group"
                    aria-label="Saídas"
                >
                    <div className="movement-status-pills">
                        {DASHBOARD_EXPENSE_FACETS.map(([facet, label]) => {
                            const active = facets.expenses.has(facet);
                            return (
                                <button
                                    key={facet}
                                    type="button"
                                    className={statusPill(active)}
                                    aria-pressed={active}
                                    onClick={() => toggleFacet('expenses', facet)}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <span className="movement-filter-ribbon__divider" aria-hidden />

                <div className="movement-filter-ribbon__group movement-filter-ribbon__group--grow dashboard-page-filter-ribbon__categories">
                    <MaterialIcon name="sell" variant="app" opticalSize={17} className="movement-filter-ribbon__glyph" aria-hidden />
                    <DashboardCategoryMultiSelect variant="ribbon" />
                </div>
            </div>
        </section>
    );
}