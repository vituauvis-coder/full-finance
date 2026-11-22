import { useMovementListFilters } from '../context/MovementListFiltersContext';

type Props = {
    tone: 'gains' | 'expenses';
    paidLabel: string;
    unpaidLabel: string;
};

function statusBtnClass(active: boolean) {
    return `chart-type-btn${active ? ' is-active' : ''}`;
}

/** Filtros que afetam o mapa (recebe o mesmo dado do treemap e dos cards). */
export function MovementTreemapChartToolbar({ tone, paidLabel, unpaidLabel }: Props) {
    const ctx = useMovementListFilters();
    const status = tone === 'gains' ? ctx?.gainsStatus : ctx?.expensesStatus;
    const setPaid = tone === 'gains' ? ctx?.setGainsStatusPaid : ctx?.setExpensesStatusPaid;
    const setUnpaid = tone === 'gains' ? ctx?.setGainsStatusUnpaid : ctx?.setExpensesStatusUnpaid;

    const paid = !!status?.paid;
    const unpaid = !!status?.unpaid;

    return (
        <div className="movement-treemap__footer" data-treemap-toolbar-accent={tone}>
            <p className="movement-treemap__footer-label">Filtros do mapa</p>
            <div className="movement-treemap__footer-actions">
                <div className="chart-type-toggle" role="group" aria-label="Status exibido no mapa de categorias">
                    <button
                        type="button"
                        className={statusBtnClass(paid)}
                        aria-pressed={paid}
                        title={`Somente ${paidLabel.toLowerCase()} — pode combinar com ${unpaidLabel}`}
                        onClick={() => setPaid?.(!paid)}
                    >
                        {paidLabel}
                    </button>
                    <button
                        type="button"
                        className={statusBtnClass(unpaid)}
                        aria-pressed={unpaid}
                        title={`Somente ${unpaidLabel.toLowerCase()} — pode combinar com ${paidLabel}`}
                        onClick={() => setUnpaid?.(!unpaid)}
                    >
                        {unpaidLabel}
                    </button>
                </div>
                <div className="chart-type-toggle" role="group" aria-label="Tipo de visualização">
                    <button
                        type="button"
                        className="chart-type-btn is-active"
                        aria-pressed="true"
                        disabled
                        title="Mapa por categoria"
                    >
                        Mapa
                    </button>
                </div>
            </div>
        </div>
    );
}