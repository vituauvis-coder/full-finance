import { useState } from 'react';
import { MovementsTable } from '../../../components/finance/MovementsTable';
import { TablePaginationBar } from '../../../components/finance/TablePaginationBar';
import { useTablePagination } from '../../../hooks/useTablePagination';
import type { GainSortKey, SortDir } from '../../../hooks/useMovementSort';
import type { Movement } from '../../../lib/types/finance';

type TabKey = 'category' | 'estorno';

const TAB_STORAGE_KEY = 'gains-ledger-active-tab';

function readStoredTab(): TabKey {
    try {
        const v = localStorage.getItem(TAB_STORAGE_KEY);
        if (v === 'category' || v === 'estorno') return v;
    } catch {
        /* ignore */
    }
    return 'category';
}

type Props = {
    categoryRows: Movement[];
    estornoRows: Movement[];
    currency: string;
    accountLabel: (accountId?: string) => string;
    statusLabel: (m: Movement) => string;
    onToggleStatus?: (m: Movement) => void;
    statusToggleBusy?: (id: string) => boolean;
    selectedIds?: Set<string>;
    onToggleRow?: (id: string) => void;
    onEdit?: (m: Movement) => void;
    onDelete?: (m: Movement) => void;
    sortKey: GainSortKey;
    sortDir: SortDir;
    onSort: (key: GainSortKey) => void;
};

export function GainsTabbedLedger({
    categoryRows,
    estornoRows,
    currency,
    accountLabel,
    statusLabel,
    onToggleStatus,
    statusToggleBusy,
    selectedIds,
    onToggleRow,
    onEdit,
    onDelete,
    sortKey,
    sortDir,
    onSort
}: Props) {
    const [tab, setTab] = useState<TabKey>(readStoredTab);

    const activeRows = tab === 'category' ? categoryRows : estornoRows;

    const categoryPagination = useTablePagination(categoryRows.length, 'gains-tab-category');
    const estornoPagination = useTablePagination(estornoRows.length, 'gains-tab-estorno');
    const pagination = tab === 'category' ? categoryPagination : estornoPagination;

    const rows = activeRows.slice(pagination.start, pagination.end);

    const selectTab = (next: TabKey) => {
        setTab(next);
        try {
            localStorage.setItem(TAB_STORAGE_KEY, next);
        } catch {
            /* ignore */
        }
    };

    const tableSortKey = sortKey === 'received' ? 'status' : sortKey;

    return (
        <div className="gains-tabbed-ledger" data-gains-ledger-view="tabbed">
            <div className="gains-tabbed-ledger__tabs" role="tablist" aria-label="Blocos do extrato">
                <button
                    type="button"
                    id="gains-tab-category"
                    role="tab"
                    aria-selected={tab === 'category'}
                    aria-controls="gains-tab-panel"
                    className={`gains-tabbed-ledger__tab${tab === 'category' ? ' is-active' : ''}`}
                    onClick={() => selectTab('category')}
                >
                    Entradas por categoria
                </button>
                <button
                    type="button"
                    id="gains-tab-estorno"
                    role="tab"
                    aria-selected={tab === 'estorno'}
                    aria-controls="gains-tab-panel"
                    className={`gains-tabbed-ledger__tab${tab === 'estorno' ? ' is-active' : ''}`}
                    onClick={() => selectTab('estorno')}
                >
                    Estorno (reembolso)
                </button>
            </div>

            <div
                id="gains-tab-panel"
                className="gains-tabbed-ledger__panel"
                role="tabpanel"
                aria-labelledby={tab === 'category' ? 'gains-tab-category' : 'gains-tab-estorno'}
            >
                <MovementsTable
                    idPrefix="gains"
                    tableId="gains-table"
                    rows={rows}
                    currency={currency}
                    accountLabel={accountLabel}
                    statusLabel={statusLabel}
                    onToggleStatus={onToggleStatus}
                    statusToggleBusy={statusToggleBusy}
                    selectedIds={selectedIds}
                    onToggleRow={onToggleRow}
                    onTogglePage={(on) => {
                        if (!onToggleRow) return;
                        for (const r of rows) {
                            const selected = selectedIds?.has(r.id) ?? false;
                            if (on && !selected) onToggleRow(r.id);
                            if (!on && selected) onToggleRow(r.id);
                        }
                    }}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    sortKey={tableSortKey}
                    sortDir={sortDir}
                    onSort={(key) => onSort((key === 'status' ? 'received' : key) as GainSortKey)}
                    emptyMessage={
                        tab === 'category'
                            ? 'Nenhuma entrada de categoria no período.'
                            : 'Nenhum estorno no período.'
                    }
                />
                <TablePaginationBar
                    page={pagination.page}
                    pageCount={pagination.pageCount}
                    total={activeRows.length}
                    pageSize={pagination.pageSize}
                    onPageSizeChange={pagination.setPageSize}
                    onPrev={pagination.prev}
                    onNext={pagination.next}
                />
            </div>
        </div>
    );
}