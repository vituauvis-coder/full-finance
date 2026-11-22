import type { ReactNode } from 'react';
import { useDashboardFacets } from '../../context/DashboardFacetsContext';
import { DASHBOARD_EXPENSE_FACETS, dashboardFacetPillClass } from '../header/dashboardFacetChips';

type Props = {
    trailing?: ReactNode;
    /** Abaixo da timeline civil — filtros do mês no painel inteiro. */
    facetsOnly?: boolean;
    /** Só controles do gráfico (Ano/Mês, colunas/linhas, saldo). */
    hideFacets?: boolean;
};

function DashboardFacetControls() {
    const ctx = useDashboardFacets();
    if (!ctx) return null;

    const { facets, toggleFacet } = ctx;
    const gainsPaid = facets.gains.has('paid');
    const gainsUnpaid = facets.gains.has('unpaid');

    return (
        <div className="dashboard-flux-filter-ribbon__scroll" tabIndex={0}>
            <span className="dashboard-flux-filter-ribbon__lane-label">Entradas</span>
            <div
                className="dashboard-flux-filter-ribbon__segment movement-status-pills"
                data-treemap-toolbar-accent="gains"
                role="group"
                aria-label="Entradas no painel"
            >
                <button
                    type="button"
                    className={dashboardFacetPillClass('gains', gainsPaid)}
                    aria-pressed={gainsPaid}
                    title="Somente entradas já recebidas — pode combinar com Pendente"
                    onClick={() => toggleFacet('gains', 'paid')}
                >
                    Recebido
                </button>
                <button
                    type="button"
                    className={dashboardFacetPillClass('gains', gainsUnpaid)}
                    aria-pressed={gainsUnpaid}
                    title="Somente entradas a receber — pode combinar com Recebido"
                    onClick={() => toggleFacet('gains', 'unpaid')}
                >
                    Pendente
                </button>
            </div>

            <span className="dashboard-flux-filter-ribbon__lane-label">Saídas</span>
            <div
                className="dashboard-flux-filter-ribbon__segment dashboard-flux-filter-ribbon__segment--expenses movement-status-pills"
                data-treemap-toolbar-accent="expenses"
                role="group"
                aria-label="Saídas no painel"
            >
                {DASHBOARD_EXPENSE_FACETS.map(([facet, label]) => {
                    const active = facets.expenses.has(facet);
                    return (
                        <button
                            key={facet}
                            type="button"
                            className={dashboardFacetPillClass('expenses', active)}
                            data-dashboard-flow="expenses"
                            data-facet={facet}
                            aria-pressed={active}
                            onClick={() => toggleFacet('expenses', facet)}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

        </div>
    );
}

export function DashboardFluxFilterRibbon({ trailing, facetsOnly = false, hideFacets = false }: Props) {
    const controlsOnly = hideFacets && trailing;

    if (facetsOnly) {
        return (
            <section
                id="dashboard-page-filters"
                className="movement-filter-ribbon dashboard-flux-filter-ribbon dashboard-flux-filter-ribbon--page"
                data-filter-tone="dashboard"
                aria-label="Filtros do painel"
            >
                <div className="dashboard-flux-filter-ribbon__track">
                    <DashboardFacetControls />
                </div>
            </section>
        );
    }

    if (controlsOnly) {
        return (
            <section
                id="dashboard-flux-filter-ribbon"
                className="movement-filter-ribbon dashboard-flux-filter-ribbon dashboard-flux-filter-ribbon--controls-only"
                data-filter-tone="dashboard"
                aria-label="Opções do gráfico"
            >
                <div className="dashboard-flux-filter-ribbon__track">
                    <div className="dashboard-flux-filter-ribbon__chart-tools">{trailing}</div>
                </div>
            </section>
        );
    }

    const ctx = useDashboardFacets();
    if (!ctx && !trailing) return null;

    return (
        <section
            id="dashboard-flux-filter-ribbon"
            className="movement-filter-ribbon dashboard-flux-filter-ribbon"
            data-filter-tone="dashboard"
            aria-label="Filtros do gráfico de fluxo"
        >
            <div className="dashboard-flux-filter-ribbon__track">
                {hideFacets ? null : <DashboardFacetControls />}
                {trailing ? <div className="dashboard-flux-filter-ribbon__chart-tools">{trailing}</div> : null}
            </div>
        </section>
    );
}