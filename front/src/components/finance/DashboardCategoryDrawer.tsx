import { useMemo } from 'react';
import { useFinanceData } from '../../app/FinanceDataProvider';
import { useCategories } from '../../hooks/useCategories';
import { useDashboardFacets } from '../../frentes/dinheiro/dashboard/DashboardFacetsContext';
import { FilterDrawer } from './FilterDrawer';
import { MaterialIcon } from '../icons/MaterialIcon';

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

    const selected = ctx.expenseCategories;

    return (
        <FilterDrawer
            id="dashboard-filter-drawer"
            title="Categorias do painel"
            open={ctx.drawerOpen}
            onClose={() => ctx.setDrawerOpen(false)}
            footer={
                <button type="button" id="dashboard-filter-clear" className="btn-secondary" onClick={ctx.clearExpenseCategories}>
                    Limpar seleção
                </button>
            }
        >
            <p className="card-metric-hint" style={{ margin: '0 0 1rem' }}>
                Escolha uma ou mais categorias. Afeta totais e gráficos do mês selecionado.
            </p>
            <ul className="dashboard-category-multi__list dashboard-category-multi__list--drawer">
                {options.map((name) => {
                    const on = selected.has(name);
                    return (
                        <li key={name}>
                            <button
                                type="button"
                                className={`dashboard-category-multi__option${on ? ' is-on' : ''}`}
                                onClick={() => ctx.toggleExpenseCategory(name)}
                            >
                                <span className={`dashboard-category-multi__check${on ? ' is-on' : ''}`} aria-hidden>
                                    {on ? <MaterialIcon name="check" variant="app" opticalSize={16} /> : null}
                                </span>
                                <span className="dashboard-category-multi__option-label">{name}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </FilterDrawer>
    );
}