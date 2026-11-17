import { MaterialIcon } from '../../icons/MaterialIcon';
import { useMovementListFilters } from '../../../frentes/dinheiro/context/MovementListFiltersContext';

type Props = {
    hidden: boolean;
    id: string;
    ariaLabel: string;
    paidLabel: string;
    unpaidLabel: string;
    /** `gains` | `expenses` — cores dos chips ativos (legado). */
    tone: 'gains' | 'expenses';
};

function statusChipClass(active: boolean) {
    return `page-toolbar__chip quick-filter-btn header-quick-filter-btn header-quick-filter-btn--ghost${active ? ' active' : ''}`;
}

export function MovementFacetHeaderActions({ hidden, id, ariaLabel, paidLabel, unpaidLabel, tone }: Props) {
    const ctx = useMovementListFilters();
    if (hidden) return null;

    const status = tone === 'gains' ? ctx?.gainsStatus : ctx?.expensesStatus;
    const setPaid = tone === 'gains' ? ctx?.setGainsStatusPaid : ctx?.setExpensesStatusPaid;
    const setUnpaid = tone === 'gains' ? ctx?.setGainsStatusUnpaid : ctx?.setExpensesStatusUnpaid;

    return (
        <div
            id={id}
            className="page-toolbar header-page-actions"
            data-toolbar-accent={tone}
            aria-label={ariaLabel}
        >
            <div className="page-toolbar__cluster" role="group" data-tone={tone}>
                <button
                    type="button"
                    className={statusChipClass(!!status?.paid)}
                    data-quick-kind="status"
                    data-filter="paid"
                    aria-pressed={status?.paid ? 'true' : 'false'}
                    title={`Somente ${paidLabel.toLowerCase()} — pode combinar com ${unpaidLabel}`}
                    onClick={() => setPaid?.(!status?.paid)}
                >
                    {paidLabel}
                </button>
                <button
                    type="button"
                    className={statusChipClass(!!status?.unpaid)}
                    data-quick-kind="status"
                    data-filter="unpaid"
                    aria-pressed={status?.unpaid ? 'true' : 'false'}
                    title={`Somente ${unpaidLabel.toLowerCase()} — pode combinar com ${paidLabel}`}
                    onClick={() => setUnpaid?.(!status?.unpaid)}
                >
                    {unpaidLabel}
                </button>
            </div>
            <div className="page-toolbar__tools">
                <button
                    type="button"
                    className="page-toolbar__icon btn-secondary filter-drawer-trigger header-action-btn header-action-btn--icon"
                    aria-expanded={ctx?.drawerOpen ?? false}
                    aria-label="Filtros avançados"
                    title="Categoria, conta, valor e datas"
                    onClick={() => ctx?.setDrawerOpen(true)}
                >
                    <MaterialIcon name="tune" variant="app" />
                    <span className="sr-only">Filtros</span>
                </button>
                {ctx?.headerAddAction ? (
                    <button
                        type="button"
                        id={ctx.headerAddAction.id}
                        className="page-toolbar__cta btn-primary header-action-btn"
                        onClick={ctx.headerAddAction.onClick}
                    >
                        <MaterialIcon name="add" variant="app" />
                        Nova
                    </button>
                ) : null}
            </div>
        </div>
    );
}