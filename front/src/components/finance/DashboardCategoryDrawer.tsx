import { useMemo } from 'react';
import { useFinanceData } from '../../app/FinanceDataProvider';
import { useCategories } from '../../hooks/useCategories';
import { useDashboardFacets } from '../../frentes/dinheiro/dashboard/DashboardFacetsContext';
import { FilterDrawer } from './FilterDrawer';

export function DashboardCategoryDrawer() {
    const ctx = useDashboardFacets();
    const { data } = useFinanceData();
    const { categories } = useCategories('expense');

    const options = useMemo(() => {
        const fromApi = categories.map((c) => c.name);
        const fromData = new Set<string>();
        for (const e of data?.userExpenses ?? []) {
            if (e.category) fromData.add(e.category);
        }
        return [...new Set([...fromApi, ...fromData])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [categories, data]);

    if (!ctx) return null;

    return (
        <FilterDrawer
            id="dashboard-filter-drawer"
            title="Filtros do painel"
            open={ctx.drawerOpen}
            onClose={() => ctx.setDrawerOpen(false)}
            footer={
                <button
                    type="button"
                    id="dashboard-filter-clear"
                    className="btn-secondary"
                    onClick={() => ctx.setExpenseCategory('')}
                >
                    Todas as categorias
                </button>
            }
        >
            <p className="card-metric-hint" style={{ margin: '0 0 1rem' }}>
                Afeta totais de saídas no período selecionado no topo.
            </p>
            <div className="filter-drawer-field">
                <label htmlFor="category-filter">Categoria das saídas</label>
                <select
                    id="category-filter"
                    className="table-filters__select"
                    value={ctx.expenseCategory}
                    onChange={(e) => ctx.setExpenseCategory(e.target.value)}
                >
                    <option value="">Todas as categorias</option>
                    {options.map((name) => (
                        <option key={name} value={name}>
                            {name}
                        </option>
                    ))}
                </select>
            </div>
        </FilterDrawer>
    );
}