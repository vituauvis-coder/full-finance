import type { ReactNode } from 'react';
import type { Movement } from '../../lib/types/finance';
import { DataTable } from '../ui/DataTable';
import { buildMovementTableColumns, type MovementSortKey } from './movementTableColumns';

export type { MovementSortKey };

type Props = {
    rows: Movement[];
    currency: string;
    idPrefix: 'gains' | 'expenses';
    accountLabel: (accountId?: string) => string;
    statusLabel: (m: Movement) => string;
    onToggleStatus?: (m: Movement) => void;
    statusToggleBusy?: (id: string) => boolean;
    onEdit?: (m: Movement) => void;
    onDelete?: (m: Movement) => void;
    selectedIds?: Set<string>;
    onToggleRow?: (id: string) => void;
    onTogglePage?: (checked: boolean) => void;
    sortKey?: MovementSortKey;
    sortDir?: 'asc' | 'desc';
    onSort?: (key: MovementSortKey) => void;
    renderRowActions?: (m: Movement) => ReactNode;
    emptyMessage?: string;
};

export function MovementsTable({
    rows,
    currency,
    idPrefix,
    accountLabel,
    statusLabel,
    onToggleStatus,
    statusToggleBusy,
    onEdit,
    onDelete,
    selectedIds,
    onToggleRow,
    onTogglePage,
    sortKey,
    sortDir,
    onSort,
    renderRowActions,
    emptyMessage
}: Props) {
    const columns = buildMovementTableColumns(
        idPrefix === 'gains'
            ? {
                  kind: 'gain',
                  prefix: 'gains',
                  currency,
                  accountLabel,
                  statusLabel,
                  onToggleStatus,
                  statusToggleBusy,
                  onEdit,
                  onDelete
              }
            : {
                  kind: 'expense',
                  prefix: 'expenses',
                  currency,
                  accountLabel,
                  statusLabel,
                  onToggleStatus,
                  statusToggleBusy,
                  onEdit,
                  onDelete,
                  extraActions: renderRowActions
              }
    );

    const selection =
        selectedIds && onToggleRow && onTogglePage
            ? {
                  selectedIds,
                  getRowId: (row: unknown) => (row as Movement).id,
                  onToggleRow,
                  onTogglePage,
                  batchTone: (idPrefix === 'gains' ? 'gain' : 'expense') as 'gain' | 'expense'
              }
            : undefined;

    const sort =
        sortKey && sortDir && onSort
            ? {
                  key: sortKey,
                  dir: sortDir,
                  onSort: (key: string) => onSort(key as MovementSortKey)
              }
            : undefined;

    return (
        <DataTable
            tableId={`${idPrefix}-table`}
            rows={rows}
            columns={columns}
            getRowKey={(m) => m.id}
            emptyMessage={emptyMessage ?? 'Nenhum movimento neste período.'}
            selection={selection}
            sort={sort}
        />
    );
}