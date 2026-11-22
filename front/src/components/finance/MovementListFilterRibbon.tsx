import { useMemo } from 'react';
import { MaterialIcon } from '../icons/MaterialIcon';
import { DateRangePicker } from '../ui/date-picker';
import { useFinanceData } from '../../app/FinanceDataProvider';
import { useCategories } from '../../hooks/useCategories';
import { useMovementListFilters } from '../../frentes/dinheiro/context/MovementListFiltersContext';
import { RibbonIconPopover } from './RibbonIconPopover';
import type { GainSortKey, SortDir } from '../../hooks/useMovementSort';
import type { GainsLedgerViewMode } from '../../hooks/useGainsLedgerViewMode';
import type { ExpensesLedgerViewMode } from '../../hooks/useExpensesLedgerViewMode';
import type { ExpenseSortKey } from '../../hooks/useMovementSort';
import { buildMovementListAccountFilterOptions } from '../../lib/movementListAccountFilter';

type MapStatusProps = {
    paidLabel: string;
    unpaidLabel: string;
};

export type GainsLedgerRibbonControls = {
    sortKey: GainSortKey;
    sortDir: SortDir;
    onSelectSort: (key: GainSortKey) => void;
    viewMode: GainsLedgerViewMode;
    onViewModeChange: (mode: GainsLedgerViewMode) => void;
};

const GAIN_SORT_OPTIONS: { key: GainSortKey; label: string }[] = [
    { key: 'date', label: 'Data' },
    { key: 'description', label: 'Descrição' },
    { key: 'category', label: 'Categoria' },
    { key: 'account', label: 'Conta' },
    { key: 'amount', label: 'Valor' },
    { key: 'received', label: 'Status (recebido)' }
];

const EXPENSE_SORT_OPTIONS: { key: ExpenseSortKey; label: string }[] = [
    { key: 'date', label: 'Data' },
    { key: 'description', label: 'Descrição' },
    { key: 'category', label: 'Categoria' },
    { key: 'account', label: 'Conta' },
    { key: 'amount', label: 'Valor' },
    { key: 'status', label: 'Status (pago)' }
];

export type ExpensesLedgerRibbonControls = {
    sortKey: ExpenseSortKey;
    sortDir: SortDir;
    onSelectSort: (key: ExpenseSortKey) => void;
    viewMode: ExpensesLedgerViewMode;
    onViewModeChange: (mode: ExpensesLedgerViewMode) => void;
};

type Props = {
    kind: 'gain' | 'expense';
    tone: 'gains' | 'expenses';
    mapStatus?: MapStatusProps;
    gainsLedgerControls?: GainsLedgerRibbonControls;
    expensesLedgerControls?: ExpensesLedgerRibbonControls;
};

function hasActiveFilters(
    searchQ: string,
    filters: {
        category: string;
        accountId: string;
        amountMin: string;
        amountMax: string;
        dateFrom: string;
        dateTo: string;
    },
    dateManual: boolean
): boolean {
    return Boolean(
        searchQ.trim() ||
            filters.category ||
            filters.accountId ||
            filters.amountMin ||
            filters.amountMax ||
            filters.dateFrom ||
            filters.dateTo ||
            dateManual
    );
}

export function MovementListFilterRibbon({
    kind,
    tone,
    mapStatus,
    gainsLedgerControls,
    expensesLedgerControls
}: Props) {
    const ctx = useMovementListFilters();
    const { data } = useFinanceData();
    const { categories } = useCategories(kind);
    const accountOptions = useMemo(
        () => buildMovementListAccountFilterOptions(data?.userAccounts ?? []),
        [data?.userAccounts]
    );

    const searchId = kind === 'gain' ? 'gains-filter-q' : 'expenses-filter-q';
    const ribbonId = kind === 'gain' ? 'gains-filter-ribbon' : 'expenses-filter-ribbon';
    const active = useMemo(
        () =>
            ctx ? hasActiveFilters(ctx.searchQ, ctx.filters, ctx.dateManual) : false,
        [ctx, ctx?.searchQ, ctx?.filters, ctx?.dateManual]
    );

    if (!ctx) return null;

    const status = tone === 'gains' ? ctx.gainsStatus : ctx.expensesStatus;
    const setPaid = tone === 'gains' ? ctx.setGainsStatusPaid : ctx.setExpensesStatusPaid;
    const setUnpaid = tone === 'gains' ? ctx.setGainsStatusUnpaid : ctx.setExpensesStatusUnpaid;
    const paid = !!status?.paid;
    const unpaid = !!status?.unpaid;

    return (
        <section
            id={ribbonId}
            className="movement-filter-ribbon"
            data-filter-tone={tone}
            aria-label={kind === 'gain' ? 'Filtros da lista de entradas' : 'Filtros da lista de saídas'}
        >
            <div className="movement-filter-ribbon__track">
                <div className="movement-filter-ribbon__group movement-filter-ribbon__group--grow">
                    <label className="sr-only" htmlFor={searchId}>
                        Busca por descrição, categoria, conta ou valor
                    </label>
                    <MaterialIcon name="search" variant="app" className="movement-filter-ribbon__glyph" />
                    <input
                        type="search"
                        id={searchId}
                        className="movement-filter-ribbon__control movement-filter-ribbon__control--bare"
                        placeholder="Buscar descrição, categoria, conta, valor…"
                        autoComplete="off"
                        value={ctx.searchQ}
                        onChange={(e) => ctx.setSearchQ(e.target.value)}
                    />
                </div>

                <div className="movement-filter-ribbon__group">
                    <MaterialIcon name="sell" variant="app" className="movement-filter-ribbon__glyph" />
                    <select
                        id={`${ribbonId}-category`}
                        className="movement-filter-ribbon__control movement-filter-ribbon__control--select"
                        aria-label="Categoria"
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

                <div className="movement-filter-ribbon__group">
                    <MaterialIcon name="account_balance_wallet" variant="app" className="movement-filter-ribbon__glyph" />
                    <select
                        id={`${ribbonId}-account`}
                        className="movement-filter-ribbon__control movement-filter-ribbon__control--select"
                        aria-label="Conta"
                        value={ctx.filters.accountId}
                        onChange={(e) => ctx.setFilter('accountId', e.target.value)}
                    >
                        <option value="">Todas</option>
                        {accountOptions.map((a) => (
                            <option key={a.value} value={a.value}>
                                {a.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="movement-filter-ribbon__group movement-filter-ribbon__group--period">
                    <DateRangePicker
                        id={`${ribbonId}-period`}
                        from={ctx.filters.dateFrom}
                        to={ctx.filters.dateTo}
                        placeholder="Período"
                        onChange={(from, to) => {
                            ctx.setDateManual(true);
                            ctx.setFilter('dateFrom', from);
                            ctx.setFilter('dateTo', to);
                        }}
                    />
                </div>

                {active ? (
                    <button
                        type="button"
                        className="movement-filter-ribbon__clear"
                        title="Limpar filtros"
                        onClick={() => {
                            ctx.clearDrawerFilters();
                            ctx.clearDateManual();
                        }}
                    >
                        <MaterialIcon name="filter_alt_off" variant="app" opticalSize={18} />
                        <span className="movement-filter-ribbon__clear-text">Limpar</span>
                    </button>
                ) : null}

                {mapStatus || gainsLedgerControls || expensesLedgerControls ? (
                    <div className="movement-filter-ribbon__trailing">
                        {mapStatus ? (
                            <>
                                <span className="movement-filter-ribbon__divider" aria-hidden />
                                <div
                                    className="movement-filter-ribbon__status"
                                    data-treemap-toolbar-accent={tone}
                                    role="group"
                                    aria-label="Status na lista"
                                >
                                    <div className="movement-status-pills">
                                        <button
                                            type="button"
                                            className={`movement-status-pill${paid ? ' is-on' : ''}`}
                                            aria-pressed={paid}
                                            onClick={() => setPaid(!paid)}
                                        >
                                            <MaterialIcon
                                                name="task_alt"
                                                variant="app"
                                                opticalSize={17}
                                                filled={paid}
                                            />
                                            {mapStatus.paidLabel}
                                        </button>
                                        <button
                                            type="button"
                                            className={`movement-status-pill${unpaid ? ' is-on' : ''}`}
                                            aria-pressed={unpaid}
                                            onClick={() => setUnpaid(!unpaid)}
                                        >
                                            <MaterialIcon name="schedule" variant="app" opticalSize={17} filled={unpaid} />
                                            {mapStatus.unpaidLabel}
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : null}

                        {gainsLedgerControls ? (
                            <LedgerTools
                                tone={tone}
                                sortLabel="Ordenar extrato de entradas"
                                viewLabel="Modo de visualização do extrato"
                                sortOptions={GAIN_SORT_OPTIONS}
                                sortKey={gainsLedgerControls.sortKey}
                                sortDir={gainsLedgerControls.sortDir}
                                onSelectSort={(key) => gainsLedgerControls.onSelectSort(key as GainSortKey)}
                                viewMode={gainsLedgerControls.viewMode}
                                onViewModeChange={gainsLedgerControls.onViewModeChange}
                            />
                        ) : null}
                        {expensesLedgerControls ? (
                            <LedgerTools
                                tone={tone}
                                sortLabel="Ordenar extrato de saídas"
                                viewLabel="Modo de visualização do extrato"
                                sortOptions={EXPENSE_SORT_OPTIONS}
                                sortKey={expensesLedgerControls.sortKey}
                                sortDir={expensesLedgerControls.sortDir}
                                onSelectSort={(key) => expensesLedgerControls.onSelectSort(key as ExpenseSortKey)}
                                viewMode={expensesLedgerControls.viewMode}
                                onViewModeChange={expensesLedgerControls.onViewModeChange}
                            />
                        ) : null}
                    </div>
                ) : null}
            </div>
        </section>
    );
}

type LedgerToolsProps<T extends string> = {
    tone: 'gains' | 'expenses';
    sortLabel: string;
    viewLabel: string;
    sortOptions: { key: T; label: string }[];
    sortKey: T;
    sortDir: SortDir;
    onSelectSort: (key: T) => void;
    viewMode: GainsLedgerViewMode | ExpensesLedgerViewMode;
    onViewModeChange: (mode: GainsLedgerViewMode | ExpensesLedgerViewMode) => void;
};

function LedgerTools<T extends string>({
    tone,
    sortLabel,
    viewLabel,
    sortOptions,
    sortKey,
    sortDir,
    onSelectSort,
    viewMode,
    onViewModeChange
}: LedgerToolsProps<T>) {
    return (
        <div
            className="movement-filter-ribbon__ledger-tools"
            data-treemap-toolbar-accent={tone}
            role="group"
            aria-label="Ordenação e visualização do extrato"
        >
            <RibbonIconPopover icon="swap_vert" title="Ordenar extrato" ariaLabel={sortLabel}>
                {(close) => (
                    <>
                        <p className="movement-filter-ribbon__popover-title">Ordenar por</p>
                        <ul className="movement-filter-ribbon__menu">
                            {sortOptions.map((opt) => {
                                const active = sortKey === opt.key;
                                return (
                                    <li key={opt.key}>
                                        <button
                                            type="button"
                                            role="menuitemradio"
                                            className={`movement-filter-ribbon__menu-item${active ? ' is-active' : ''}`}
                                            aria-checked={active}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => {
                                                onSelectSort(opt.key);
                                                close();
                                            }}
                                        >
                                            <span>{opt.label}</span>
                                            {active ? (
                                                <MaterialIcon
                                                    name={sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                                                    variant="app"
                                                    opticalSize={16}
                                                />
                                            ) : null}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </RibbonIconPopover>
            <RibbonIconPopover icon="visibility" title="Modo de visualização" ariaLabel={viewLabel}>
                {(close) => (
                    <>
                        <p className="movement-filter-ribbon__popover-title">Visualizar como</p>
                        <ul className="movement-filter-ribbon__menu">
                            <li>
                                <button
                                    type="button"
                                    role="menuitemradio"
                                    className={`movement-filter-ribbon__menu-item${
                                        viewMode === 'simple' ? ' is-active' : ''
                                    }`}
                                    aria-checked={viewMode === 'simple'}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        onViewModeChange('simple');
                                        close();
                                    }}
                                >
                                    <MaterialIcon name="view_list" variant="app" opticalSize={18} />
                                    <span>Modo simples</span>
                                </button>
                            </li>
                            <li>
                                <button
                                    type="button"
                                    role="menuitemradio"
                                    className={`movement-filter-ribbon__menu-item${
                                        viewMode === 'split' ? ' is-active' : ''
                                    }`}
                                    aria-checked={viewMode === 'split'}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        onViewModeChange('split');
                                        close();
                                    }}
                                >
                                    <MaterialIcon name="view_column" variant="app" opticalSize={18} />
                                    <span>Modo personalizado (abas)</span>
                                </button>
                            </li>
                        </ul>
                    </>
                )}
            </RibbonIconPopover>
        </div>
    );
}