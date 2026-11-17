import { useCallback, useMemo, useState } from 'react';
import { MovementSummaryCard, MovementSummaryCardsGrid } from '../../../components/finance/MovementSummaryCard';
import { MovementsTable } from '../../../components/finance/MovementsTable';
import { GainFormModal } from '../../../components/finance/GainFormModal';
import { TablePaginationBar } from '../../../components/finance/TablePaginationBar';
import { CategoryTreemap } from '../../../components/finance/CategoryTreemap';
import { MovementListFilterDrawer } from '../../../components/finance/MovementListFilterDrawer';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { formatBRL } from '../../../lib/format';
import { defaultCivilYear, defaultPeriod, getPeriodDateBounds, MONTH_NAMES, monthIndexFromPeriod } from '../../../lib/period';
import { accountName, filterMovementsInPeriod, type ListFilter } from '../../../lib/movementList';
import { INCOME_TREEMAP_PALETTE } from '../../../lib/treemapData';
import { buildGainTreemapBlocks } from '../../../lib/gainTreemap';
import { useTablePagination } from '../../../hooks/useTablePagination';
import { ScreenLoader } from '../../../components/ui/ScreenLoader';
import { compareGainRows, useMovementSort, type GainSortKey } from '../../../hooks/useMovementSort';
import { usePeriodSyncedDrawerDates } from '../../../hooks/usePeriodSyncedDrawerDates';
import { GainBatchModal } from '../../../components/finance/GainBatchModal';
import { useMovementListFilters } from '../context/MovementListFiltersContext';
import { deleteGain, patchGainsBatch } from '../api/movements';
import { useMovementStatusToggle } from '../../../hooks/useMovementStatusToggle';
import { MovementBatchBar } from '../../../components/finance/MovementBatchBar';
import { MovementListToolbar } from '../components/MovementListToolbar';
import { useMovementHeaderAdd } from '../hooks/useMovementHeaderAdd';
import { gainSummaryFromRows, gainSummaryMomStates, gainSummaryMomWhenHint } from '../domain/gainSummaryStats';
import { GAINS_SUMMARY_COPY, gainsSummaryTitles } from '../../../lib/movementSummaryCopy';
import { SummaryMomVariation } from '../../../components/finance/SummaryMomVariation';
import type { Movement } from '../../../lib/types/finance';

export function EntradasPage() {
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
        return filterMovementsInPeriod(data.userGains, period, year, {
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

    const { sortKey, sortDir, toggleSort, sortRows } = useMovementSort<GainSortKey>(
        filtered,
        'date',
        compareGainRows
    );

    const sorted = useMemo(() => sortRows(accountLabelFn), [sortRows, accountLabelFn]);

    const pagination = useTablePagination(sorted.length, 'gains');
    const rows = sorted.slice(pagination.start, pagination.end);

    const periodLabel = useMemo(() => {
        const mi = monthIndexFromPeriod(period);
        const { startDate, endDate } = getPeriodDateBounds(period, year);
        return `${MONTH_NAMES[mi]} ${year} (${startDate.toLocaleDateString('pt-BR')} – ${endDate.toLocaleDateString('pt-BR')})`;
    }, [period, year]);

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
        if (!window.confirm('Excluir esta entrada?')) return;
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

    if (loading) {
        return (
            <section className="page active">
                <ScreenLoader label="Carregando entradas" />
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
        <section id="gains-page" className="page active movements-page--modern">
            <MovementListToolbar
                period={period}
                year={year}
                onPeriodChange={setPeriod}
                onYearChange={setYear}
                timelineClass="civil-period-timeline--gains"
            />
            <MovementSummaryCardsGrid group="gains" ariaLabel="Resumo de entradas">
                <MovementSummaryCard
                    cardId="gains-summary-total"
                    tone="income"
                    icon="fa-calendar-check"
                    title={gainTitles.total}
                    value={
                        gainSummary.showHint ? (
                            <span className="card-metric-hint" title={gainHint}>
                                —
                            </span>
                        ) : (
                            formatBRL(gainSummary.received, currency)
                        )
                    }
                    iconTooltip={false}
                    footer={
                        gainSummary.showHint ? (
                            <span className="card-metric-hint">{gainHint}</span>
                        ) : (
                            <SummaryMomVariation state={gainMom.received} />
                        )
                    }
                />
                <MovementSummaryCard
                    cardId="gains-summary-projection"
                    tone="income"
                    icon="fa-clock"
                    title={gainTitles.projection}
                    value={
                        gainSummary.showHint ? (
                            <span className="card-metric-hint" title={gainHint}>
                                —
                            </span>
                        ) : (
                            formatBRL(gainSummary.pending, currency)
                        )
                    }
                    iconTooltip={false}
                    footer={
                        gainSummary.showHint ? (
                            <span className="card-metric-hint">{gainHint}</span>
                        ) : (
                            <SummaryMomVariation state={gainMom.pending} />
                        )
                    }
                />
                <MovementSummaryCard
                    cardId="gains-summary-top-cat"
                    tone="income"
                    icon="fa-tags"
                    title={gainTitles.topCategory}
                    value={
                        gainSummary.showHint ? (
                            <span className="card-metric-hint" title={gainHint}>
                                —
                            </span>
                        ) : (
                            gainSummary.topCategory
                        )
                    }
                    iconTooltip={false}
                    footer={
                        gainSummary.showHint ? (
                            <span className="card-metric-hint">{gainHint}</span>
                        ) : (
                            <SummaryMomVariation state={gainMom.topCategory} />
                        )
                    }
                />
            </MovementSummaryCardsGrid>
            <MovementBatchBar
                count={selected.size}
                entityLabel="entrada"
                onClear={() => setSelected(new Set())}
                onMarkReceived={() => void batchPatch({ isPaid: true })}
                onMarkPending={() => void batchPatch({ isPaid: false })}
                onEditBatch={() => setBatchModalOpen(true)}
            />
            <CategoryTreemap
                containerId="gains-treemap-container"
                canvasId="gains-income-treemap-canvas"
                blocks={treemapBlocks}
                currency={currency}
                palette={INCOME_TREEMAP_PALETTE}
                periodLabel={periodLabel}
                title="Mapa de Entradas"
                emptyMessage="Nenhuma entrada no período selecionado."
            />
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
            <MovementListFilterDrawer id="gains-filter-drawer" title="Filtrar entradas" kind="gain" />
        </section>
    );
}