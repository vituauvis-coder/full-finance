import { useMemo } from 'react';
import { DataTable, type DataTableColumn } from '../../../../components/ui/DataTable';
import { formatBRL } from '../../../../lib/format';
import { accountName } from '../../../../lib/movementList';
import type { Account } from '../../../../lib/types/finance';
import {
    filterApplications,
    type CofrinhoApplication,
    type CofrinhoBucket
} from '../../domain/cofrinhoAggregations';
import { referenceMonthToYearMonth } from '../../domain/cofrinhoPeriod';
import type { CofrinhoPeriodScope } from '../../domain/cofrinhoPeriodScope';

type Props = {
    applications: CofrinhoApplication[];
    buckets: CofrinhoBucket[];
    accounts: Account[];
    scope: CofrinhoPeriodScope;
    currency: string;
    onDelete: (id: string) => void;
};

export function CofrinhosApplicationsTable({
    applications,
    buckets,
    accounts,
    scope,
    currency,
    onDelete
}: Props) {
    const bucketById = useMemo(() => new Map(buckets.map((b) => [b.id, b])), [buckets]);

    const rows = useMemo(() => {
        if (scope.kind === 'all-years') {
            return filterApplications(applications, { allYears: true });
        }
        if (scope.kind === 'civil-year') {
            return filterApplications(applications, { civilYear: scope.year });
        }
        return filterApplications(applications, { yearMonth: scope.yearMonth });
    }, [applications, scope]);

    const columns = useMemo<DataTableColumn<CofrinhoApplication>[]>(
        () => [
            {
                id: 'bucket',
                header: 'Caixinha',
                render: (row) => bucketById.get(String(row.bucketId))?.name ?? '—'
            },
            {
                id: 'month',
                header: 'Mês ref.',
                render: (row) => referenceMonthToYearMonth(row.referenceMonth) || '—'
            },
            {
                id: 'amount',
                header: 'Valor',
                align: 'right',
                headerClassName: 'data-table__th--right',
                cellClassName: 'data-table__td--right',
                render: (row) => formatBRL(Number(row.amount) || 0, currency)
            },
            {
                id: 'account',
                header: 'Conta',
                render: (row) => accountName(accounts, row.accountId)
            },
            {
                id: 'actions',
                header: '',
                align: 'right',
                render: (row) => (
                    <button
                        type="button"
                        className="table-action-btn table-action-btn--delete"
                        title="Excluir aporte"
                        onClick={() => onDelete(row.id)}
                    >
                        <i className="fas fa-trash-alt" aria-hidden="true"></i>
                        <span className="sr-only">Excluir</span>
                    </button>
                )
            }
        ],
        [accounts, bucketById, currency, onDelete]
    );

    return (
        <section className="cofrinhos-page__apps-section" aria-label="Aplicações">
            <DataTable
                tableId="cofrinhos-applications-table"
                rows={rows}
                columns={columns}
                getRowKey={(r) => r.id}
                emptyMessage="Nenhuma aplicação encontrada neste mês."
            />
        </section>
    );
}