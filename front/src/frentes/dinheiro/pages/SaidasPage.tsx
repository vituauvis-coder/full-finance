import { useCallback, useMemo, useState } from 'react';
import { acceptedOutgoingSplits } from '../../dashboard/domain/splitRequestsForBalance';
import { MovementSummaryCard, MovementSummaryCardsGrid } from '../../../components/finance/MovementSummaryCard';
import { MovementsTable } from '../../../components/finance/MovementsTable';
import { ExpenseFormModal } from '../../../components/finance/ExpenseFormModal';
import { TablePaginationBar } from '../../../components/finance/TablePaginationBar';
import { CategoryTreemap } from '../../../components/finance/CategoryTreemap';
import { MovementListFilterDrawer } from '../../../components/finance/MovementListFilterDrawer';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { formatBRL } from '../../../lib/format';
import { getPeriodDateBounds, MONTH_NAMES, monthIndexFromPeriod } from '../../../lib/period';
import { useCivilPeriodState } from '../../../hooks/useCivilPeriodState';
import { accountName, type ListFilter } from '../../../lib/movementList';
import { expenseRowDisplayDate, filterExpensesInPeriod } from '../../../lib/filterExpensesInPeriod';
import { EXPENSE_TREEMAP_PALETTE } from '../../../lib/treemapData';
import { buildExpenseTreemapBlocks } from '../../../lib/expenseTreemap';
import { useTablePagination } from '../../../hooks/useTablePagination';
import { compareExpenseRows, useMovementSort, type ExpenseSortKey } from '../../../hooks/useMovementSort';
import { usePeriodSyncedDrawerDates } from '../../../hooks/usePeriodSyncedDrawerDates';
import { ExpenseBatchModal } from '../../../components/finance/ExpenseBatchModal';
import {
    expenseCashOutPeriodKey,
    expenseDueInListPeriod,
    expenseRowAppearsPaid,
    expenseRowCanConfirmCashOut
} from '../../../lib/expenseRowCashOut';
import { MovementsPageSkeleton } from '../../../components/skeleton/MovementsPageSkeleton';
import { useSkeletonMinDuration } from '../../../hooks/useSkeletonMinDuration';
import { movementDate } from '../../../lib/period';
import { useMovementListFilters } from '../context/MovementListFiltersContext';
import { confirmExpenseCashOut, deleteExpense, patchExpensesBatch } from '../api/movements';
import { playPingSound } from '../../../app/uiSounds';
import { MovementBatchBar } from '../../../components/finance/MovementBatchBar';
import { ExpenseSplitsBanner } from '../components/ExpenseSplitsBanner';
import { ExpenseSplitsOutgoingPanel } from '../components/ExpenseSplitsOutgoingPanel';
import { ExpenseSplitModal } from '../components/ExpenseSplitModal';
import { CivilPeriodToolbar } from '../../../components/finance/CivilPeriodToolbar';
import { useMovementHeaderAdd } from '../hooks/useMovementHeaderAdd';
import { expenseSummaryFromRows, expenseSummaryMomStates } from '../domain/expenseSummaryStats';
import {
    EXPENSES_SUMMARY_COPY,
    expensesSummaryTitles
} from '../../../lib/movementSummaryCopy';
import { SummaryMomVariation } from '../../../components/finance/SummaryMomVariation';
import type { ExpenseSplitSeed, Movement } from '../../../lib/types/finance';
import { useConfirm } from '../../../components/ui/confirm';
import { isCreditCardType } from '../../../lib/accounts';

export function SaidasPage() {
    const { confirm } = useConfirm();
    const { data, loading, error, refresh } = useFinanceData();
    const showSkeleton = useSkeletonMinDuration(loading);
    const listFilters = useMovementListFilters();
    const { period, year, onPeriodChange, onYearChange } = useCivilPeriodState();
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Movement | null>(null);
    const [splitSeed, setSplitSeed] = useState<ExpenseSplitSeed | null>(null);
    const [splitModalOpen, setSplitModalOpen] = useState(false);
    const [splitExpense, setSplitExpense] = useState<Movement | null>(null);
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

    const listPeriod = useMemo(() => getPeriodDateBounds(period, year), [period, year]);

    const periodLabel = useMemo(() => {
        const mi = monthIndexFromPeriod(period);
        return `${MONTH_NAMES[mi]} ${year} (${listPeriod.startDate.toLocaleDateString('pt-BR')} – ${listPeriod.endDate.toLocaleDateString('pt-BR')})`;
    }, [period, year, listPeriod]);

    const treemapBlocks = useMemo(
        () => buildExpenseTreemapBlocks(filtered, data?.userAccounts ?? []),
        [filtered, data?.userAccounts]
    );

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
        const ok = await confirm({
            title: 'Excluir esta saída?',
            message: 'O lançamento será removido permanentemente.',
            confirmLabel: 'Excluir',
            tone: 'danger'
        });
        if (!ok) return;
        await deleteExpense(m.id);
        await refresh();
    }

    async function batchPatch(patch: { isPaid: boolean }) {
        const ids = [...selected];
        if (ids.length === 0) return;
        await patchExpensesBatch(ids, patch);
        setSelected(new Set());
        await refresh();
    }

    const [statusBusy, setStatusBusy] = useState<Set<string>>(() => new Set());
    const statusToggleBusy = useCallback((id: string) => statusBusy.has(id), [statusBusy]);

    const userProfile = data?.userProfile ?? null;

    const onToggleStatus = useCallback(
        async (m: Movement) => {
            if (statusBusy.has(m.id)) return;
            const acc = accountById.get(String(m.accountId));
            const appearsPaid = expenseRowAppearsPaid(m, acc, userProfile, listPeriod);

            setStatusBusy((prev) => new Set(prev).add(m.id));
            try {
                if (!appearsPaid && expenseRowCanConfirmCashOut(m, acc, userProfile, listPeriod)) {
                    const key = expenseCashOutPeriodKey(m, acc, userProfile, listPeriod);
                    const due = expenseDueInListPeriod(m, acc, userProfile, listPeriod);
                    const label = (due ?? movementDate(m)).toLocaleDateString('pt-BR');
                    const ok = await confirm({
                        title: 'Confirmar débito no saldo?',
                        message: `O valor será considerado debitado da conta no período de ${label}.`,
                        confirmLabel: 'Confirmar',
                        tone: 'default'
                    });
                    if (!ok) return;
                    await confirmExpenseCashOut(m.id, key);
                    playPingSound();
                    await refresh();
                    return;
                }

                // Parcelado no período: não alternar isPaid global (evita «Pago» em mês futuro).
                const nInst = Math.max(1, parseInt(String(m.installmentCount ?? '1'), 10) || 1);
                if (acc && isCreditCardType(acc.type) && nInst >= 2) {
                    return;
                }

                const nextIsPaid = !appearsPaid;
                await patchExpensesBatch([m.id], { isPaid: nextIsPaid });
                if (nextIsPaid) playPingSound();
                await refresh();
            } catch (error) {
                console.error('Erro ao atualizar status da saída:', error);
                window.alert('Não foi possível atualizar o status. Tente novamente.');
            } finally {
                setStatusBusy((prev) => {
                    const next = new Set(prev);
                    next.delete(m.id);
                    return next;
                });
            }
        },
        [accountById, confirm, userProfile, listPeriod, refresh, statusBusy]
    );

    const openAddModal = useCallback(() => {
        setEditing(null);
        setSplitSeed(null);
        setModalOpen(true);
    }, []);
    useMovementHeaderAdd('add-expense-btn', openAddModal);

    if (showSkeleton) {
        return (
            <MovementsPageSkeleton
                pageId="expenses-page"
                label="Carregando saídas"
                summaryGroup="expenses"
                summaryAriaLabel="Resumo de saídas"
                cardCount={4}
            />
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
            <CivilPeriodToolbar
                period={period}
                year={year}
                onPeriodChange={onPeriodChange}
                onYearChange={onYearChange}
                accent="expenses"
                inMovementsToolbar
            />
            <ExpenseSplitsBanner
                onAcceptSplit={(seed) => {
                    setEditing(null);
                    setSplitSeed(seed);
                    setModalOpen(true);
                }}
            />
            <ExpenseSplitsOutgoingPanel
                outgoing={data.expenseSplitRequests?.outgoing ?? []}
                currency={currency}
                onChanged={refresh}
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
                    description={EXPENSES_SUMMARY_COPY.month}
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
                    description={EXPENSES_SUMMARY_COPY.projection}
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
                    description={EXPENSES_SUMMARY_COPY.creditCardDefault}
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
                    description={EXPENSES_SUMMARY_COPY.otherDefault}
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
                allExpenses={data.userExpenses}
                acceptedSplits={acceptedOutgoingSplits(data.expenseSplitRequests)}
                userProfile={userProfile}
                listPeriod={listPeriod}
                expenseDisplayDate={expenseDisplayDate}
                accountLabel={(id) => accountName(data.userAccounts, id)}
                statusLabel={(m) =>
                    expenseRowAppearsPaid(
                        m,
                        accountById.get(String(m.accountId)),
                        userProfile,
                        listPeriod
                    )
                        ? 'Pago'
                        : 'Pendente'
                }
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
                onSplit={(m) => {
                    setSplitExpense(m);
                    setSplitModalOpen(true);
                }}
                onEdit={(m) => {
                    setSplitSeed(null);
                    setEditing(m);
                    setModalOpen(true);
                }}
                onDelete={(m) => void onDelete(m)}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(key) => toggleSort(key as ExpenseSortKey)}
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
                splitSeed={splitSeed}
                onClose={() => {
                    setModalOpen(false);
                    setSplitSeed(null);
                    setEditing(null);
                }}
                onSaved={refresh}
            />
            <ExpenseSplitModal
                open={splitModalOpen}
                expense={splitExpense}
                accounts={data.userAccounts}
                outgoing={data.expenseSplitRequests?.outgoing ?? []}
                currency={currency}
                onClose={() => {
                    setSplitModalOpen(false);
                    setSplitExpense(null);
                }}
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