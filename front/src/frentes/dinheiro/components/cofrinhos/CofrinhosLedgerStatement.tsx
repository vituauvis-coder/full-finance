import { useEffect, useMemo, useState } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatBRL } from '../../../../lib/format';
import type { Account } from '../../../../lib/types/finance';
import type { Movement } from '../../../../lib/types/finance';
import {
    buildCofrinhoLedgerRows,
    type CofrinhoLedgerRow,
    type CofrinhoTripPayloadOutflow
} from '../../domain/cofrinhoLedgerRows';
import type { CofrinhoApplication, CofrinhoBucket } from '../../domain/cofrinhoAggregations';
import type { CofrinhoMonthlyBalance } from '../../domain/cofrinhoMonthlyBalances';
import { mergeCofrinhoLedgerWithYield } from '../../domain/cofrinhoYieldLedger';
import { bucketColorHex } from '../../domain/cofrinhoConstants';
import { cofrinhoLedgerAccountAccent } from '../../domain/cofrinhoLedgerAccountAccent';
import {
    defaultCofrinhosLedgerFilters,
    filterCofrinhoLedgerRows,
    ledgerFiltersScopeLabel,
    resolveLedgerScope
} from '../../domain/cofrinhoLedgerFilters';
import { CofrinhosLedgerFilterRibbon } from './CofrinhosLedgerFilterRibbon';
import { CofrinhoLedgerInflowEditModal } from './CofrinhoLedgerInflowEditModal';
import { cofrinhoPaymentAccounts } from '../../domain/cofrinhoPaymentAccounts';
import { takeCofrinhosLedgerAccountNav } from '../../domain/cofrinhoLedgerNav';

type Props = {
    expenses: Movement[];
    tripPayloadOutflows?: CofrinhoTripPayloadOutflow[];
    applications: CofrinhoApplication[];
    buckets: CofrinhoBucket[];
    monthlyBalances: CofrinhoMonthlyBalance[];
    accounts: Account[];
    currency: string;
    onDeleteApplication: (id: string) => void;
    onDeleteMonthlyBalance: (id: string) => void;
    onDeleteMonthlyBalanceMonth: (bucketId: string, yearMonth: string) => void;
    onRefresh: () => Promise<void>;
};

export function CofrinhosLedgerStatement({
    expenses,
    tripPayloadOutflows = [],
    applications,
    buckets,
    monthlyBalances,
    accounts,
    currency,
    onDeleteApplication,
    onDeleteMonthlyBalance,
    onDeleteMonthlyBalanceMonth,
    onRefresh
}: Props) {
    const [filters, setFilters] = useState(defaultCofrinhosLedgerFilters);
    const [editRow, setEditRow] = useState<CofrinhoLedgerRow | null>(null);

    useEffect(() => {
        const accountId = takeCofrinhosLedgerAccountNav();
        if (accountId) {
            setFilters((prev) => ({ ...prev, accountId }));
        }
    }, []);
    const paymentAccounts = useMemo(() => cofrinhoPaymentAccounts(accounts), [accounts]);
    const editPaymentAccounts = useMemo(() => {
        if (!editRow?.accountId) return paymentAccounts;
        const linked = accounts.find((a) => a.id === editRow.accountId);
        if (linked && !paymentAccounts.some((a) => a.id === linked.id)) {
            return [...paymentAccounts, linked];
        }
        return paymentAccounts;
    }, [accounts, editRow?.accountId, paymentAccounts]);
    const scope = useMemo(() => resolveLedgerScope(filters), [filters]);

    const rows = useMemo(() => {
        const base = buildCofrinhoLedgerRows(
            expenses,
            applications,
            buckets,
            accounts,
            scope,
            tripPayloadOutflows
        );
        const merged = mergeCofrinhoLedgerWithYield(base, monthlyBalances, buckets, scope);
        return filterCofrinhoLedgerRows(merged, filters);
    }, [accounts, applications, buckets, expenses, filters, monthlyBalances, scope, tripPayloadOutflows]);

    const totals = useMemo(() => {
        let inSum = 0;
        let outSum = 0;
        for (const r of rows) {
            if (r.kind === 'in') inSum += r.amount;
            else outSum += r.amount;
        }
        return { inSum, outSum, net: inSum - outSum };
    }, [rows]);

    const scopeLabel = ledgerFiltersScopeLabel(filters);

    const summaryFooter = (
        <footer className="cofrinhos-ledger__footer" aria-label="Resumo do extrato">
            <dl className="cofrinhos-ledger__summary">
                <div className="cofrinhos-ledger__summary-card is-in">
                    <dt>
                        <span className="cofrinhos-ledger__summary-icon" aria-hidden="true">
                            <MaterialIcon name="south_west" variant="app" opticalSize={16} />
                        </span>
                        Entradas
                    </dt>
                    <dd>{formatBRL(totals.inSum, currency)}</dd>
                </div>
                <div className="cofrinhos-ledger__summary-card is-out">
                    <dt>
                        <span className="cofrinhos-ledger__summary-icon" aria-hidden="true">
                            <MaterialIcon name="north_east" variant="app" opticalSize={16} />
                        </span>
                        Saídas
                    </dt>
                    <dd>{formatBRL(totals.outSum, currency)}</dd>
                </div>
                <div className="cofrinhos-ledger__summary-card is-net">
                    <dt>
                        <span className="cofrinhos-ledger__summary-icon" aria-hidden="true">
                            <MaterialIcon name="savings" variant="app" opticalSize={16} />
                        </span>
                        Saldo
                    </dt>
                    <dd>{formatBRL(totals.net, currency)}</dd>
                </div>
            </dl>
        </footer>
    );

    return (
        <section className="cofrinhos-ledger cofrinhos-ledger--with-filters" aria-label="Extrato de cofrinhos">
            <header className="cofrinhos-ledger__head">
                <div>
                    <h3 className="cofrinhos-ledger__title">Extrato</h3>
                    <p className="cofrinhos-ledger__subtitle">{scopeLabel}</p>
                </div>
            </header>
            <CofrinhosLedgerFilterRibbon
                filters={filters}
                onChange={setFilters}
                buckets={buckets}
                accounts={accounts}
            />

            {rows.length === 0 ? (
                <>
                    <p className="cofrinhos-ledger__empty">Nenhum aporte ou saída do cofrinho neste recorte.</p>
                    {summaryFooter}
                </>
            ) : (
                <div className="cofrinho-statement cofrinhos-ledger__statement" role="table">
                    <div className="cofrinho-statement__header cofrinhos-ledger__header" role="row">
                        <span role="columnheader">Mês</span>
                        <span role="columnheader">Caixinha</span>
                        <span role="columnheader">Descrição</span>
                        <span role="columnheader">Registro</span>
                        <span role="columnheader">Conta</span>
                        <span role="columnheader" className="cofrinho-statement__th-amount">
                            Valor
                        </span>
                        <span className="cofrinhos-ledger__th-actions" aria-hidden="true" />
                    </div>
                    <ul className="cofrinho-statement__rows cofrinhos-ledger__body" role="rowgroup">
                        {rows.map((row) => {
                            const bucket = buckets.find((b) => b.id === row.bucketId);
                            const account = row.accountId
                                ? accounts.find((a) => a.id === row.accountId)
                                : undefined;
                            const accent = bucketColorHex(bucket?.colorKey);
                            const accountAccent = cofrinhoLedgerAccountAccent(account);
                            const hasAccount = Boolean(row.accountLabel) && row.accountLabel !== '—';
                            const showEdit = row.kind === 'in' && row.editable;
                            return (
                                <li
                                    key={row.id}
                                    className={`cofrinho-statement__row cofrinhos-ledger__row${
                                        row.kind === 'out' ? ' is-out' : ''
                                    }${row.isYield ? ' is-yield' : ''}${showEdit ? ' is-editable' : ''}`}
                                    role="row"
                                    style={{ ['--cofrinho-accent' as string]: accent }}
                                    onClick={
                                        showEdit
                                            ? (ev) => {
                                                  const t = ev.target as HTMLElement;
                                                  if (t.closest('button')) return;
                                                  setEditRow(row);
                                              }
                                            : undefined
                                    }
                                >
                                    <span className="cofrinho-statement__ref" role="cell">
                                        {row.refLabel}
                                    </span>
                                    <span className="cofrinhos-ledger__bucket-cell" role="cell" title={row.bucketName}>
                                        <span className="cofrinhos-ledger__dot" aria-hidden="true" />
                                        <span className="cofrinhos-ledger__bucket-name">{row.bucketName}</span>
                                    </span>
                                    <span className="cofrinhos-ledger__desc" role="cell" title={row.title}>
                                        <MaterialIcon
                                            name={
                                                row.isYield
                                                    ? 'trending_up'
                                                    : row.kind === 'in'
                                                      ? 'south_west'
                                                      : 'north_east'
                                            }
                                            variant="app"
                                            opticalSize={14}
                                            className="cofrinhos-ledger__flow-icon"
                                        />
                                        <span className="cofrinhos-ledger__desc-text">{row.title}</span>
                                    </span>
                                    <span className="cofrinho-statement__date" role="cell">
                                        {row.dateLabel}
                                    </span>
                                    <span className="cofrinhos-ledger__account-cell" role="cell">
                                        {hasAccount ? (
                                            <span
                                                className="cofrinhos-ledger__account-tag"
                                                title={row.accountLabel}
                                                style={{
                                                    ['--ledger-account-accent' as string]: accountAccent
                                                }}
                                            >
                                                {row.accountLabel}
                                            </span>
                                        ) : (
                                            <span className="cofrinhos-ledger__account-tag is-empty">—</span>
                                        )}
                                    </span>
                                    <span
                                        className={`cofrinho-statement__amount cofrinhos-ledger__amount${
                                            row.kind === 'out' ? ' is-out' : ''
                                        }`}
                                        role="cell"
                                    >
                                        {row.kind === 'out' ? '−' : ''}
                                        {formatBRL(row.amount, currency)}
                                    </span>
                                    <span className="cofrinhos-ledger__actions" role="cell">
                                        {showEdit ? (
                                            <button
                                                type="button"
                                                className="cofrinhos-ledger__edit"
                                                title="Editar aporte"
                                                aria-label="Editar aporte"
                                                onClick={() => setEditRow(row)}
                                            >
                                                <MaterialIcon name="edit" variant="app" opticalSize={15} />
                                            </button>
                                        ) : null}
                                        {row.deletable && row.isYield && row.yieldMonthKey ? (
                                            <button
                                                type="button"
                                                className="cofrinhos-ledger__delete"
                                                title="Excluir reconciliação"
                                                onClick={() => {
                                                    const [bucketId, ym] = row.yieldMonthKey!.split('|');
                                                    onDeleteMonthlyBalanceMonth(bucketId, ym);
                                                }}
                                            >
                                                <MaterialIcon name="delete" variant="app" opticalSize={15} />
                                                <span className="sr-only">Excluir</span>
                                            </button>
                                        ) : null}
                                        {row.deletable && row.applicationId ? (
                                            <button
                                                type="button"
                                                className="cofrinhos-ledger__delete"
                                                title="Excluir aporte"
                                                onClick={() => onDeleteApplication(row.applicationId!)}
                                            >
                                                <MaterialIcon name="delete" variant="app" opticalSize={15} />
                                                <span className="sr-only">Excluir</span>
                                            </button>
                                        ) : null}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
            {rows.length > 0 ? summaryFooter : null}

            <CofrinhoLedgerInflowEditModal
                open={editRow != null}
                row={editRow}
                buckets={buckets}
                applications={applications}
                expenses={expenses}
                paymentAccounts={editPaymentAccounts}
                onClose={() => setEditRow(null)}
                onSaved={onRefresh}
            />
        </section>
    );
}