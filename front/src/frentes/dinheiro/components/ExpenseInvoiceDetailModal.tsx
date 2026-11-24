import { useMemo } from 'react';
import { MovementsTable } from '../../../components/finance/MovementsTable';
import { formatBRL } from '../../../lib/format';
import type { Account, ExpenseSplitRequest, Movement, UserProfile } from '../../../lib/types/finance';
import { DialogFrame } from '../../../components/ui/dialog';
import { getExpenseListRowDisplayAmount } from '@motor/dinheiro/expense-list-display-amount.js';
import type { InstallmentListPeriod } from '../domain/expenseInstallmentLabel';
import type { ExpenseSortKey, SortDir } from '../../../hooks/useMovementSort';

type Props = {
    open: boolean;
    title: string;
    currency: string;
    lines: Movement[];
    accountById: Map<string, Account>;
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
    onSplit?: (m: Movement) => void;
    onEdit?: (m: Movement) => void;
    onDelete?: (m: Movement) => void;
    onClose: () => void;
};

export function ExpenseInvoiceDetailModal({
    open,
    title,
    currency,
    lines,
    accountById,
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
    onSplit,
    onEdit,
    onDelete,
    onClose
}: Props) {
    const total = useMemo(
        () =>
            lines.reduce((s, m) => {
                const acc = m.accountId ? accountById.get(String(m.accountId)) : undefined;
                return s + getExpenseListRowDisplayAmount(m, acc, acceptedSplits, allExpenses);
            }, 0),
        [lines, accountById, acceptedSplits, allExpenses]
    );

    const orderedLines = useMemo(
        () =>
            [...lines].sort(
                (a, b) => expenseDisplayDate(b).getTime() - expenseDisplayDate(a).getTime()
            ),
        [lines, expenseDisplayDate]
    );

    return (
        <DialogFrame
            open={open}
            title={title}
            onClose={onClose}
            id="expense-invoice-detail-modal"
            size="lg"
            panelClassName="expense-lines-detail-modal expense-invoice-detail-modal ui-dialog__panel--invoice-wide"
        >
            <div className="expense-lines-detail expense-invoice-detail movements-page--modern">
                <p className="expense-invoice-detail__total">
                    Total da fatura: <strong>{formatBRL(total, currency)}</strong>
                    <span className="expense-invoice-detail__count">
                        {' '}
                        · {lines.length} lançamento{lines.length === 1 ? '' : 's'}
                    </span>
                </p>
                {lines.length === 0 ? (
                    <p className="expense-invoice-detail__empty">Nenhum lançamento nesta fatura.</p>
                ) : (
                    <div className="page-content--dashboard-modern expense-invoice-detail__table-shell">
                    <MovementsTable
                        idPrefix="expenses"
                        tableId="expense-invoice-detail-table"
                        rows={orderedLines}
                        currency={currency}
                        expenseAccounts={expenseAccounts}
                        allExpenses={allExpenses}
                        acceptedSplits={acceptedSplits}
                        userProfile={userProfile}
                        listPeriod={listPeriod}
                        expenseDisplayDate={expenseDisplayDate}
                        accountLabel={accountLabel}
                        statusLabel={statusLabel}
                        onToggleStatus={onToggleStatus}
                        statusToggleBusy={statusToggleBusy}
                        onSplit={onSplit}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={onSort}
                        emptyMessage="Nenhum lançamento nesta fatura."
                    />
                    </div>
                )}
            </div>
        </DialogFrame>
    );
}