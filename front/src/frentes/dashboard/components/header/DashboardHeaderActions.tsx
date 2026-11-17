import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { useDashboardFacets } from '../../context/DashboardFacetsContext';

const EXPENSE_FACETS = [
    ['fixed', 'Essencial'],
    ['recurring', 'Recorrente'],
    ['credit', 'Cartão'],
    ['pix', 'PIX'],
    ['paid', 'Pago'],
    ['unpaid', 'Pendente']
] as const;

type Props = {
    hidden: boolean;
};

export function DashboardHeaderActions({ hidden }: Props) {
    const ctx = useDashboardFacets();
    const facets = ctx?.facets;

    function facetChip(flow: 'gains' | 'expenses', facet: string) {
        const active = facets?.[flow]?.has(facet as never) ?? false;
        return {
            className: `page-toolbar__chip dashboard-expense-facet-btn dashboard-expense-facet-btn--ghost header-quick-filter-btn header-quick-filter-btn--ghost${active ? ' is-active' : ''}`,
            'data-dashboard-flow': flow,
            'data-facet': facet,
            'aria-pressed': active
        } as const;
    }

    if (hidden) return null;

    return (
        <div
            id="dashboard-header-actions"
            className="page-toolbar header-page-actions"
            data-toolbar-accent="dashboard"
            aria-label="Filtros do painel"
        >
            <div className="page-toolbar__clusters dashboard-header-facets">
                <div className="page-toolbar__cluster" role="group" data-tone="gains" aria-label="Entradas no painel">
                    <button
                        type="button"
                        {...facetChip('gains', 'paid')}
                        title="Somente entradas já recebidas — pode combinar com Pendente"
                        onClick={() => ctx?.toggleFacet('gains', 'paid')}
                    >
                        Recebido
                    </button>
                    <button
                        type="button"
                        {...facetChip('gains', 'unpaid')}
                        title="Somente entradas a receber — pode combinar com Recebido"
                        onClick={() => ctx?.toggleFacet('gains', 'unpaid')}
                    >
                        Pendente
                    </button>
                </div>
                <div className="page-toolbar__cluster" role="group" data-tone="expenses" aria-label="Saídas no painel">
                    {EXPENSE_FACETS.map(([facet, label]) => (
                        <button
                            key={facet}
                            type="button"
                            {...facetChip('expenses', facet)}
                            onClick={() => ctx?.toggleFacet('expenses', facet)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="page-toolbar__tools">
                <button
                    type="button"
                    id="dashboard-filter-open-btn"
                    className={`page-toolbar__icon btn-secondary filter-drawer-trigger header-action-btn header-action-btn--icon${ctx?.expenseCategory ? ' filter-drawer-trigger--active' : ''}`}
                    aria-expanded={ctx?.drawerOpen ?? false}
                    aria-controls="dashboard-filter-drawer"
                    title="Filtrar saídas no painel por categoria"
                    aria-label="Filtros"
                    onClick={() => ctx?.setDrawerOpen(true)}
                >
                    <MaterialIcon name="tune" variant="app" />
                    <span className="sr-only">Filtros</span>
                </button>
            </div>
        </div>
    );
}