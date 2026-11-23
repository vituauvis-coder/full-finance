import { useCallback, useEffect, useMemo, useState } from 'react';
import { CivilPeriodToolbar } from '../../../components/finance/CivilPeriodToolbar';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { useCivilPeriodState } from '../../../hooks/useCivilPeriodState';
import { monthIndexFromPeriod } from '../../../lib/period';
import { apiFetch } from '../../../lib/http';
import { ZeroBudgetSummaryPanel } from '../components/ZeroBudgetSummaryPanel';
import { ZeroBudgetBlocksGrid } from '../components/zero-budget/ZeroBudgetBlocksGrid';
import { ZeroBudgetCreateBlockModal } from '../components/ZeroBudgetCreateBlockModal';
import { ZeroBudgetBlockTodosModal } from '../components/ZeroBudgetBlockTodosModal';
import { useZeroBudgetHeaderRegistration } from '../context/ZeroBudgetHeaderSlotContext';
import {
    blocksWithAllocationPreviews,
    calcTotalAllocated,
    zeroBudgetAvailableBalance
} from '../domain/zeroBudgetPlanning';
import type { ZeroBudgetBlock } from '../domain/zeroBudgetTypes';
import { ZeroBudgetPageSkeleton } from '../../../components/skeleton/ZeroBudgetPageSkeleton';
import { useFinanceShellVeil } from '../../../hooks/useFinanceShellVeil';

export function PlanejamentoPage() {
    const { data, loading, error } = useFinanceData();
    const showInitialSkeleton = useFinanceShellVeil('zero-budget');
    const { period, year, onPeriodChange, onYearChange } = useCivilPeriodState();
    const [blocks, setBlocks] = useState<ZeroBudgetBlock[]>([]);
    const [blocksLoading, setBlocksLoading] = useState(true);
    const [blocksError, setBlocksError] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [todosBlockId, setTodosBlockId] = useState<string | null>(null);
    const [allocationPreviews, setAllocationPreviews] = useState<Record<string, number>>({});

    const currency = data?.userProfile?.currency ?? 'BRL';
    const month = monthIndexFromPeriod(period) + 1;

    const openCreate = useCallback(() => setCreateOpen(true), []);
    useZeroBudgetHeaderRegistration(openCreate);

    const loadBlocks = useCallback(async () => {
        setBlocksError(null);
        setBlocksLoading(true);
        try {
            const r = await apiFetch<{ blocks: ZeroBudgetBlock[] }>(`/api/zero-budget?month=${month}&year=${year}`);
            setBlocks(r.blocks ?? []);
        } catch (e) {
            setBlocks([]);
            setBlocksError(e instanceof Error ? e.message : 'Erro ao carregar blocos');
        } finally {
            setBlocksLoading(false);
        }
    }, [month, year]);

    useEffect(() => {
        if (!data) return;
        void loadBlocks();
    }, [loadBlocks, data]);

    useEffect(() => {
        setAllocationPreviews({});
    }, [month, year]);

    const blocksForUi = useMemo(
        () => blocksWithAllocationPreviews(blocks, allocationPreviews),
        [blocks, allocationPreviews]
    );

    const onAllocationPreview = useCallback((blockId: string, value: number) => {
        setAllocationPreviews((prev) => ({ ...prev, [blockId]: value }));
    }, []);

    const clearAllocationPreview = useCallback((blockId: string) => {
        setAllocationPreviews((prev) => {
            if (prev[blockId] === undefined) return prev;
            const next = { ...prev };
            delete next[blockId];
            return next;
        });
    }, []);

    const planning = useMemo(() => {
        if (!data) return { available: 0, allocated: 0 };
        const available = zeroBudgetAvailableBalance(data, month, year);
        const allocated = calcTotalAllocated(blocksForUi);
        return { available, allocated };
    }, [data, month, year, blocksForUi]);

    const todosBlock = useMemo(
        () => blocks.find((b) => b.id === todosBlockId) ?? null,
        [blocks, todosBlockId]
    );

    if (showInitialSkeleton) {
        return <ZeroBudgetPageSkeleton />;
    }

    if (error || !data) {
        return (
            <section id="zero-budget-page" className="page active zero-budget-page">
                <p role="alert">{error ?? 'Sem dados'}</p>
            </section>
        );
    }

    return (
        <section id="zero-budget-page" className="page active zero-budget-page" aria-label="Planejamento Base Zero">
            <div className="zero-budget">
                <CivilPeriodToolbar
                    period={period}
                    year={year}
                    onPeriodChange={onPeriodChange}
                    onYearChange={onYearChange}
                    accent="zero-budget"
                />
                <ZeroBudgetSummaryPanel
                    currency={currency}
                    availableBalance={planning.available}
                    totalAllocated={planning.allocated}
                    blocks={blocksForUi}
                />
                {blocksError ? <p role="alert">{blocksError}</p> : null}
                <ZeroBudgetBlocksGrid
                    blocks={blocksForUi}
                    availableBalance={planning.available}
                    currency={currency}
                    isRefreshing={blocksLoading}
                    onBlocksChange={loadBlocks}
                    onAllocationPreview={onAllocationPreview}
                    onAllocationPreviewClear={clearAllocationPreview}
                    onOpenTodos={setTodosBlockId}
                />
            </div>
            {createOpen ? (
                <ZeroBudgetCreateBlockModal
                    open
                    onClose={() => setCreateOpen(false)}
                    month={month}
                    year={year}
                    blocks={blocks}
                    expenses={data.userExpenses ?? []}
                    onCreated={loadBlocks}
                />
            ) : null}
            <ZeroBudgetBlockTodosModal
                open={todosBlockId != null}
                block={todosBlock}
                currency={currency}
                onClose={() => setTodosBlockId(null)}
            />
        </section>
    );
}