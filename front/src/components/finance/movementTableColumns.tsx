import type { ReactNode } from 'react';
import type { Movement } from '../../lib/types/finance';
import { formatBRL } from '../../lib/format';
import { formatMovementDate } from '../../lib/movementList';
import type { DataTableColumn } from '../ui/DataTable';
import { DataTableActionsInner } from '../ui/DataTable';
import { MovementStatusBadge } from '../ui/MovementStatusBadge';

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
    statusLabel: (m: Movement) => string;
    onToggleStatus?: (m: Movement) => void;
    statusToggleBusy?: (id: string) => boolean;
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
            render: (m) => formatMovementDate(m)
        },
        {
            id: 'description',
            header: 'Descrição',
            sortKey: 'description',
            cellClassName: descClass,
            render: (m) => <span title={m.description ?? ''}>{m.description?.trim() || '—'}</span>
        },
        {
            id: 'category',
            header: 'Categoria',
            sortKey: 'category',
            cellClassName: prefix === 'gains' ? 'gains-td-category movement-td-compact' : 'movement-td-compact',
            render: (m) => m.category || '—'
        }
    ];

    if (opts.kind === 'expense') {
        cols.push({
            id: 'installments',
            header: 'Parcelas',
            headerClassName: 'expenses-th-installments',
            cellClassName: 'expenses-td-installments',
            align: 'center',
            render: (m) => ((m.installmentCount ?? 0) > 1 ? `${m.installmentCount}x` : '—')
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
            render: (m) => formatBRL(Number(m.amount) || 0, currency)
        },
        {
            id: 'status',
            header: 'Status',
            sortKey: 'status',
            align: 'center',
            cellClassName: statusTdClass,
            render: (m) => {
                const label = statusLabel(m);
                const paid = m.isPaid !== false;
                const gainTitles = paid
                    ? { title: 'Marcar como pendente', aria: 'Marcar entrada como pendente (a receber)' }
                    : { title: 'Marcar como recebido', aria: 'Marcar entrada como recebida' };
                const expenseTitles = paid
                    ? { title: 'Clique para marcar como pendente', aria: 'Marcar saída como pendente (não paga)' }
                    : { title: 'Clique para marcar como paga', aria: 'Marcar saída como paga' };
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
                    {onEdit ? (
                        <button type="button" className="btn-secondary btn-small" onClick={() => onEdit(m)}>
                            Editar
                        </button>
                    ) : null}
                    {onDelete ? (
                        <button type="button" className="btn-secondary btn-small" onClick={() => onDelete(m)}>
                            Excluir
                        </button>
                    ) : null}
                    {opts.kind === 'expense' ? opts.extraActions?.(m) : null}
                </DataTableActionsInner>
            )
        }
    );

    return cols;
}