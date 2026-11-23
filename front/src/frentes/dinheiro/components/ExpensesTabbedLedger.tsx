import { useMemo, useState } from 'react';
import { MovementsTable } from '../../../components/finance/MovementsTable';
import { TablePaginationBar } from '../../../components/finance/TablePaginationBar';
import { useTablePagination } from '../../../hooks/useTablePagination';
import type { ExpenseSortKey, SortDir } from '../../../hooks/useMovementSort';
import type { Account, ExpenseSplitRequest, Movement, UserProfile } from '../../../lib/types/finance';
import type { InstallmentListPeriod } from '../domain/expenseInstallmentLabel';
import { expenseInvoiceRowId, isExpenseInvoiceRowId } from '../domain/expenseLedgerBuckets';
import { ExpenseInvoiceDetailModal } from './ExpenseInvoiceDetailModal';
import type { ExpenseInvoiceBundle } from '../domain/expenseLedgerBuckets';

type TabKey = 'essential' | 'invoices' | 'other' | 'cofrinhos';

const TAB_STORAGE_KEY = 'expenses-ledger-active-tab';

function readStoredTab(): TabKey {
    try {
        const v = localStorage.getItem(TAB_STORAGE_KEY);
        if (v === 'essential' || v === 'invoices' || v === 'other' || v === 'cofrinhos') return v;
        if (v === 'payments') return 'other';
    } catch {
        /* ignore */
    }
    return 'essential';
}

type TableModeProps = {
    currency: string;
    expenseAccounts: Account[];
    allExpenses: Movement[];
    acceptedSplits: ExpenseSplitRequest[];
    userProfile?: UserProfile | null;
    listPeriod: InstallmentListPeriod;
    expenseDisplayDate: (m: Movement) => Date;
    accountLabel: (accountId?: string) => string;
    statusLabel: (m: Movement) => string;
    sortKey: ExpenseSortKey;
    sortDir: SortDir;
    onSort: (key: ExpenseSortKey) => void;
    onToggleStatus?: (m: Movement) => void;
    statusToggleBusy?: (id: string) => boolean;
    selectedIds?: Set<string>;
    onToggleRow?: (id: string) => void;
    onSplit?: (m: Movement) => void;
    onEdit?: (m: Movement) => void;
    onDelete?: (m: Movement) => void;
    onView?: (m: Movement) => void;
};

type Props = TableModeProps & {
    essentialRows: Movement[];
    invoiceRows: Movement[];
    otherRows: Movement[];
    cofrinhoRows: Movement[];
    invoiceBundles: ExpenseInvoiceBundle[];
    accountById: Map<string, Account>;
};

function MovementLedgerTable({
    rows,
    emptyMessage,
    onRowClick,
    rowClassName,
    tableProps,
    invoiceTableMode = false
}: {
    rows: Movement[];
    emptyMessage: string;
    onRowClick?: (m: Movement) => void;
    rowClassName?: string;
    tableProps: TableModeProps;
    /** Fatura: linha abre modal e esconde ações em massa na tabela. */
    invoiceTableMode?: boolean;
}) {
    const {
        currency,
        expenseAccounts,
        allExpenses,
        acceptedSplits,
        userProfile,
        listPeriod,
        expenseDisplayDate,
        accountLabel,
        statusLabel,
        sortKey,
        sortDir,
        onSort,
        onToggleStatus,
        statusToggleBusy,
        selectedIds,
        onToggleRow,
        onSplit,
        onEdit,
        onDelete
    } = tableProps;

    const stripTableActions = invoiceTableMode;

    return (
        <MovementsTable
            idPrefix="expenses"
            tableId="expenses-table"
            rows={rows}
            currency={currency}
            expenseAccounts={expenseAccounts}
            allExpenses={allExpenses}
            acceptedSplits={acceptedSplits}
            userProfile={userProfile}
            listPeriod={listPeriod}
            expenseDisplayDate={expenseDisplayDate}
            accountLabel={accountLabel}
            statusLabel={statusLabel}
            onToggleStatus={stripTableActions ? undefined : onToggleStatus}
            statusToggleBusy={statusToggleBusy}
            selectedIds={stripTableActions ? undefined : selectedIds}
            onToggleRow={stripTableActions ? undefined : onToggleRow}
            onTogglePage={
                stripTableActions || !onToggleRow
                    ? undefined
                    : (on) => {
                          for (const r of rows) {
                              const selected = selectedIds?.has(r.id) ?? false;
                              if (on && !selected) onToggleRow(r.id);
                              if (!on && selected) onToggleRow(r.id);
                          }
                      }
            }
            onSplit={stripTableActions ? undefined : onSplit}
            onEdit={stripTableActions ? undefined : onEdit}
            onDelete={stripTableActions ? undefined : onDelete}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            onRowClick={onRowClick}
            rowClassName={rowClassName}
            emptyMessage={emptyMessage}
        />
    );
}

export function ExpensesTabbedLedger({
    essentialRows,
    invoiceRows,
    otherRows,
    cofrinhoRows,
    invoiceBundles,
    currency,
    expenseAccounts,
    allExpenses,
    acceptedSplits,
    userProfile,
    listPeriod,
    expenseDisplayDate,
    accountById,
    accountLabel,
    statusLabel,
    onToggleStatus,
    statusToggleBusy,
    selectedIds,
    onToggleRow,
    onSplit,
    onEdit,
    onDelete,
    onView,
    sortKey,
    sortDir,
    onSort
}: Props) {
    const [tab, setTab] = useState<TabKey>(readStoredTab);
    const [invoiceOpen, setInvoiceOpen] = useState(false);
    const [activeBundle, setActiveBundle] = useState<ExpenseInvoiceBundle | null>(null);

    const bundlesById = useMemo(() => {
        const map = new Map<string, ExpenseInvoiceBundle>();
        for (const b of invoiceBundles) map.set(b.id, b);
        return map;
    }, [invoiceBundles]);

    const essentialPagination = useTablePagination(essentialRows.length, 'expenses-tab-essential');
    const invoicesPagination = useTablePagination(invoiceRows.length, 'expenses-tab-invoices');
    const otherPagination = useTablePagination(otherRows.length, 'expenses-tab-other');
    const cofrinhosPagination = useTablePagination(cofrinhoRows.length, 'expenses-tab-cofrinhos');

    const tabMeta = {
        essential: {
            rows: essentialRows,
            pagination: essentialPagination,
            tabId: 'expenses-tab-essential',
            label: 'Fixas / essenciais',
            empty: 'Nenhuma despesa fixa ou essencial no período.'
        },
        invoices: {
            rows: invoiceRows,
            pagination: invoicesPagination,
            tabId: 'expenses-tab-invoices',
            label: 'Faturas',
            empty: 'Nenhuma fatura no período.'
        },
        other: {
            rows: otherRows,
            pagination: otherPagination,
            tabId: 'expenses-tab-other',
            label: 'Outras despesas',
            empty: 'Nenhuma outra despesa no período.'
        },
        cofrinhos: {
            rows: cofrinhoRows,
            pagination: cofrinhosPagination,
            tabId: 'expenses-tab-cofrinhos',
            label: 'Cofrinhos',
            empty: 'Nenhum aporte ou distribuição no período.'
        }
    } as const;

    const active = tabMeta[tab];
    const rows = active.rows.slice(active.pagination.start, active.pagination.end);

    const selectTab = (next: TabKey) => {
        setTab(next);
        try {
            localStorage.setItem(TAB_STORAGE_KEY, next);
        } catch {
            /* ignore */
        }
    };

    const openInvoice = (m: Movement) => {
        let bundle = bundlesById.get(m.id);
        if (!bundle && m.accountId) {
            bundle = bundlesById.get(expenseInvoiceRowId(String(m.accountId)));
        }
        if (!bundle || bundle.lines.length === 0) return;
        setActiveBundle(bundle);
        setInvoiceOpen(true);
    };

    const tableProps: TableModeProps = {
        currency,
        expenseAccounts,
        allExpenses,
        acceptedSplits,
        userProfile,
        listPeriod,
        expenseDisplayDate,
        accountLabel,
        statusLabel,
        sortKey,
        sortDir,
        onSort,
        onToggleStatus,
        statusToggleBusy,
        selectedIds,
        onToggleRow,
        onSplit,
        onEdit,
        onDelete,
        onView
    };

    return (
        <div className="gains-tabbed-ledger expenses-tabbed-ledger" data-expenses-ledger-view="tabbed">
            <div className="gains-tabbed-ledger__tabs gains-tabbed-ledger__tabs--quad" role="tablist" aria-label="Blocos do extrato">
                {(Object.keys(tabMeta) as TabKey[]).map((key) => (
                    <button
                        key={key}
                        type="button"
                        id={tabMeta[key].tabId}
                        role="tab"
                        aria-selected={tab === key}
                        aria-controls="expenses-tab-panel"
                        className={`gains-tabbed-ledger__tab${tab === key ? ' is-active' : ''}`}
                        onClick={() => selectTab(key)}
                    >
                        {tabMeta[key].label}
                    </button>
                ))}
            </div>

            <div
                id="expenses-tab-panel"
                className="gains-tabbed-ledger__panel"
                role="tabpanel"
                aria-labelledby={active.tabId}
            >
                <MovementLedgerTable
                    rows={rows}
                    emptyMessage={active.empty}
                    tableProps={tableProps}
                    onRowClick={
                        tab === 'invoices'
                            ? (m) => {
                                  if (isExpenseInvoiceRowId(m.id)) openInvoice(m);
                              }
                            : onView
                    }
                    invoiceTableMode={tab === 'invoices'}
                    rowClassName={
                        tab === 'invoices'
                            ? 'expenses-invoice-row'
                            : onView
                              ? 'expenses-detail-row'
                              : undefined
                    }
                />
                <TablePaginationBar
                    page={active.pagination.page}
                    pageCount={active.pagination.pageCount}
                    total={active.rows.length}
                    pageSize={active.pagination.pageSize}
                    onPageSizeChange={active.pagination.setPageSize}
                    onPrev={active.pagination.prev}
                    onNext={active.pagination.next}
                />
            </div>

            <ExpenseInvoiceDetailModal
                open={invoiceOpen}
                title={activeBundle?.summary.description ?? 'Detalhe da fatura'}
                currency={currency}
                lines={activeBundle?.lines ?? []}
                accountById={accountById}
                expenseAccounts={expenseAccounts}
                allExpenses={allExpenses}
                acceptedSplits={acceptedSplits}
                userProfile={userProfile}
                listPeriod={listPeriod}
                expenseDisplayDate={expenseDisplayDate}
                accountLabel={accountLabel}
                statusLabel={statusLabel}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                onToggleStatus={onToggleStatus}
                statusToggleBusy={statusToggleBusy}
                onSplit={onSplit}
                onEdit={onEdit}
                onDelete={onDelete}
                onClose={() => {
                    setInvoiceOpen(false);
                    setActiveBundle(null);
                }}
            />
        </div>
    );
}