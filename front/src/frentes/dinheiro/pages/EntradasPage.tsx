import { useCallback, useMemo, useState } from 'react';
import {
    ALL_YEARS_PERIOD,
    CIVIL_YEAR_PERIOD,
    isAllYearsPeriod,
    isCivilYearPeriod,
    monthIndexFromPeriod
} from '../../../lib/period';
import { MovementSummaryCard, MovementSummaryCardsGrid } from '../../../components/finance/MovementSummaryCard';
import { MovementsTable } from '../../../components/finance/MovementsTable';
import { GainFormModal } from '../../../components/finance/GainFormModal';
import { TablePaginationBar } from '../../../components/finance/TablePaginationBar';
import { CategoryTreemap } from '../../../components/finance/CategoryTreemap';
import { MovementListFilterRibbon } from '../../../components/finance/MovementListFilterRibbon';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { formatBRL } from '../../../lib/format';
import { getPeriodDateBounds, MONTH_NAMES } from '../../../lib/period';
import { useCivilPeriodState } from '../../../hooks/useCivilPeriodState';
import { accountName, filterMovementsInPeriod, type ListFilter } from '../../../lib/movementList';
import { INCOME_TREEMAP_PALETTE } from '../../../lib/treemapData';
import { buildGainTreemapBlocks } from '../../../lib/gainTreemap';
import { useTablePagination } from '../../../hooks/useTablePagination';
import { MovementsPageSkeleton } from '../../../components/skeleton/MovementsPageSkeleton';
import { useSkeletonMinDuration } from '../../../hooks/useSkeletonMinDuration';
import { compareGainRows, useMovementSort, type GainSortKey } from '../../../hooks/useMovementSort';
import { usePeriodSyncedDrawerDates } from '../../../hooks/usePeriodSyncedDrawerDates';
import { GainBatchModal } from '../../../components/finance/GainBatchModal';
import { useMovementListFilters } from '../context/MovementListFiltersContext';
import { deleteGain, patchGainsBatch } from '../api/movements';
import { useMovementStatusToggle } from '../../../hooks/useMovementStatusToggle';
import { MovementBatchBar } from '../../../components/finance/MovementBatchBar';
import { CivilPeriodToolbar } from '../../../components/finance/CivilPeriodToolbar';
import { useMovementHeaderAdd } from '../hooks/useMovementHeaderAdd';
import { useOpenCreateFromNavigation } from '../hooks/useOpenCreateFromNavigation';
import { gainSummaryFromRows, gainSummaryMomStates, gainSummaryMomWhenHint } from '../domain/gainSummaryStats';
import { GAINS_SUMMARY_COPY, gainsSummaryTitles } from '../../../lib/movementSummaryCopy';
import { SummaryMomVariation } from '../../../components/finance/SummaryMomVariation';
import type { Movement } from '../../../lib/types/finance';
import { useConfirm } from '../../../components/ui/confirm';
import { useGainsLedgerViewMode } from '../../../hooks/useGainsLedgerViewMode';
import { gainEstornoAppearsInLists, isGainEstornoRow } from '../domain/gainEstorno';
import { GainsTabbedLedger } from '../components/GainsTabbedLedger';

export function EntradasPage() {
    const { confirm } = useConfirm();
    const { data, loading, error, refresh } = useFinanceData();
    const showSkeleton = useSkeletonMinDuration(loading);
    const listFilters = useMovementListFilters();
    const { period, year, onPeriodChange, onYearChange } = useCivilPeriodState();
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Movement | null>(null);
    const [selected, setSelected] = useState<Set<string>>(() => new Set());
    const [batchModalOpen, setBatchModalOpen] = useState(false);

    const currency = data?.userProfile?.currency ?? 'BRL';
    const paymentStatus = useMemo(() => {
        const s = new Set<'paid' | 'unpaid'>();
        if (listFilters?.gainsStatus.paid) s.add('paid');
        if (listFilters?.gainsStatus.unpaid) s.add('unpaid');
        return s;
    }, [listFilters?.gainsStatus.paid, listFilters?.gainsStatus.unpaid]);

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
        return filterMovementsInPeriod(
            data.userGains,
            period,
            year,
            {
                q: listFilters?.searchQ ?? '',
                paymentStatus,
                accountId: drawer?.accountId || undefined,
                category: drawer?.category || undefined,
                amountMin: Number.isFinite(amountMin) ? amountMin : null,
                amountMax: Number.isFinite(amountMax) ? amountMax : null,
                dateFrom: drawer?.dateFrom || undefined,
                dateTo: drawer?.dateTo || undefined
            },
            data.userAccounts
        );
    }, [data, period, year, listFilters?.searchQ, paymentStatus, drawer, amountMin, amountMax]);

    const accountLabelFn = useMemo(
        () => (id?: string) => (data ? accountName(data.userAccounts, id) : '—'),
        [data]
    );

    const { sortKey, sortDir, toggleSort, sortRows } = useMovementSort<GainSortKey>(
        filtered,
        'date',
        compareGainRows
    );
    const { viewMode, setViewMode } = useGainsLedgerViewMode();

    const sorted = useMemo(() => sortRows(accountLabelFn), [sortRows, accountLabelFn]);

    const splitSorted = useMemo(() => {
        const category: Movement[] = [];
        const estorno: Movement[] = [];
        for (const m of sorted) {
            if (isGainEstornoRow(m)) {
                if (gainEstornoAppearsInLists(m)) estorno.push(m);
            } else category.push(m);
        }
        return { category, estorno };
    }, [sorted]);

    const pagination = useTablePagination(sorted.length, 'gains');
    const rows = sorted.slice(pagination.start, pagination.end);

    const gainsLedgerControls = {
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
        const { startDate, endDate } = getPeriodDateBounds(period, year);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            return `${MONTH_NAMES[mi]} ${year}`;
        }
        return `${MONTH_NAMES[mi]} ${year} (${startDate.toLocaleDateString('pt-BR')} – ${endDate.toLocaleDateString('pt-BR')})`;
    }, [period, year]);

    const onYearScopeSelect = useCallback(() => {
        onPeriodChange(CIVIL_YEAR_PERIOD);
    }, [onPeriodChange]);
    const onAllYearsSelect = useCallback(() => onPeriodChange(ALL_YEARS_PERIOD), [onPeriodChange]);

    const treemapBlocks = useMemo(() => buildGainTreemapBlocks(filtered), [filtered]);

    const statusFilterActive = Boolean(listFilters?.gainsStatus.paid || listFilters?.gainsStatus.unpaid);
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
    const gainSummary = useMemo(
        () => gainSummaryFromRows(filtered, statusFilterActive),
        [filtered, statusFilterActive]
    );
    const gainMom = useMemo(() => {
        if (!data || gainSummary.showHint) return gainSummaryMomWhenHint();
        return gainSummaryMomStates(data.userGains, period, year, gainSummary, listFilter);
    }, [data, gainSummary, period, year, listFilter]);
    const gainTitles = gainsSummaryTitles();
    const gainHint = GAINS_SUMMARY_COPY.filterRequiredHint;

    async function onDelete(m: { id: string }) {
        const ok = await confirm({
            title: 'Excluir esta entrada?',
            message: 'O lançamento será removido permanentemente.',
            confirmLabel: 'Excluir',
            tone: 'danger'
        });
        if (!ok) return;
        await deleteGain(m.id);
        await refresh();
    }

    async function batchPatch(patch: { isPaid: boolean }) {
        const ids = [...selected];
        if (ids.length === 0) return;
        await patchGainsBatch(ids, patch);
        setSelected(new Set());
        await refresh();
    }

    const patchGainPaid = useCallback(
        (id: string, isPaid: boolean) => patchGainsBatch([id], { isPaid }),
        []
    );
    const { onToggleStatus, statusToggleBusy } = useMovementStatusToggle(patchGainPaid, refresh);

    const openAddModal = useCallback(() => {
        setEditing(null);
        setModalOpen(true);
    }, []);
    useMovementHeaderAdd('add-gain-btn', openAddModal);
    useOpenCreateFromNavigation(openAddModal);

    if (showSkeleton) {
        return (
            <MovementsPageSkeleton
                pageId="gains-page"
                label="Carregando entradas"
                summaryGroup="gains"
                summaryAriaLabel="Resumo de entradas"
                cardCount={3}
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
        <section id="gains-page" className="page active movements-page--modern movements-page--compact">
            <CivilPeriodToolbar
                period={period}
                year={year}
                onPeriodChange={onPeriodChange}
                onYearChange={onYearChange}
                accent="gains"
                inMovementsToolbar
                onYearScopeSelect={onYearScopeSelect}
                onAllYearsSelect={onAllYearsSelect}
            />
            <div className="movements-treemap-hero movements-treemap-hero--gains">
                <MovementSummaryCardsGrid
                    group="gains"
                    ariaLabel="Resumo de entradas"
                    className="movements-treemap-hero__summary"
                >
                    <MovementSummaryCard
                        cardId="gains-summary-total"
                        tone="income"
                        icon="event_available"
                        title={gainTitles.total}
                        value={
                            gainSummary.showHint ? (
                                <span className="card-metric-hint" title={gainHint}>
                                    —
                                </span>
                            ) : (
                                formatBRL(gainSummary.total, currency)
                            )
                        }
                        iconTooltip={false}
                        footer={
                            gainSummary.showHint ? (
                                <span className="card-metric-hint">{gainHint}</span>
                            ) : (
                                <SummaryMomVariation state={gainMom.total} />
                            )
                        }
                    />
                    <MovementSummaryCard
                        cardId="gains-summary-fixed"
                        tone="income"
                        icon="work"
                        title={gainTitles.fixed}
                        description={GAINS_SUMMARY_COPY.fixed}
                        value={
                            gainSummary.showHint ? (
                                <span className="card-metric-hint" title={gainHint}>
                                    —
                                </span>
                            ) : (
                                formatBRL(gainSummary.fixed, currency)
                            )
                        }
                        iconTooltip={false}
                        footer={
                            gainSummary.showHint ? (
                                <span className="card-metric-hint">{gainHint}</span>
                            ) : (
                                <SummaryMomVariation state={gainMom.fixed} />
                            )
                        }
                    />
                    <MovementSummaryCard
                        cardId="gains-summary-extra"
                        tone="income"
                        icon="trending_up"
                        title={gainTitles.extra}
                        description={GAINS_SUMMARY_COPY.extra}
                        value={
                            gainSummary.showHint ? (
                                <span className="card-metric-hint" title={gainHint}>
                                    —
                                </span>
                            ) : (
                                formatBRL(gainSummary.extra, currency)
                            )
                        }
                        iconTooltip={false}
                        footer={
                            gainSummary.showHint ? (
                                <span className="card-metric-hint">{gainHint}</span>
                            ) : (
                                <SummaryMomVariation state={gainMom.extra} />
                            )
                        }
                    />
                </MovementSummaryCardsGrid>
                <div className="movements-treemap-hero__map" aria-label="Mapa de entradas por categoria">
                    <CategoryTreemap
                        containerId="gains-treemap-container"
                        canvasId="gains-income-treemap-canvas"
                        blocks={treemapBlocks}
                        currency={currency}
                        palette={INCOME_TREEMAP_PALETTE}
                        periodLabel={periodLabel}
                        title="Mapa de Entradas"
                        emptyMessage="Nenhuma entrada no período selecionado."
                        compact
                    />
                </div>
            </div>
            <MovementBatchBar
                count={selected.size}
                entityLabel="entrada"
                onClear={() => setSelected(new Set())}
                onMarkReceived={() => void batchPatch({ isPaid: true })}
                onMarkPending={() => void batchPatch({ isPaid: false })}
                onEditBatch={() => setBatchModalOpen(true)}
            />
            <div className="movements-extrato-panel movements-extrato-panel--gains" aria-label="Extrato de entradas">
                <MovementListFilterRibbon
                    kind="gain"
                    tone="gains"
                    mapStatus={{ paidLabel: 'Recebido', unpaidLabel: 'Pendente' }}
                    gainsLedgerControls={gainsLedgerControls}
                />
            {viewMode === 'split' ? (
                <GainsTabbedLedger
                    categoryRows={splitSorted.category}
                    estornoRows={splitSorted.estorno}
                    currency={currency}
                    accountLabel={(id) => accountName(data.userAccounts, id)}
                    statusLabel={(m) => (m.isPaid === false ? 'Pendente' : 'Recebido')}
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
                    onEdit={(m) => {
                        setEditing(m);
                        setModalOpen(true);
                    }}
                    onDelete={(m) => void onDelete(m)}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                />
            ) : (
                <>
                    <MovementsTable
                        idPrefix="gains"
                        rows={rows}
                        currency={currency}
                        accountLabel={(id) => accountName(data.userAccounts, id)}
                        statusLabel={(m) => (m.isPaid === false ? 'Pendente' : 'Recebido')}
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
                        sortKey={sortKey === 'received' ? 'status' : sortKey}
                        sortDir={sortDir}
                        onSort={(key) =>
                            toggleSort((key === 'status' ? 'received' : key) as GainSortKey)
                        }
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
                </>
            )}
            </div>
            <GainFormModal
                open={modalOpen}
                editing={editing}
                accounts={data.userAccounts}
                onClose={() => setModalOpen(false)}
                onSaved={refresh}
            />
            <GainBatchModal
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
        </section>
    );
}