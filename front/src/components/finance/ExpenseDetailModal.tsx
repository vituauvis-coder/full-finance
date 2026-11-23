import { useMemo } from 'react';
import type { Account, ExpenseSplitRequest, Movement, UserProfile } from '../../lib/types/finance';
import { formatBRL } from '../../lib/format';
import { DialogFrame } from '../ui/dialog';
import { MovementsTable } from './MovementsTable';
import { expenseListDisplayAmount } from '../../lib/filterExpensesInPeriod';
import type { InstallmentListPeriod } from '../../frentes/dinheiro/domain/expenseInstallmentLabel';
import type { ExpenseSortKey, SortDir } from '../../hooks/useMovementSort';
import { isLoanExpense } from '../../lib/loanExpense';
import { isCreditCardType } from '../../lib/accounts';
import { getInstallmentState } from '@motor/dinheiro/credit-installments.js';
import { resolveExpenseMovementAccount } from '../../lib/expenseMovementAccount';
import {
    expandExpenseDetailTableRows,
    expenseInstallmentRowDisplayDate,
    isExpenseInstallmentTableRow
} from '../../frentes/dinheiro/domain/expenseInstallmentTableRows';

type Props = {
    open: boolean;
    expense: Movement | null;
    currency: string;
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

export function ExpenseDetailModal({
    open,
    expense,
    currency,
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
    const title = useMemo(() => {
        if (!expense) return 'Detalhe da saída';
        const d = expense.description?.trim();
        if (d) return d;
        const cat = expense.category?.trim();
        if (cat) return cat;
        return 'Detalhe da saída';
    }, [expense]);

    const movementAccount = useMemo(() => {
        if (!expense) return undefined;
        return resolveExpenseMovementAccount(expense, expenseAccounts);
    }, [expense, expenseAccounts]);

    const lineTotal = useMemo(() => {
        if (!expense) return 0;
        return expenseListDisplayAmount(expense, movementAccount);
    }, [expense, movementAccount]);

    const rows = useMemo(() => {
        if (!expense) return [];
        return expandExpenseDetailTableRows(expense, movementAccount, userProfile ?? null);
    }, [expense, movementAccount, userProfile]);

    const subtitleMeta = useMemo(() => {
        if (!expense) return '';
        const n = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
        if (n < 2) return ' · 1 lançamento';
        const st = getInstallmentState(expense, movementAccount, new Date(), userProfile ?? null);
        const paidCount = st.paidCount ?? 0;
        const remaining = st.remaining ?? 0;
        const loan = isLoanExpense(expense);
        const kind =
            loan && (!movementAccount || !isCreditCardType(movementAccount.type))
                ? 'empréstimo'
                : movementAccount && isCreditCardType(movementAccount.type)
                  ? 'cartão'
                  : 'parcelado';
        const rowCount = rows.length;
        const rowsHint = rowCount > 1 ? ` · ${rowCount} parcelas na tabela` : '';
        return ` · ${kind} · ${n} parcelas · ${paidCount} pagas · ${remaining} restantes${rowsHint}`;
    }, [expense, movementAccount, userProfile, rows.length]);

    const detailDisplayDate = useMemo(
        () => (m: Movement) => {
            if (isExpenseInstallmentTableRow(m)) return expenseInstallmentRowDisplayDate(m);
            return expenseDisplayDate(m);
        },
        [expenseDisplayDate]
    );

    const detailStatusLabel = useMemo(
        () => (m: Movement) => {
            const inst = m as { __instParcelPaid?: boolean };
            if (isExpenseInstallmentTableRow(m)) {
                return inst.__instParcelPaid ? 'Pago' : 'Pendente';
            }
            return statusLabel(m);
        },
        [statusLabel]
    );

    const wrapAction =
        (fn?: (m: Movement) => void) =>
        (_m: Movement) => {
            if (!expense) return;
            fn?.(expense);
            onClose();
        };

    return (
        <DialogFrame
            open={open}
            title={title}
            onClose={onClose}
            id="expense-detail-modal"
            size="lg"
            panelClassName="expense-lines-detail-modal expense-invoice-detail-modal ui-dialog__panel--invoice-wide"
        >
            {expense ? (
                <div className="expense-lines-detail expense-invoice-detail movements-page--modern">
                    <p className="expense-invoice-detail__total">
                        Valor: <strong>{formatBRL(lineTotal, currency)}</strong>
                        <span className="expense-invoice-detail__count">{subtitleMeta}</span>
                    </p>
                    <div className="page-content--dashboard-modern expense-invoice-detail__table-shell">
                        <MovementsTable
                            idPrefix="expenses"
                            tableId="expense-detail-view-table"
                            rows={rows}
                            currency={currency}
                            expenseAccounts={expenseAccounts}
                            allExpenses={allExpenses}
                            acceptedSplits={acceptedSplits}
                            userProfile={userProfile}
                            listPeriod={null}
                            expenseDisplayDate={detailDisplayDate}
                            accountLabel={accountLabel}
                            statusLabel={detailStatusLabel}
                            onToggleStatus={onToggleStatus}
                            statusToggleBusy={statusToggleBusy}
                            onSplit={wrapAction(onSplit)}
                            onEdit={wrapAction(onEdit)}
                            onDelete={wrapAction(onDelete)}
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={onSort}
                            emptyMessage="Nenhum dado."
                        />
                    </div>
                </div>
            ) : null}
        </DialogFrame>
    );
}