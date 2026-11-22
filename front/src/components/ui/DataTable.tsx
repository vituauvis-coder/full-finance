import type { ReactNode } from 'react';
import { MovementStatusBadge, type MovementStatusKind } from './MovementStatusBadge';

export type DataTableColumn<T> = {
    id: string;
    header: ReactNode;
    /** Se definido, a coluna participa da ordenação. */
    sortKey?: string;
    align?: 'left' | 'center' | 'right';
    headerClassName?: string;
    cellClassName?: string | ((row: T) => string | undefined);
    render: (row: T, rowIndex: number) => ReactNode;
};

export type DataTableSortState = {
    key: string;
    dir: 'asc' | 'desc';
    onSort: (key: string) => void;
};

export type DataTableSelection = {
    selectedIds: Set<string>;
    getRowId: (row: unknown) => string;
    onToggleRow: (id: string) => void;
    onTogglePage: (checked: boolean) => void;
    /** Classes legado: `gain-batch-*` / `expense-batch-*`. */
    batchTone: 'gain' | 'expense';
};

type Props<T> = {
    tableId: string;
    rows: T[];
    columns: DataTableColumn<T>[];
    emptyMessage?: string;
    className?: string;
    tableClassName?: string;
    sort?: DataTableSortState;
    selection?: DataTableSelection;
    getRowKey: (row: T) => string;
    colGroup?: ReactNode;
    onRowClick?: (row: T) => void;
    rowClassName?: string | ((row: T) => string | undefined);
};

export function DataTable<T>({
    tableId,
    rows,
    columns,
    emptyMessage = 'Nenhum registro.',
    className = '',
    tableClassName = '',
    sort,
    selection,
    getRowKey,
    colGroup,
    onRowClick,
    rowClassName
}: Props<T>) {
    const batchPrefix = selection?.batchTone ?? 'gain';
    const batchCheckClass = `${batchPrefix}-batch-check`;
    const batchAllClass = `${batchPrefix}-batch-check-all`;
    const batchThClass = batchPrefix === 'gain' ? 'gains-th-batch' : 'expenses-th-batch';
    const batchTdClass = batchPrefix === 'gain' ? 'gains-td-batch' : 'expenses-td-batch';

    const pageAllSelected =
        Boolean(selection) && rows.length > 0 && rows.every((r) => selection!.selectedIds.has(selection!.getRowId(r)));

    const colCount = columns.length + (selection ? 1 : 0);

    return (
        <div className={`table-container data-table-host${className ? ` ${className}` : ''}`}>
            <table id={tableId} className={`data-table${tableClassName ? ` ${tableClassName}` : ''}`}>
                {colGroup}
                <thead>
                    <tr>
                        {selection ? (
                            <th scope="col" className={batchThClass}>
                                <label className={`${batchPrefix}-batch-head-hit`} title="Selecionar linhas visíveis">
                                    <span className="sr-only">Selecionar página</span>
                                    <input
                                        type="checkbox"
                                        className={`${batchCheckClass} ${batchAllClass}`}
                                        checked={pageAllSelected}
                                        onChange={(e) => selection.onTogglePage(e.target.checked)}
                                    />
                                </label>
                            </th>
                        ) : null}
                        {columns.map((col) => {
                            const sortable = Boolean(col.sortKey && sort);
                            const sortActive = sortable && sort!.key === col.sortKey;
                            return (
                                <th
                                    key={col.id}
                                    scope="col"
                                    className={[
                                        col.headerClassName,
                                        sortable ? 'sortable-th' : '',
                                        sortActive ? 'sortable-th--active' : '',
                                        col.align === 'right' ? 'data-table__th--right' : '',
                                        col.align === 'center' ? 'data-table__th--center' : ''
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                >
                                    {sortable ? (
                                        <SortableHeader
                                            label={col.header}
                                            sortKey={col.sortKey!}
                                            activeKey={sort!.key}
                                            dir={sort!.dir}
                                            align={col.align}
                                            onSort={sort!.onSort}
                                        />
                                    ) : (
                                        <span className="data-table__th-label">{col.header}</span>
                                    )}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={colCount} className="data-table__empty">
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        rows.map((row, rowIndex) => {
                            const rowId = getRowKey(row);
                            const selected = selection?.selectedIds.has(rowId) ?? false;
                            const extraRowClass =
                                typeof rowClassName === 'function' ? rowClassName(row) : rowClassName;
                            return (
                                <tr
                                    key={rowId}
                                    className={[
                                        selected ? 'data-table__row--selected' : '',
                                        onRowClick ? 'data-table__row--clickable' : '',
                                        extraRowClass
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                    onClick={
                                        onRowClick
                                            ? (e) => {
                                                  const target = e.target as HTMLElement;
                                                  if (target.closest('button, a, input, label')) return;
                                                  onRowClick(row);
                                              }
                                            : undefined
                                    }
                                >
                                    {selection ? (
                                        <td className={batchTdClass}>
                                            <input
                                                type="checkbox"
                                                className={batchCheckClass}
                                                checked={selected}
                                                aria-label={`Selecionar linha ${rowIndex + 1}`}
                                                onChange={() => selection.onToggleRow(rowId)}
                                            />
                                        </td>
                                    ) : null}
                                    {columns.map((col) => {
                                        const extra =
                                            typeof col.cellClassName === 'function'
                                                ? col.cellClassName(row)
                                                : col.cellClassName;
                                        return (
                                            <td
                                                key={col.id}
                                                className={[
                                                    extra,
                                                    col.align === 'right' ? 'data-table__td--right' : '',
                                                    col.align === 'center' ? 'data-table__td--center' : ''
                                                ]
                                                    .filter(Boolean)
                                                    .join(' ')}
                                            >
                                                {col.render(row, rowIndex)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}

function SortableHeader({
    label,
    sortKey,
    activeKey,
    dir,
    align,
    onSort
}: {
    label: ReactNode;
    sortKey: string;
    activeKey: string;
    dir: 'asc' | 'desc';
    align?: 'left' | 'center' | 'right';
    onSort: (key: string) => void;
}) {
    const active = activeKey === sortKey;
    const alignClass =
        align === 'right'
            ? 'data-table__sort-btn--right'
            : align === 'center'
              ? 'data-table__sort-btn--center'
              : '';
    return (
        <button
            type="button"
            className={['sortable-th__btn data-table__sort-btn', alignClass].filter(Boolean).join(' ')}
            onClick={() => onSort(sortKey)}
            aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
            <span className="data-table__th-label">{label}</span>
            {active ? (
                <span className="sortable-th__icon data-table__sort-icon" aria-hidden="true">
                    {dir === 'asc' ? '↑' : '↓'}
                </span>
            ) : null}
        </button>
    );
}

export type StatusTone = 'gain-paid' | 'gain-pending' | 'expense-paid' | 'expense-pending';

function toneToKindAndPaid(tone: StatusTone): { kind: MovementStatusKind; paid: boolean } {
    return {
        kind: tone.startsWith('gain') ? 'gain' : 'expense',
        paid: tone.endsWith('-paid')
    };
}

type DataTableStatusPillProps = {
    tone: StatusTone;
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
    ariaLabel?: string;
};

/** @deprecated Prefer `MovementStatusBadge` for novas telas. */
export function DataTableStatusPill({ tone, children, onClick, disabled, title, ariaLabel }: DataTableStatusPillProps) {
    const { kind, paid } = toneToKindAndPaid(tone);
    return (
        <MovementStatusBadge
            kind={kind}
            paid={paid}
            onClick={onClick}
            disabled={disabled}
            title={title}
            ariaLabel={ariaLabel}
        >
            {children}
        </MovementStatusBadge>
    );
}

export { MovementStatusBadge };

/** Wrapper interno para coluna de ações (dentro do `<td className="transaction-actions">`). */
export function DataTableActionsInner({ children }: { children: ReactNode }) {
    return <div className="transaction-actions__inner">{children}</div>;
}