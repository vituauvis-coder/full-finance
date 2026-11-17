import { useFinanceData } from '../../app/FinanceDataProvider';
import { useCategories } from '../../hooks/useCategories';
import { useMovementListFilters } from '../../frentes/dinheiro/context/MovementListFiltersContext';
import { FilterDrawer } from './FilterDrawer';

type Props = {
    id: string;
    title: string;
    kind: 'gain' | 'expense';
};

export function MovementListFilterDrawer({ id, title, kind }: Props) {
    const ctx = useMovementListFilters();
    const { data } = useFinanceData();
    const { categories } = useCategories(kind);

    if (!ctx) return null;

    return (
        <FilterDrawer
            id={id}
            title={title}
            open={ctx.drawerOpen}
            onClose={() => ctx.setDrawerOpen(false)}
            footer={
                <button type="button" className="btn-secondary" onClick={ctx.clearDrawerFilters}>
                    Limpar filtros
                </button>
            }
        >
            <div className="filter-drawer-field">
                <label htmlFor={kind === 'gain' ? 'gains-filter-q' : 'expenses-filter-q'}>
                    Busca (descrição, categoria, conta, valor…)
                </label>
                <div className="table-filters__search">
                    <i className="fas fa-search" aria-hidden="true"></i>
                    <input
                        type="search"
                        id={kind === 'gain' ? 'gains-filter-q' : 'expenses-filter-q'}
                        placeholder="Digite para filtrar…"
                        autoComplete="off"
                        aria-label={kind === 'gain' ? 'Buscar entradas' : 'Buscar saídas'}
                        value={ctx.searchQ}
                        onChange={(e) => ctx.setSearchQ(e.target.value)}
                    />
                </div>
            </div>
            <div className="filter-drawer-field">
                <label htmlFor={`${id}-category`}>Categoria</label>
                <select
                    id={`${id}-category`}
                    value={ctx.filters.category}
                    onChange={(e) => ctx.setFilter('category', e.target.value)}
                >
                    <option value="">Todas</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                            {c.name}
                        </option>
                    ))}
                </select>
            </div>
            <div className="filter-drawer-field">
                <label htmlFor={`${id}-account`}>Conta</label>
                <select
                    id={`${id}-account`}
                    value={ctx.filters.accountId}
                    onChange={(e) => ctx.setFilter('accountId', e.target.value)}
                >
                    <option value="">Todas</option>
                    {(data?.userAccounts ?? []).map((a) => (
                        <option key={a.id} value={a.id}>
                            {a.name}
                        </option>
                    ))}
                </select>
            </div>
            <div className="filter-drawer-field">
                <label htmlFor={`${id}-date-from`}>Data inicial</label>
                <input
                    id={`${id}-date-from`}
                    type="date"
                    value={ctx.filters.dateFrom}
                    onChange={(e) => {
                        ctx.setDateManual(true);
                        ctx.setFilter('dateFrom', e.target.value);
                    }}
                />
            </div>
            <div className="filter-drawer-field">
                <label htmlFor={`${id}-date-to`}>Data final</label>
                <input
                    id={`${id}-date-to`}
                    type="date"
                    value={ctx.filters.dateTo}
                    onChange={(e) => {
                        ctx.setDateManual(true);
                        ctx.setFilter('dateTo', e.target.value);
                    }}
                />
            </div>
            <div className="filter-drawer-field">
                <label htmlFor={`${id}-amount-min`}>Valor mínimo</label>
                <input
                    id={`${id}-amount-min`}
                    type="number"
                    step="0.01"
                    value={ctx.filters.amountMin}
                    onChange={(e) => ctx.setFilter('amountMin', e.target.value)}
                />
            </div>
            <div className="filter-drawer-field">
                <label htmlFor={`${id}-amount-max`}>Valor máximo</label>
                <input
                    id={`${id}-amount-max`}
                    type="number"
                    step="0.01"
                    value={ctx.filters.amountMax}
                    onChange={(e) => ctx.setFilter('amountMax', e.target.value)}
                />
            </div>
        </FilterDrawer>
    );
}