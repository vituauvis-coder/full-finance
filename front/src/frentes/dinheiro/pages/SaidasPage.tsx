import { useCallback, useEffect, useMemo, useState } from 'react';
import { acceptedOutgoingSplits } from '../../dashboard/domain/splitRequestsForBalance';
import { MovementSummaryCard, MovementSummaryCardsGrid } from '../../../components/finance/MovementSummaryCard';
import { MovementsTable } from '../../../components/finance/MovementsTable';
import { ExpenseFormModal } from '../../../components/finance/ExpenseFormModal';
import { ExpenseDetailModal } from '../../../components/finance/ExpenseDetailModal';
import { TablePaginationBar } from '../../../components/finance/TablePaginationBar';
import { CategoryTreemap } from '../../../components/finance/CategoryTreemap';
import { MovementListFilterRibbon } from '../../../components/finance/MovementListFilterRibbon';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { formatBRL } from '../../../lib/format';
import {
    ALL_YEARS_PERIOD,
    CIVIL_YEAR_PERIOD,
    expenseInstallmentListPeriodForPills,
    getPeriodDateBounds,
    isAllYearsPeriod,
    isCivilYearPeriod,
    isExpenseInstallmentMonthRingMode,
    MONTH_NAMES,
    monthIndexFromPeriod
} from '../../../lib/period';
import { resolveExpenseMovementAccount } from '../../../lib/expenseMovementAccount';
import {
    expandInstallmentRowsForExpenseList,
    expenseInstallmentRowDisplayDate,
    isExpenseInstallmentTableRow,
    type ExpenseInstallmentTableRow
} from '../domain/expenseInstallmentTableRows';
import { useCivilPeriodState } from '../../../hooks/useCivilPeriodState';
import { accountName, type ListFilter } from '../../../lib/movementList';
import { expenseRowDisplayDate, filterExpensesInPeriod } from '../../../lib/filterExpensesInPeriod';
import { capCofrinhoTreemapBlocks, capTreemapBlocks, EXPENSE_TREEMAP_PALETTE } from '../../../lib/treemapData';
import { buildExpenseTreemapBlocks } from '../../../lib/expenseTreemap';
import { useTablePagination } from '../../../hooks/useTablePagination';
import { compareExpenseRows, useMovementSort, type ExpenseSortKey } from '../../../hooks/useMovementSort';
import {
    EXPENSE_SORT_KEYS,
    EXPENSES_LEDGER_SORT_STORAGE_KEY
} from '../../../lib/movementLedgerStorage';
import { useExpensesLedgerViewMode } from '../../../hooks/useExpensesLedgerViewMode';
import {
    buildExpenseInvoiceBundles,
    splitExpenseLedgerRows
} from '../domain/expenseLedgerBuckets';
import { ExpensesTabbedLedger } from '../components/ExpensesTabbedLedger';
import { usePeriodSyncedDrawerDates } from '../../../hooks/usePeriodSyncedDrawerDates';
import { ExpenseBatchModal } from '../../../components/finance/ExpenseBatchModal';
import {
    expenseCashOutPeriodKey,
    expenseDueInListPeriod,
    expenseRowAppearsPaid,
    expenseRowCanConfirmCashOut
} from '../../../lib/expenseRowCashOut';
import { MovementsPageSkeleton } from '../../../components/skeleton/MovementsPageSkeleton';
import { useFinanceShellVeil } from '../../../hooks/useFinanceShellVeil';
import { movementDate } from '../../../lib/period';
import { useMovementListFilters } from '../context/MovementListFiltersContext';
import { confirmExpenseCashOut, deleteExpense, patchExpensesBatch } from '../api/movements';
import { playPingSound } from '../../../app/uiSounds';
import { MovementBatchBar } from '../../../components/finance/MovementBatchBar';
import { ExpenseSplitsBanner } from '../components/ExpenseSplitsBanner';
import { ExpenseSplitsOutgoingModal } from '../components/ExpenseSplitsOutgoingModal';
import { ExpenseSplitModal } from '../components/ExpenseSplitModal';
import { CivilPeriodToolbar } from '../../../components/finance/CivilPeriodToolbar';
import { useMovementHeaderAdd } from '../hooks/useMovementHeaderAdd';
import { useMovementHeaderIcon } from '../hooks/useMovementHeaderIcon';
import { useOpenCreateFromNavigation } from '../hooks/useOpenCreateFromNavigation';
import {
    aggregateExpenseTotalsAllYears,
    aggregateExpenseTotalsCivilYear,
    buildExpenseTreemapBlocksAllYears,
    buildExpenseTreemapBlocksCivilYear
} from '../domain/expenseCivilYearTotals';
import {
    EXPENSE_COFRINHO_CATEGORY
} from '../domain/cofrinhoConstants';
import { filterCofrinhoSaidasListRows } from '../domain/cofrinhoInflowEvents';
import {
    buildCofrinhoSaidasExtratoMovements,
    filterCofrinhoSaidasExtratoForList,
    isCofrinhoApplicationExtratoRow
} from '../domain/cofrinhoSaidasExtrato';
import {
    aggregateCofrinhoCategoryTotalsFromFiltered,
    buildCofrinhoCashOutTreemapBlocks,
    patchExpenseTreemapCofrinhoCategory,
    type CofrinhoSaidasMetricsInput
} from '../domain/cofrinhoSaidasTotals';
import {
    civilMonthKey,
    expenseSummaryFromRows,
    expenseSummaryMomStates
} from '../domain/expenseSummaryStats';
import {
    EXPENSES_SUMMARY_COPY,
    expensesSummaryTitles
} from '../../../lib/movementSummaryCopy';
import { SummaryMomVariation } from '../../../components/finance/SummaryMomVariation';
import type { ExpenseSplitSeed, Movement } from '../../../lib/types/finance';
import { useConfirm } from '../../../components/ui/confirm';
import { isCreditCardType } from '../../../lib/accounts';
import { getExpenseListRowDisplayAmount } from '@motor/dinheiro/expense-list-display-amount.js';
import { expenseIdForSplitLookup } from '@motor/dinheiro/split-net.js';

function resolveExpenseForSplit(row: Movement, userExpenses: Movement[] | undefined): Movement {
    const baseId = expenseIdForSplitLookup(row);
    const stored = userExpenses?.find((e) => e.id === baseId);
    if (stored) return stored;
    if (baseId === row.id) return row;
    return { ...row, id: baseId };
}

export function SaidasPage() {
    const { confirm } = useConfirm();
    const { data, loading, error, refresh } = useFinanceData();
    const showSkeleton = useFinanceShellVeil('expenses');
    const listFilters = useMovementListFilters();
    const { period, year, onPeriodChange, onYearChange } = useCivilPeriodState();
    const [modalOpen, setModalOpen] = useState(false);
    const [detailExpense, setDetailExpense] = useState<Movement | null>(null);
    const [editing, setEditing] = useState<Movement | null>(null);
    const [splitSeed, setSplitSeed] = useState<ExpenseSplitSeed | null>(null);
    const [splitModalOpen, setSplitModalOpen] = useState(false);
    const [splitExpense, setSplitExpense] = useState<Movement | null>(null);
    const [selected, setSelected] = useState<Set<string>>(() => new Set());
    const [batchModalOpen, setBatchModalOpen] = useState(false);
    const [outgoingSplitsOpen, setOutgoingSplitsOpen] = useState(false);

    const currency = data?.userProfile?.currency ?? 'BRL';
    const userProfile = data?.userProfile ?? null;
    const pendingOutgoingCount = useMemo(() => {
        const outgoing = data?.expenseSplitRequests?.outgoing ?? [];
        return outgoing.filter((s) => s && String(s.status).toUpperCase() === 'PENDING').length;
    }, [data?.expenseSplitRequests?.outgoing]);
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

    const cofrinhoCategoryFilter = (drawer?.category || '') === EXPENSE_COFRINHO_CATEGORY;

    const filtered = useMemo(() => {
        if (!data) return [];
        const rows = filterExpensesInPeriod(data.userExpenses, data.userAccounts, period, year, {
            q: listFilters?.searchQ ?? '',
            paymentStatus,
            accountId: drawer?.accountId || undefined,
            category: drawer?.category || undefined,
            amountMin: Number.isFinite(amountMin) ? amountMin : null,
            amountMax: Number.isFinite(amountMax) ? amountMax : null,
            dateFrom: drawer?.dateFrom || undefined,
            dateTo: drawer?.dateTo || undefined
        });
        return filterCofrinhoSaidasListRows(
            rows,
            data.cofrinhoBuckets ?? [],
            data.cofrinhoApplications ?? [],
            cofrinhoCategoryFilter
        );
    }, [
        cofrinhoCategoryFilter,
        data,
        period,
        year,
        listFilters?.searchQ,
        paymentStatus,
        drawer,
        amountMin,
        amountMax
    ]);

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
            if (isExpenseInstallmentTableRow(m)) return expenseInstallmentRowDisplayDate(m);
            const acc = resolveExpenseMovementAccount(m, data?.userAccounts);
            return expenseRowDisplayDate(m, acc, period, year);
        },
        [data?.userAccounts, period, year]
    );

    const { sortKey, sortDir, toggleSort, sortRows } = useMovementSort<ExpenseSortKey>(
        filtered,
        'date',
        compareExpenseRows,
        EXPENSES_LEDGER_SORT_STORAGE_KEY,
        EXPENSE_SORT_KEYS
    );
    const sortedBase = useMemo(() => sortRows(accountLabelFn), [sortRows, accountLabelFn]);
    const { viewMode, setViewMode } = useExpensesLedgerViewMode();

    const listPeriod = useMemo(() => getPeriodDateBounds(period, year), [period, year]);

    const installmentListPeriod = useMemo(
        () => expenseInstallmentListPeriodForPills(period, listPeriod),
        [period, listPeriod]
    );

    const expenseMonthRingMode = useMemo(
        () => isExpenseInstallmentMonthRingMode(period, year),
        [period, year]
    );

    const sorted = useMemo(() => {
        if (!data || expenseMonthRingMode) return sortedBase;
        return expandInstallmentRowsForExpenseList(
            sortedBase,
            data.userAccounts,
            userProfile,
            installmentListPeriod
        );
    }, [sortedBase, data, expenseMonthRingMode, userProfile, installmentListPeriod]);

    const acceptedSplitsForDisplay = useMemo(
        () => acceptedOutgoingSplits(data?.expenseSplitRequests),
        [data?.expenseSplitRequests]
    );

    const ledgerSplit = useMemo(() => {
        const { essential, faturaLines, other, cofrinhos } = splitExpenseLedgerRows(sorted, accountById);
        const allExpenses = data?.userExpenses ?? null;
        const bundles = buildExpenseInvoiceBundles(
            faturaLines,
            accountById,
            accountLabelFn,
            (m) => {
                const d = expenseDisplayDate(m);
                return Number.isNaN(d.getTime()) ? '' : d.toISOString();
            },
            (m, acc) => getExpenseListRowDisplayAmount(m, acc, acceptedSplitsForDisplay, allExpenses)
        );
        const invoices = [...bundles.map((b) => b.summary)].sort((a, b) =>
            compareExpenseRows(a, b, sortKey, sortDir, accountLabelFn)
        );
        return { essential, other, faturaLines, bundles, invoices, cofrinhos };
    }, [
        sorted,
        accountById,
        accountLabelFn,
        expenseDisplayDate,
        sortKey,
        sortDir,
        data?.userExpenses,
        acceptedSplitsForDisplay
    ]);

    const expensesLedgerControls = {
        sortKey,
        sortDir,
        onSelectSort: toggleSort,
        viewMode,
        onViewModeChange: setViewMode
    };

    const periodLabel = useMemo(() => {
        if (isAllYearsPeriod(period)) return 'Todos os anos';
        if (isCivilYearPeriod(period)) {
            return `${year} (ano inteiro)`;
        }
        const mi = monthIndexFromPeriod(period);
        return `${MONTH_NAMES[mi]} ${year} (${listPeriod.startDate.toLocaleDateString('pt-BR')} – ${listPeriod.endDate.toLocaleDateString('pt-BR')})`;
    }, [period, year, listPeriod]);

    const onYearScopeSelect = useCallback(() => {
        onPeriodChange(CIVIL_YEAR_PERIOD);
    }, [onPeriodChange]);
    const onAllYearsSelect = useCallback(() => onPeriodChange(ALL_YEARS_PERIOD), [onPeriodChange]);

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

    const summarySplitOpts = useMemo(() => {
        const splits = acceptedOutgoingSplits(data?.expenseSplitRequests);
        return {
            splitRequests: splits,
            allUserExpenses: data?.userExpenses ?? null,
            monthKey: civilMonthKey(period, year) ?? ''
        };
    }, [data?.expenseSplitRequests, data?.userExpenses, period, year]);

    const cofrinhoSaidasMetrics = useMemo((): CofrinhoSaidasMetricsInput | null => {
        if (!data) return null;
        return {
            allExpenses: data.userExpenses,
            filtered,
            accounts: data.userAccounts,
            buckets: data.cofrinhoBuckets ?? [],
            applications: data.cofrinhoApplications ?? [],
            monthlyBalances: data.cofrinhoMonthlyBalances ?? [],
            tripPayloadOutflows: data.cofrinhoTripPayloadOutflows ?? [],
            period,
            civilYear: year,
            splitOpts: summarySplitOpts,
            accountFilterId: drawer?.accountId || undefined
        };
    }, [data, drawer?.accountId, filtered, period, summarySplitOpts, year]);

    const cofrinhoExtratoRows = useMemo(() => {
        if (!cofrinhoSaidasMetrics) return [];
        const raw = buildCofrinhoSaidasExtratoMovements(cofrinhoSaidasMetrics);
        return filterCofrinhoSaidasExtratoForList(raw, cofrinhoSaidasMetrics, listFilter);
    }, [cofrinhoSaidasMetrics, listFilter]);

    const sortedCofrinhoExtrato = useMemo(() => {
        const arr = [...cofrinhoExtratoRows];
        arr.sort((a, b) => compareExpenseRows(a, b, sortKey, sortDir, accountLabelFn));
        return arr;
    }, [cofrinhoExtratoRows, sortKey, sortDir, accountLabelFn]);

    const simpleListSource = cofrinhoCategoryFilter ? sortedCofrinhoExtrato : sorted;
    const pagination = useTablePagination(simpleListSource.length, 'expenses');
    const rows = simpleListSource.slice(pagination.start, pagination.end);

    const expenseSummary = useMemo(() => {
        if (!data || !statusFilterActive) return { showHint: true as const };
        if (cofrinhoCategoryFilter && cofrinhoSaidasMetrics) {
            return {
                showHint: false as const,
                ...aggregateCofrinhoCategoryTotalsFromFiltered(cofrinhoSaidasMetrics)
            };
        }
        if (isCivilYearPeriod(period)) {
            return {
                showHint: false as const,
                ...aggregateExpenseTotalsCivilYear(
                    data.userExpenses,
                    data.userAccounts,
                    year,
                    listFilter,
                    summarySplitOpts,
                    data.userProfile
                )
            };
        }
        if (isAllYearsPeriod(period)) {
            return {
                showHint: false as const,
                ...aggregateExpenseTotalsAllYears(
                    data.userExpenses,
                    data.userAccounts,
                    listFilter,
                    summarySplitOpts,
                    data.userProfile
                )
            };
        }
        return expenseSummaryFromRows(filtered, data.userAccounts, statusFilterActive, summarySplitOpts);
    }, [
        cofrinhoCategoryFilter,
        cofrinhoSaidasMetrics,
        data,
        filtered,
        listFilter,
        period,
        statusFilterActive,
        summarySplitOpts,
        year
    ]);

    const treemapBlocks = useMemo(() => {
        if (!data || !cofrinhoSaidasMetrics) return [];
        if (cofrinhoCategoryFilter) {
            return buildCofrinhoCashOutTreemapBlocks(cofrinhoSaidasMetrics);
        }
        let blocks: ReturnType<typeof buildExpenseTreemapBlocks>;
        if (isCivilYearPeriod(period)) {
            blocks = buildExpenseTreemapBlocksCivilYear(
                data.userExpenses,
                data.userAccounts,
                year,
                listFilter,
                summarySplitOpts,
                data.userProfile
            );
        } else if (isAllYearsPeriod(period)) {
            blocks = buildExpenseTreemapBlocksAllYears(
                data.userExpenses,
                data.userAccounts,
                listFilter,
                summarySplitOpts,
                data.userProfile
            );
        } else {
            blocks = buildExpenseTreemapBlocks(filtered, data.userAccounts);
        }
        return patchExpenseTreemapCofrinhoCategory(blocks, cofrinhoSaidasMetrics);
    }, [cofrinhoCategoryFilter, cofrinhoSaidasMetrics, data, period, year, filtered, listFilter, summarySplitOpts]);

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
            listFilter,
            summarySplitOpts
        );
    }, [data, expenseSummary, period, year, listFilter, summarySplitOpts]);
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

    const resolveExpenseBaseRow = useCallback(
        (m: Movement) => {
            const id = m.id.includes('::inst-') ? m.id.split('::inst-')[0] : m.id;
            return data?.userExpenses.find((e) => e.id === id) ?? m;
        },
        [data?.userExpenses]
    );

    const openExpenseView = useCallback(
        (m: Movement) => {
            if (isCofrinhoApplicationExtratoRow(m)) return;
            setDetailExpense(resolveExpenseBaseRow(m));
        },
        [resolveExpenseBaseRow]
    );

    const expenseStatusLabel = useCallback(
        (m: Movement) => {
            if (isExpenseInstallmentTableRow(m)) {
                return (m as ExpenseInstallmentTableRow).__instParcelPaid ? 'Pago' : 'Pendente';
            }
            const acc = resolveExpenseMovementAccount(m, data?.userAccounts);
            return expenseRowAppearsPaid(m, acc, userProfile, installmentListPeriod ?? listPeriod)
                ? 'Pago'
                : 'Pendente';
        },
        [data?.userAccounts, userProfile, installmentListPeriod, listPeriod]
    );

    useMovementHeaderAdd('add-expense-btn', openAddModal);
    const outgoingSplitsHeader = useMemo(() => {
        if (pendingOutgoingCount === 0) return null;
        return {
            id: 'expense-splits-outgoing-btn',
            icon: 'schedule_send',
            title: 'Pedidos de estorno aguardando resposta',
            badge: pendingOutgoingCount,
            onClick: () => setOutgoingSplitsOpen(true)
        };
    }, [pendingOutgoingCount]);
    useMovementHeaderIcon(outgoingSplitsHeader);
    useEffect(() => {
        if (pendingOutgoingCount === 0) setOutgoingSplitsOpen(false);
    }, [pendingOutgoingCount]);
    useOpenCreateFromNavigation(openAddModal);

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
        <section id="expenses-page" className="page active movements-page--modern movements-page--compact">
            <CivilPeriodToolbar
                period={period}
                year={year}
                onPeriodChange={onPeriodChange}
                onYearChange={onYearChange}
                accent="expenses"
                inMovementsToolbar
                onYearScopeSelect={onYearScopeSelect}
                onAllYearsSelect={onAllYearsSelect}
            />
            <ExpenseSplitsBanner
                onAcceptSplit={(seed) => {
                    setEditing(null);
                    setSplitSeed(seed);
                    setModalOpen(true);
                }}
            />
            <div className="movements-treemap-hero movements-treemap-hero--expenses">
            <MovementSummaryCardsGrid
                group="expenses"
                ariaLabel="Resumo de saídas"
                className="movements-treemap-hero__summary"
            >
                <MovementSummaryCard
                    cardId="expenses-summary-month"
                    tone="expense"
                    icon="calendar_month"
                    iconTooltip={false}
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
                    icon="anchor"
                    iconTooltip={false}
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
                    icon="credit_card"
                    iconTooltip={false}
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
                    icon="account_balance_wallet"
                    iconTooltip={false}
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
                <div className="movements-treemap-hero__map" aria-label="Mapa de saídas por categoria">
                    <CategoryTreemap
                        containerId="expenses-treemap-container"
                        canvasId="expenses-spending-treemap-canvas"
                        blocks={treemapBlocks}
                        currency={currency}
                        palette={EXPENSE_TREEMAP_PALETTE}
                        periodLabel={periodLabel}
                        title="Mapa de Saídas"
                        emptyMessage="Nenhuma saída no período selecionado."
                        compact
                        capBlocks={cofrinhoCategoryFilter ? capCofrinhoTreemapBlocks : capTreemapBlocks}
                    />
                </div>
            </div>
            <MovementBatchBar
                count={selected.size}
                entityLabel="saída"
                onClear={() => setSelected(new Set())}
                onMarkPaid={() => void batchPatch({ isPaid: true })}
                onMarkUnpaid={() => void batchPatch({ isPaid: false })}
                onEditBatch={() => setBatchModalOpen(true)}
            />
            <div className="movements-extrato-panel movements-extrato-panel--expenses" aria-label="Extrato de saídas">
                <MovementListFilterRibbon
                    kind="expense"
                    tone="expenses"
                    mapStatus={{ paidLabel: 'Pago', unpaidLabel: 'Pendente' }}
                    expensesLedgerControls={expensesLedgerControls}
                />
            {viewMode === 'split' ? (
                <ExpensesTabbedLedger
                    essentialRows={ledgerSplit.essential}
                    otherRows={ledgerSplit.other}
                    cofrinhoRows={sortedCofrinhoExtrato}
                    invoiceRows={ledgerSplit.invoices}
                    invoiceBundles={ledgerSplit.bundles}
                    currency={currency}
                    expenseAccounts={data.userAccounts}
                    allExpenses={data.userExpenses}
                    acceptedSplits={acceptedOutgoingSplits(data.expenseSplitRequests)}
                    userProfile={userProfile}
                    listPeriod={installmentListPeriod ?? listPeriod}
                    expenseDisplayDate={expenseDisplayDate}
                    accountById={accountById}
                    accountLabel={(id) => accountName(data.userAccounts, id)}
                    statusLabel={expenseStatusLabel}
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
                    onSplit={(m) => {
                        setSplitExpense(resolveExpenseForSplit(m, data.userExpenses));
                        setSplitModalOpen(true);
                    }}
                    onEdit={(m) => {
                        if (isCofrinhoApplicationExtratoRow(m)) return;
                        setSplitSeed(null);
                        setEditing(resolveExpenseBaseRow(m));
                        setModalOpen(true);
                    }}
                    onView={openExpenseView}
                    onDelete={(m) => {
                        if (isCofrinhoApplicationExtratoRow(m)) return;
                        void onDelete(m);
                    }}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                />
            ) : (
                <>
            <MovementsTable
                idPrefix="expenses"
                rows={rows}
                currency={currency}
                expenseAccounts={data.userAccounts}
                allExpenses={data.userExpenses}
                acceptedSplits={acceptedOutgoingSplits(data.expenseSplitRequests)}
                userProfile={userProfile}
                listPeriod={installmentListPeriod ?? listPeriod}
                expenseDisplayDate={expenseDisplayDate}
                accountLabel={(id) => accountName(data.userAccounts, id)}
                statusLabel={expenseStatusLabel}
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
                    setSplitExpense(resolveExpenseForSplit(m, data.userExpenses));
                    setSplitModalOpen(true);
                }}
                onEdit={(m) => {
                    if (isCofrinhoApplicationExtratoRow(m)) return;
                    setSplitSeed(null);
                    setEditing(resolveExpenseBaseRow(m));
                    setModalOpen(true);
                }}
                onDelete={(m) => {
                    if (isCofrinhoApplicationExtratoRow(m)) return;
                    void onDelete(resolveExpenseBaseRow(m));
                }}
                onRowClick={openExpenseView}
                rowClassName="expenses-detail-row"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(key) => toggleSort(key as ExpenseSortKey)}
            />
            <TablePaginationBar
                page={pagination.page}
                pageCount={pagination.pageCount}
                total={simpleListSource.length}
                pageSize={pagination.pageSize}
                onPageSizeChange={pagination.setPageSize}
                onPrev={pagination.prev}
                onNext={pagination.next}
            />
                </>
            )}
            </div>
            <ExpenseDetailModal
                open={detailExpense != null}
                expense={detailExpense}
                currency={currency}
                accountById={accountById}
                expenseAccounts={data.userAccounts}
                allExpenses={data.userExpenses}
                acceptedSplits={acceptedOutgoingSplits(data.expenseSplitRequests)}
                userProfile={userProfile}
                listPeriod={listPeriod}
                expenseDisplayDate={expenseDisplayDate}
                accountLabel={(id) => accountName(data.userAccounts, id)}
                statusLabel={(m) =>
                    expenseRowAppearsPaid(m, accountById.get(String(m.accountId)), userProfile, listPeriod)
                        ? 'Pago'
                        : 'Pendente'
                }
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                onToggleStatus={(m) => void onToggleStatus(m)}
                statusToggleBusy={statusToggleBusy}
                onSplit={(m) => {
                    setSplitExpense(resolveExpenseForSplit(m, data.userExpenses));
                    setSplitModalOpen(true);
                }}
                onEdit={(m) => {
                    if (isCofrinhoApplicationExtratoRow(m)) return;
                    setSplitSeed(null);
                    setEditing(m);
                    setModalOpen(true);
                }}
                onDelete={(m) => {
                    if (isCofrinhoApplicationExtratoRow(m)) return;
                    void onDelete(m);
                }}
                onClose={() => setDetailExpense(null)}
            />
            <ExpenseFormModal
                open={modalOpen}
                editing={editing}
                accounts={data.userAccounts}
                ownerUserId={data.userProfile?.id}
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
                ownerUserId={data.userProfile?.id}
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
                ownerUserId={data.userProfile?.id}
                onClose={() => setBatchModalOpen(false)}
                onSaved={async () => {
                    setSelected(new Set());
                    await refresh();
                }}
            />
            <ExpenseSplitsOutgoingModal
                open={outgoingSplitsOpen}
                outgoing={data.expenseSplitRequests?.outgoing ?? []}
                currency={currency}
                onClose={() => setOutgoingSplitsOpen(false)}
                onChanged={refresh}
            />
        </section>
    );
}