import type { ReactNode } from 'react';
import { getExpensePerInstallmentDisplayAmount } from '@motor/dinheiro/credit-installments.js';
import { getExpenseListRowDisplayAmount } from '@motor/dinheiro/expense-list-display-amount.js';
import type { Account, ExpenseSplitRequest, Movement, UserProfile } from '../../lib/types/finance';
import type { InstallmentListPeriod } from '../../frentes/dinheiro/domain/expenseInstallmentLabel';
import { expenseRowAppearsPaid } from '../../lib/expenseRowCashOut';
import { formatBRL } from '../../lib/format';
import { formatMovementDate } from '../../lib/movementList';
import type { DataTableColumn } from '../ui/DataTable';
import { DataTableActionsInner } from '../ui/DataTable';
import { MovementStatusBadge } from '../ui/MovementStatusBadge';
import { DeleteIcon } from '../icons/DeleteIcon';
import { EditIcon } from '../icons/EditIcon';
import { SplitIcon } from '../icons/SplitIcon';
import { ExpenseInstallmentCell } from './ExpenseInstallmentCell';
import { resolveExpenseMovementAccount } from '../../lib/expenseMovementAccount';
import {
    isExpenseInstallmentTableRow,
    type ExpenseInstallmentTableRow
} from '../../frentes/dinheiro/domain/expenseInstallmentTableRows';

export type MovementSortKey = 'date' | 'description' | 'category' | 'account' | 'amount' | 'status';

type BaseOpts = {
    currency: string;
    accountLabel: (accountId?: string) => string;
    prefix: 'gains' | 'expenses';
};

type GainsOpts = BaseOpts & {
    kind: 'gain';
    statusLabel: (m: Movement) => string;
    onToggleStatus?: (m: Movement) => void;
    statusToggleBusy?: (id: string) => boolean;
    onEdit?: (m: Movement) => void;
    onDelete?: (m: Movement) => void;
};

type ExpensesOpts = BaseOpts & {
    kind: 'expense';
    accounts?: Account[];
    allExpenses?: Movement[];
    acceptedSplits?: ExpenseSplitRequest[];
    userProfile?: UserProfile | null;
    listPeriod?: InstallmentListPeriod | null;
    expenseDisplayDate?: (m: Movement) => Date;
    statusLabel: (m: Movement) => string;
    onToggleStatus?: (m: Movement) => void;
    statusToggleBusy?: (id: string) => boolean;
    onSplit?: (m: Movement) => void;
    onEdit?: (m: Movement) => void;
    onDelete?: (m: Movement) => void;
    extraActions?: (m: Movement) => ReactNode;
};

export function buildMovementTableColumns(opts: GainsOpts | ExpensesOpts): DataTableColumn<Movement>[] {
    const { currency, accountLabel, prefix, statusLabel, onToggleStatus, statusToggleBusy, onEdit, onDelete } = opts;
    const descClass = `${prefix === 'gains' ? 'gains' : 'expenses'}-td-description`;
    const amountClass = prefix === 'gains' ? 'gains-td-amount receita' : 'despesa';
    const statusTdClass = prefix === 'expenses' ? 'expenses-td-status' : 'gains-td-received';

    const cols: DataTableColumn<Movement>[] = [
        {
            id: 'date',
            header: 'Data',
            sortKey: 'date',
            cellClassName: 'movement-td-compact',
            render: (m) => {
                if (opts.kind === 'expense' && opts.expenseDisplayDate) {
                    const d = opts.expenseDisplayDate(m);
                    if (Number.isNaN(d.getTime())) return '—';
                    return formatMovementDate({ ...m, date: d.toISOString() });
                }
                return formatMovementDate(m);
            }
        },
        {
            id: 'category',
            header: 'Categoria',
            sortKey: 'category',
            align: 'center',
            headerClassName: 'data-table__th--center movement-th-category',
            cellClassName:
                prefix === 'gains'
                    ? 'gains-td-category movement-td-category'
                    : 'expenses-td-category movement-td-category',
            render: (m) => <MovementCategoryTag label={m.category} tone={prefix} />
        },
        {
            id: 'description',
            header: 'Descrição',
            sortKey: 'description',
            cellClassName: descClass,
            render: (m) => <span title={m.description ?? ''}>{m.description?.trim() || '—'}</span>
        }
    ];

    const accountById =
        opts.kind === 'expense' && opts.accounts
            ? new Map(opts.accounts.map((a) => [a.id, a]))
            : null;

    if (opts.kind === 'expense') {
        cols.push({
            id: 'installments',
            header: 'Parcelas',
            headerClassName: 'expenses-th-installments',
            cellClassName: 'expenses-td-installments',
            align: 'center',
            render: (m) => {
                const acc = resolveExpenseMovementAccount(m, opts.accounts);
                return (
                    <ExpenseInstallmentCell
                        expense={m}
                        account={acc}
                        userProfile={opts.userProfile}
                        listPeriod={opts.listPeriod}
                        currency={currency}
                    />
                );
            }
        });
    }

    cols.push(
        {
            id: 'account',
            header: 'Conta',
            sortKey: 'account',
            cellClassName: 'movement-td-compact',
            render: (m) => accountLabel(m.accountId)
        },
        {
            id: 'amount',
            header: 'Valor',
            sortKey: 'amount',
            align: 'right',
            cellClassName: amountClass,
            render: (m) => {
                const acc =
                    opts.kind === 'expense'
                        ? resolveExpenseMovementAccount(m, opts.accounts)
                        : m.accountId && accountById
                          ? accountById.get(m.accountId)
                          : undefined;
                if (opts.kind !== 'expense') {
                    return <span>{formatBRL(Number(m.amount) || 0, currency)}</span>;
                }
                const splits = opts.acceptedSplits ?? [];
                const allEx = opts.allExpenses ?? null;
                const display = getExpenseListRowDisplayAmount(m, acc, splits, allEx);
                const inst = m as ExerciseInstallmentTableRow;
                const nParc = Math.max(1, parseInt(String(m.installmentCount ?? '1'), 10) || 1);
                const perGross = getExpensePerInstallmentDisplayAmount(m, acc);
                const gross =
                    inst.__instRow && Number(inst.__instParcelAmount) > 0
                        ? Number(inst.__instParcelAmount)
                        : nParc >= 2
                          ? perGross
                          : Number(m.amount) || 0;
                const showStrike = display < gross - 0.0001;
                const total = Number(m.amount) || 0;
                const title =
                    display < total - 0.001
                        ? `Total da compra: ${formatBRL(total, currency)}`
                        : undefined;
                if (showStrike) {
                    return (
                        <span className="expense-split-amount-stack" title={title}>
                            <span className="expense-split-net-amount">{formatBRL(display, currency)}</span>
                            <span
                                className="expense-split-gross-strike"
                                title="Valor original antes do rateio"
                            >
                                {formatBRL(gross, currency)}
                            </span>
                        </span>
                    );
                }
                return <span title={title}>{formatBRL(display, currency)}</span>;
            }
        },
        {
            id: 'status',
            header: 'Status',
            sortKey: 'status',
            align: 'center',
            cellClassName: statusTdClass,
            render: (m) => {
                const label = statusLabel(m);
                const paid =
                    opts.kind === 'expense'
                        ? isExpenseInstallmentTableRow(m)
                            ? !!(m as { __instParcelPaid?: boolean }).__instParcelPaid
                            : expenseRowAppearsPaid(
                                  m,
                                  resolveExpenseMovementAccount(m, opts.accounts),
                                  opts.userProfile,
                                  opts.listPeriod
                              )
                        : m.isPaid !== false;
                const gainTitles = paid
                    ? { title: 'Marcar como pendente', aria: 'Marcar entrada como pendente (a receber)' }
                    : { title: 'Marcar como recebido', aria: 'Marcar entrada como recebida' };
                const expenseTitles = paid
                    ? { title: 'Clique para marcar como pendente', aria: 'Marcar saída como pendente (não paga)' }
                    : { title: 'Clique para confirmar / marcar como paga', aria: 'Marcar saída como paga' };
                const meta = opts.kind === 'gain' ? gainTitles : expenseTitles;
                return (
                    <MovementStatusBadge
                        kind={opts.kind}
                        paid={paid}
                        onClick={onToggleStatus ? () => onToggleStatus(m) : undefined}
                        disabled={statusToggleBusy?.(m.id)}
                        title={meta.title}
                        ariaLabel={meta.aria}
                    >
                        {label}
                    </MovementStatusBadge>
                );
            }
        },
        {
            id: 'actions',
            header: 'Ações',
            align: 'center',
            headerClassName: 'data-table__th--actions',
            cellClassName: 'transaction-actions',
            render: (m) => (
                <DataTableActionsInner>
                    {opts.kind === 'expense' && opts.onSplit ? (
                        <button
                            type="button"
                            className="btn-secondary btn-small table-action-btn"
                            aria-label="Dividir com outro usuário"
                            title="Dividir com outro usuário"
                            onClick={() => opts.onSplit?.(m)}
                        >
                            <SplitIcon size="sm" />
                        </button>
                    ) : null}
                    {opts.kind === 'expense' ? opts.extraActions?.(m) : null}
                    {onEdit ? (
                        <button
                            type="button"
                            className="btn-secondary btn-small table-action-btn"
                            aria-label="Editar lançamento"
                            title="Editar"
                            onClick={() => onEdit(m)}
                        >
                            <EditIcon size="sm" />
                        </button>
                    ) : null}
                    {onDelete ? (
                        <button
                            type="button"
                            className="btn-secondary btn-small table-action-btn table-action-btn--delete"
                            aria-label="Excluir lançamento"
                            title="Excluir"
                            onClick={() => onDelete(m)}
                        >
                            <DeleteIcon size="sm" />
                        </button>
                    ) : null}
                </DataTableActionsInner>
            )
        }
    );

    return cols;
}

function MovementCategoryTag({ label, tone }: { label?: string; tone: 'gains' | 'expenses' }) {
    const text = label?.trim();
    if (!text) return <span className="movement-category-tag movement-category-tag--empty">—</span>;
    return (
        <span
            className={`movement-category-tag movement-category-tag--${tone}`}
            title={text}
            data-category-tag={text}
        >
            {text}
        </span>
    );
}