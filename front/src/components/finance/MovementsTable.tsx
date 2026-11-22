import type { ReactNode } from 'react';
import type { Account, ExpenseSplitRequest, Movement, UserProfile } from '../../lib/types/finance';
import type { InstallmentListPeriod } from '../../frentes/dinheiro/domain/expenseInstallmentLabel';
import { DataTable } from '../ui/DataTable';
import { buildMovementTableColumns, type MovementSortKey } from './movementTableColumns';

export type { MovementSortKey };

type Props = {
    rows: Movement[];
    currency: string;
    idPrefix: 'gains' | 'expenses';
    expenseAccounts?: Account[];
    allExpenses?: Movement[];
    acceptedSplits?: ExpenseSplitRequest[];
    userProfile?: UserProfile | null;
    listPeriod?: InstallmentListPeriod | null;
    expenseDisplayDate?: (m: Movement) => Date;
    accountLabel: (accountId?: string) => string;
    statusLabel: (m: Movement) => string;
    onToggleStatus?: (m: Movement) => void;
    statusToggleBusy?: (id: string) => boolean;
    onSplit?: (m: Movement) => void;
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
    /** Lista mais enxuta para o extrato em duas colunas. */
    layout?: 'default' | 'split';
    /** Id único da `<table>` (evita duplicata no modo split). */
    tableId?: string;
    onRowClick?: (m: Movement) => void;
    rowClassName?: string | ((m: Movement) => string | undefined);
};

const SPLIT_GAIN_COLUMNS = new Set(['date', 'description', 'amount', 'status', 'actions']);

export function MovementsTable({
    rows,
    currency,
    idPrefix,
    accountLabel,
    statusLabel,
    onToggleStatus,
    statusToggleBusy,
    onSplit,
    onEdit,
    onDelete,
    selectedIds,
    onToggleRow,
    onTogglePage,
    sortKey,
    sortDir,
    onSort,
    renderRowActions,
    emptyMessage,
    expenseAccounts,
    allExpenses,
    acceptedSplits,
    userProfile,
    listPeriod,
    expenseDisplayDate,
    layout = 'default',
    tableId,
    onRowClick,
    rowClassName
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
                  accounts: expenseAccounts,
                  allExpenses,
                  acceptedSplits,
                  userProfile,
                  listPeriod,
                  expenseDisplayDate,
                  accountLabel,
                  statusLabel,
                  onToggleStatus,
                  statusToggleBusy,
                  onSplit,
                  onEdit,
                  onDelete,
                  extraActions: renderRowActions
              }
    );

    const visibleColumns =
        layout === 'split' && idPrefix === 'gains'
            ? columns
                  .filter((c) => SPLIT_GAIN_COLUMNS.has(c.id))
                  .map((c) => {
                      if (c.id === 'date') {
                          return { ...c, headerClassName: 'gains-split-th gains-split-th--date' };
                      }
                      if (c.id === 'description') {
                          return {
                              ...c,
                              headerClassName: 'gains-split-th gains-split-th--desc'
                          };
                      }
                      if (c.id === 'actions') {
                          return {
                              ...c,
                              header: <span className="sr-only">Ações</span>,
                              headerClassName: 'data-table__th--actions gains-split-th gains-split-th--actions'
                          };
                      }
                      return c;
                  })
            : columns;

    const splitColGroup =
        layout === 'split' && idPrefix === 'gains' ? (
            <colgroup>
                <col className="gains-split-col gains-split-col--batch" style={{ width: '1.65rem' }} />
                <col className="gains-split-col gains-split-col--date" style={{ width: '4.35rem' }} />
                <col className="gains-split-col gains-split-col--desc" />
                <col className="gains-split-col gains-split-col--amount" style={{ width: '5.35rem' }} />
                <col className="gains-split-col gains-split-col--status" style={{ width: '4.65rem' }} />
                <col className="gains-split-col gains-split-col--actions" style={{ width: '4.15rem' }} />
            </colgroup>
        ) : undefined;

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
            tableId={tableId ?? `${idPrefix}-table`}
            rows={rows}
            columns={visibleColumns}
            getRowKey={(m) => m.id}
            emptyMessage={emptyMessage ?? 'Nenhum movimento neste período.'}
            selection={selection}
            sort={sort}
            className={layout === 'split' ? 'data-table-host--split-pane' : undefined}
            tableClassName={layout === 'split' ? 'data-table--split-pane' : undefined}
            colGroup={splitColGroup}
            onRowClick={onRowClick}
            rowClassName={rowClassName}
        />
    );
}