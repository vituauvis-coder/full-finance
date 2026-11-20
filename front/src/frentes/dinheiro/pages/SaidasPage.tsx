import { useCallback, useMemo, useState } from 'react';
import { MovementSummaryCard, MovementSummaryCardsGrid } from '../../../components/finance/MovementSummaryCard';
import { MovementsTable } from '../../../components/finance/MovementsTable';
import { ExpenseFormModal } from '../../../components/finance/ExpenseFormModal';
import { TablePaginationBar } from '../../../components/finance/TablePaginationBar';
import { CategoryTreemap } from '../../../components/finance/CategoryTreemap';
import { MovementListFilterDrawer } from '../../../components/finance/MovementListFilterDrawer';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { formatBRL } from '../../../lib/format';
import { defaultCivilYear, defaultPeriod, getPeriodDateBounds, MONTH_NAMES, monthIndexFromPeriod } from '../../../lib/period';
import { accountName, type ListFilter } from '../../../lib/movementList';
import { expenseRowDisplayDate, filterExpensesInPeriod } from '../../../lib/filterExpensesInPeriod';
import { EXPENSE_TREEMAP_PALETTE } from '../../../lib/treemapData';
import { buildExpenseTreemapBlocks } from '../../../lib/expenseTreemap';
import { useTablePagination } from '../../../hooks/useTablePagination';
import { compareExpenseRows, useMovementSort, type ExpenseSortKey } from '../../../hooks/useMovementSort';
import { usePeriodSyncedDrawerDates } from '../../../hooks/usePeriodSyncedDrawerDates';
import { ExpenseBatchModal } from '../../../components/finance/ExpenseBatchModal';
import { expenseCashOutPeriodKey, expenseRowCanConfirmCashOut } from '../../../lib/expenseRowCashOut';
import { ScreenLoader } from '../../../components/ui/ScreenLoader';
import { movementDate } from '../../../lib/period';
import { useMovementListFilters } from '../context/MovementListFiltersContext';
import { confirmExpenseCashOut, deleteExpense, patchExpensesBatch } from '../api/movements';
import { useMovementStatusToggle } from '../../../hooks/useMovementStatusToggle';
import { MovementBatchBar } from '../../../components/finance/MovementBatchBar';
import { ExpenseSplitsBanner } from '../components/ExpenseSplitsBanner';
import { MovementListToolbar } from '../components/MovementListToolbar';
import { useMovementHeaderAdd } from '../hooks/useMovementHeaderAdd';
import { expenseSummaryFromRows, expenseSummaryMomStates } from '../domain/expenseSummaryStats';
import {
    EXPENSES_SUMMARY_COPY,
    expensesSummaryTitles
} from '../../../lib/movementSummaryCopy';
import { SummaryMomVariation } from '../../../components/finance/SummaryMomVariation';
import type { Movement } from '../../../lib/types/finance';

export function SaidasPage() {
    const { data, loading, error, refresh } = useFinanceData();
    const listFilters = useMovementListFilters();
    const [period, setPeriod] = useState(defaultPeriod);
    const [year, setYear] = useState(defaultCivilYear);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Movement | null>(null);
    const [selected, setSelected] = useState<Set<string>>(() => new Set());
    const [batchModalOpen, setBatchModalOpen] = useState(false);

    const currency = data?.userProfile?.currency ?? 'BRL';
    const paymentStatus = useMemo(() => {
        const s = new Set<'paid' | 'unpaid'>();
        if (listFilters?.expensesStatus.paid) s.add('paid');
        if (listFilters?.expensesStatus.unpaid) s.add('unpaid');
        return s;
    }, [listFilters?.expensesStatus.paid, listFilters?.expensesStatus.unpaid]);

    const drawer = listFilters?.filters;
    const amountMin = drawer?.amountMin ? parseFloat(drawer.amountMin) : null;
    const amountMax = drawer?.amountMax ? parseFloat(drawer.amountMax) : null;

    usePeriodSyncedDrawerDates(
        period,
        year,
        drawer?.dateFrom ?? '',
        drawer?.dateTo ?? '',
        listFilters?.dateManual ?? false,
        (v) => listFilters?.setFilter('dateFrom', v),
        (v) => listFilters?.setFilter('dateTo', v),
        () => listFilters?.clearDateManual()
    );

    const filtered = useMemo(() => {
        if (!data) return [];
        return filterExpensesInPeriod(data.userExpenses, data.userAccounts, period, year, {
            q: listFilters?.searchQ ?? '',
            paymentStatus,
            accountId: drawer?.accountId || undefined,
            category: drawer?.category || undefined,
            amountMin: Number.isFinite(amountMin) ? amountMin : null,
            amountMax: Number.isFinite(amountMax) ? amountMax : null,
            dateFrom: drawer?.dateFrom || undefined,
            dateTo: drawer?.dateTo || undefined
        });
    }, [data, period, year, listFilters?.searchQ, paymentStatus, drawer, amountMin, amountMax]);

    const accountLabelFn = useMemo(
        () => (id?: string) => (data ? accountName(data.userAccounts, id) : '—'),
        [data]
    );
    const accountById = useMemo(
        () => new Map((data?.userAccounts ?? []).map((a) => [a.id, a])),
        [data?.userAccounts]
    );

    const expenseDisplayDate = useCallback(
        (m: Movement) => {
            const acc = m.accountId ? accountById.get(m.accountId) : undefined;
            return expenseRowDisplayDate(m, acc, period, year);
        },
        [accountById, period, year]
    );

    const { sortKey, sortDir, toggleSort, sortRows } = useMovementSort<ExpenseSortKey>(
        filtered,
        'date',
        compareExpenseRows
    );
    const sorted = useMemo(() => sortRows(accountLabelFn), [sortRows, accountLabelFn]);

    const pagination = useTablePagination(sorted.length, 'expenses');
    const rows = sorted.slice(pagination.start, pagination.end);

    const periodLabel = useMemo(() => {
        const mi = monthIndexFromPeriod(period);
        const { startDate, endDate } = getPeriodDateBounds(period, year);
        return `${MONTH_NAMES[mi]} ${year} (${startDate.toLocaleDateString('pt-BR')} – ${endDate.toLocaleDateString('pt-BR')})`;
    }, [period, year]);

    const treemapBlocks = useMemo(() => buildExpenseTreemapBlocks(filtered), [filtered]);

    const statusFilterActive = Boolean(listFilters?.expensesStatus.paid || listFilters?.expensesStatus.unpaid);
    const listFilter = useMemo<ListFilter>(
        () => ({
            q: listFilters?.searchQ ?? '',
            paymentStatus,
            accountId: drawer?.accountId || undefined,
            category: drawer?.category || undefined,
            amountMin: Number.isFinite(amountMin) ? amountMin : null,
            amountMax: Number.isFinite(amountMax) ? amountMax : null,
            dateFrom: drawer?.dateFrom || undefined,
            dateTo: drawer?.dateTo || undefined
        }),
        [
            listFilters?.searchQ,
            paymentStatus,
            drawer?.accountId,
            drawer?.category,
            drawer?.dateFrom,
            drawer?.dateTo,
            amountMin,
            amountMax
        ]
    );
    const expenseSummary = useMemo(
        () => expenseSummaryFromRows(filtered, data?.userAccounts ?? [], statusFilterActive),
        [filtered, data?.userAccounts, statusFilterActive]
    );
    const expenseMom = useMemo(() => {
        if (!data || expenseSummary.showHint) {
            return {
                total: { kind: 'hidden' as const },
                essential: { kind: 'hidden' as const },
                creditCard: { kind: 'hidden' as const },
                other: { kind: 'hidden' as const }
            };
        }
        return expenseSummaryMomStates(
            data.userExpenses,
            data.userAccounts,
            period,
            year,
            expenseSummary,
            listFilter
        );
    }, [data, expenseSummary, period, year, listFilter]);
    const expenseTitles = expensesSummaryTitles();
    const expenseHint = EXPENSES_SUMMARY_COPY.filterRequiredHint;

    async function onDelete(m: Movement) {
        if (!window.confirm('Excluir esta saída?')) return;
        await deleteExpense(m.id);
        await refresh();
    }

    async function onConfirmCashOut(m: Movement) {
        const key = expenseCashOutPeriodKey(m);
        if (!window.confirm(`Confirmar débito no saldo para ${movementDate(m).toLocaleDateString('pt-BR')}?`)) return;
        await confirmExpenseCashOut(m.id, key);
        await refresh();
    }

    async function batchPatch(patch: { isPaid: boolean }) {
        const ids = [...selected];
        if (ids.length === 0) return;
        await patchExpensesBatch(ids, patch);
        setSelected(new Set());
        await refresh();
    }

    const patchExpensePaid = useCallback(
        (id: string, isPaid: boolean) => patchExpensesBatch([id], { isPaid }),
        []
    );
    const { onToggleStatus, statusToggleBusy } = useMovementStatusToggle(patchExpensePaid, refresh);

    const openAddModal = useCallback(() => {
        setEditing(null);
        setModalOpen(true);
    }, []);
    useMovementHeaderAdd('add-expense-btn', openAddModal);

    if (loading) {
        return (
            <section className="page active">
                <ScreenLoader label="Carregando saídas" />
            </section>
        );
    }

    if (error || !data) {
        return (
            <section className="page active">
                <p role="alert">{error ?? 'Sem dados'}</p>
            </section>
        );
    }

    return (
        <section id="expenses-page" className="page active movements-page--modern">
            <ExpenseSplitsBanner />
            <MovementListToolbar
                period={period}
                year={year}
                onPeriodChange={setPeriod}
                onYearChange={setYear}
                timelineClass="civil-period-timeline--expenses"
            />
            <MovementSummaryCardsGrid group="expenses" ariaLabel="Resumo de saídas">
                <MovementSummaryCard
                    cardId="expenses-summary-month"
                    tone="expense"
                    icon="fa-calendar-day"
                    title={expenseTitles.month}
                    value={
                        expenseSummary.showHint ? (
                            <span className="card-metric-hint" title={expenseHint}>
                                —
                            </span>
                        ) : (
                            formatBRL(expenseSummary.total, currency)
                        )
                    }
                    iconTooltip={false}
                    footer={
                        expenseSummary.showHint ? (
                            <span className="card-metric-hint">{expenseHint}</span>
                        ) : (
                            <SummaryMomVariation state={expenseMom.total} />
                        )
                    }
                />
                <MovementSummaryCard
                    cardId="expenses-summary-projection"
                    tone="expense"
                    icon="fa-anchor"
                    title={expenseTitles.projection}
                    value={
                        expenseSummary.showHint ? (
                            <span className="card-metric-hint" title={expenseHint}>
                                —
                            </span>
                        ) : (
                            formatBRL(expenseSummary.essential, currency)
                        )
                    }
                    iconTooltip={false}
                    footer={
                        expenseSummary.showHint ? (
                            <span className="card-metric-hint">{expenseHint}</span>
                        ) : (
                            <SummaryMomVariation state={expenseMom.essential} />
                        )
                    }
                />
                <MovementSummaryCard
                    cardId="expenses-summary-top-cat"
                    tone="expense"
                    icon="fa-credit-card"
                    title={expenseTitles.creditCard}
                    value={
                        expenseSummary.showHint ? (
                            <span className="card-metric-hint" title={expenseHint}>
                                —
                            </span>
                        ) : (
                            formatBRL(expenseSummary.creditCard, currency)
                        )
                    }
                    iconTooltip={false}
                    footer={
                        expenseSummary.showHint ? (
                            <span className="card-metric-hint">{expenseHint}</span>
                        ) : (
                            <SummaryMomVariation state={expenseMom.creditCard} />
                        )
                    }
                />
                <MovementSummaryCard
                    cardId="expenses-summary-other"
                    tone="expense"
                    icon="fa-wallet"
                    title={expenseTitles.other}
                    value={
                        expenseSummary.showHint ? (
                            <span className="card-metric-hint" title={expenseHint}>
                                —
                            </span>
                        ) : (
                            formatBRL(expenseSummary.other, currency)
                        )
                    }
                    iconTooltip={false}
                    footer={
                        expenseSummary.showHint ? (
                            <span className="card-metric-hint">{expenseHint}</span>
                        ) : (
                            <SummaryMomVariation state={expenseMom.other} />
                        )
                    }
                />
            </MovementSummaryCardsGrid>
            <MovementBatchBar
                count={selected.size}
                entityLabel="saída"
                onClear={() => setSelected(new Set())}
                onMarkPaid={() => void batchPatch({ isPaid: true })}
                onMarkUnpaid={() => void batchPatch({ isPaid: false })}
                onEditBatch={() => setBatchModalOpen(true)}
            />
            <CategoryTreemap
                containerId="expenses-treemap-container"
                canvasId="expenses-spending-treemap-canvas"
                blocks={treemapBlocks}
                currency={currency}
                palette={EXPENSE_TREEMAP_PALETTE}
                periodLabel={periodLabel}
                title="Mapa de Saídas"
                emptyMessage="Nenhuma saída no período selecionado."
            />
            <MovementsTable
                idPrefix="expenses"
                rows={rows}
                currency={currency}
                expenseAccounts={data.userAccounts}
                expenseDisplayDate={expenseDisplayDate}
                accountLabel={(id) => accountName(data.userAccounts, id)}
                statusLabel={(m) => (m.isPaid === false ? 'Pendente' : 'Pago')}
                onToggleStatus={(m) => void onToggleStatus(m)}
                statusToggleBusy={statusToggleBusy}
                selectedIds={selected}
                onToggleRow={(id) =>
                    setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                    })
                }
                onTogglePage={(on) =>
                    setSelected((prev) => {
                        const next = new Set(prev);
                        for (const r of rows) {
                            if (on) next.add(r.id);
                            else next.delete(r.id);
                        }
                        return next;
                    })
                }
                onEdit={(m) => {
                    setEditing(m);
                    setModalOpen(true);
                }}
                onDelete={(m) => void onDelete(m)}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(key) => toggleSort(key as ExpenseSortKey)}
                renderRowActions={(m) => {
                    const acc = accountById.get(String(m.accountId));
                    if (!expenseRowCanConfirmCashOut(m, acc)) return null;
                    return (
                        <button
                            type="button"
                            className="btn-secondary btn-small"
                            onClick={() => void onConfirmCashOut(m)}
                        >
                            Confirmar débito
                        </button>
                    );
                }}
            />
            <TablePaginationBar
                page={pagination.page}
                pageCount={pagination.pageCount}
                total={sorted.length}
                pageSize={pagination.pageSize}
                onPageSizeChange={pagination.setPageSize}
                onPrev={pagination.prev}
                onNext={pagination.next}
            />
            <ExpenseFormModal
                open={modalOpen}
                editing={editing}
                accounts={data.userAccounts}
                onClose={() => setModalOpen(false)}
                onSaved={refresh}
            />
            <ExpenseBatchModal
                open={batchModalOpen}
                count={selected.size}
                ids={[...selected]}
                accounts={data.userAccounts}
                onClose={() => setBatchModalOpen(false)}
                onSaved={async () => {
                    setSelected(new Set());
                    await refresh();
                }}
            />
            <MovementListFilterDrawer id="expenses-filter-drawer" title="Filtrar saídas" kind="expense" />
        </section>
    );
}