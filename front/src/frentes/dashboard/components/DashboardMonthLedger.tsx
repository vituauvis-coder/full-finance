import { useCallback, useEffect, useMemo, useState } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { confirmExpenseCashOut } from '../../dinheiro/api/movements';
import { playPingSound } from '../../../app/uiSounds';
import type { Account, Movement, SplitBundle, UserProfile } from '../../../lib/types/finance';
import { buildMonthLedgerItems, buildYearLedgerItems } from '../domain/monthLedger';
import {
    enrichLedgerExtratoItems,
    enrichLedgerExtratoItemsForYear,
    type EnrichedLedgerItem
} from '../domain/ledgerExtratoEnrichment';
import { enrichLedgerItems, type LedgerVisualBucket } from '../domain/ledgerItemVisual';
import { LedgerBucketFilter, useLedgerBucketFilter } from './LedgerBucketFilter';
import { LedgerExtratoRow } from './LedgerExtratoRow';

type Props = {
    year: number;
    monthIndex: number;
    /** Dia ativo no calendário (só filtra o extrato com `scope === 'day'`). */
    selectedDay: number | null;
    scope: 'day' | 'month';
    onScopeChange: (scope: 'day' | 'month') => void;
    expenses: Movement[];
    gains: Movement[];
    accounts: Account[];
    currency: string;
    userProfile?: UserProfile | null;
    splitBundle?: SplitBundle;
    /** Dentro da Carteira (sem coluna fixa do painel). */
    embedded?: boolean;
    /** Extrato do ano civil inteiro (clique no ano na toolbar). */
    civilYearScope?: boolean;
};

function countByBucket(items: Array<{ bucket: LedgerVisualBucket }>) {
    const counts: Partial<Record<LedgerVisualBucket, number>> = {};
    for (const it of items) {
        counts[it.bucket] = (counts[it.bucket] ?? 0) + 1;
    }
    return counts;
}

export function DashboardMonthLedger({
    year,
    monthIndex,
    selectedDay,
    scope,
    onScopeChange,
    expenses,
    gains,
    accounts,
    currency,
    userProfile = null,
    splitBundle,
    embedded = false,
    civilYearScope = false
}: Props) {
    const { refresh } = useFinanceData();
    const [confirmBusy, setConfirmBusy] = useState<string | null>(null);
    const filterDay = scope === 'day' ? selectedDay : null;
    const { hidden, toggle, showAll } = useLedgerBucketFilter();
    const [pendingPayOnly, setPendingPayOnly] = useState(false);
    const baseItems = useMemo(() => {
        try {
            const raw = civilYearScope
                ? buildYearLedgerItems(expenses, gains, accounts, year)
                : buildMonthLedgerItems(expenses, gains, accounts, year, monthIndex, filterDay);
            return enrichLedgerItems(raw, expenses, gains, accounts);
        } catch (err) {
            console.error('DashboardMonthLedger baseItems', err);
            return [];
        }
    }, [expenses, gains, accounts, year, monthIndex, filterDay, civilYearScope]);

    const [items, setItems] = useState<EnrichedLedgerItem[]>([]);

    useEffect(() => {
        let cancelled = false;
        setItems(baseItems.map((it) => ({ ...it, cashOutPaySlot: 'none' as const })));

        const run = () => {
            if (cancelled) return;
            try {
                setItems(
                    civilYearScope
                        ? enrichLedgerExtratoItemsForYear({
                              items: baseItems,
                              expenses,
                              gains,
                              accounts,
                              userProfile,
                              splitBundle,
                              year
                          })
                        : enrichLedgerExtratoItems({
                              items: baseItems,
                              expenses,
                              gains,
                              accounts,
                              userProfile,
                              splitBundle,
                              year,
                              monthIndex,
                              filterDay
                          })
                );
            } catch (err) {
                console.error('DashboardMonthLedger items', err);
            }
        };

        if (typeof requestIdleCallback !== 'undefined') {
            const id = requestIdleCallback(run, { timeout: 1200 });
            return () => {
                cancelled = true;
                cancelIdleCallback(id);
            };
        }
        const t = window.setTimeout(run, 0);
        return () => {
            cancelled = true;
            window.clearTimeout(t);
        };
    }, [baseItems, expenses, gains, accounts, userProfile, splitBundle, year, monthIndex, filterDay, civilYearScope]);

    const onConfirmCashOut = useCallback(
        async (expenseId: string, periodKey: string) => {
            const busyKey = `${expenseId}:${periodKey}`;
            if (confirmBusy === busyKey) return;
            setConfirmBusy(busyKey);
            try {
                await confirmExpenseCashOut(expenseId, periodKey);
                playPingSound();
                await refresh();
            } finally {
                setConfirmBusy(null);
            }
        },
        [confirmBusy, refresh]
    );

    const pendingCashOutCount = useMemo(
        () => items.filter((it) => it.cashOutPaySlot === 'todo').length,
        [items]
    );

    const bucketCounts = useMemo(() => countByBucket(items), [items]);
    const visible = useMemo(() => {
        let base = hidden.size === 0 ? items : items.filter((it) => !hidden.has(it.bucket));
        if (pendingPayOnly) {
            base = base.filter((it) => it.cashOutPaySlot === 'todo');
        }
        return [...base].sort((a, b) => {
            const aP = a.cashOutPaySlot === 'todo' ? 1 : 0;
            const bP = b.cashOutPaySlot === 'todo' ? 1 : 0;
            if (aP !== bP) return bP - aP;
            const am = a.monthIndex ?? 0;
            const bm = b.monthIndex ?? 0;
            if (am !== bm) return bm - am;
            if (a.day !== b.day) return b.day - a.day;
            return b.amount - a.amount;
        });
    }, [items, hidden, pendingPayOnly]);

    useEffect(() => {
        showAll();
        setPendingPayOnly(false);
    }, [scope, filterDay, year, monthIndex, showAll]);

    const shellClass = embedded
        ? 'wallet-embedded-ledger'
        : 'dashboard-tri-col dashboard-tri-col--ledger';
    const headClass = embedded ? 'wallet-embedded-ledger__head' : 'dashboard-tri-col__head';
    const titleClass = embedded ? 'wallet-embedded-ledger__title' : 'dashboard-tri-col__title';
    const scrollClass = embedded
        ? 'wallet-embedded-ledger__scroll dashboard-tri-col__scroll dashboard-month-ledger__list-wrap'
        : 'dashboard-tri-col__scroll dashboard-month-ledger__list-wrap';

    return (
        <section className={shellClass} aria-label={civilYearScope ? 'Extrato do ano' : 'Extrato do mês'}>
            <header className={headClass}>
                <div className="dashboard-month-ledger__head-main">
                    <div className="dashboard-month-ledger__title-row">
                        <h2 className={titleClass}>
                            <MaterialIcon name="receipt_long" variant="app" opticalSize={18} aria-hidden />
                            Extrato
                        </h2>
                        {pendingCashOutCount > 0 ? (
                            <button
                                type="button"
                                className={`dashboard-month-ledger__pending-badge${
                                    pendingPayOnly ? ' is-active' : ''
                                }`}
                                title={
                                    pendingPayOnly
                                        ? 'Mostrar todos os lançamentos'
                                        : 'Filtrar só pagamentos a confirmar no saldo'
                                }
                                aria-pressed={pendingPayOnly}
                                aria-label={`${pendingCashOutCount} pagamento(s) a confirmar`}
                                onClick={() => setPendingPayOnly((v) => !v)}
                            >
                                {pendingCashOutCount}
                            </button>
                        ) : null}
                    </div>
                </div>
                {civilYearScope ? null : (
                    <div
                        className="dashboard-month-ledger__scope"
                        role="group"
                        aria-label="Recorte do extrato"
                    >
                        <button
                            type="button"
                            className={`dashboard-month-ledger__scope-btn${scope === 'day' ? ' is-active' : ''}`}
                            aria-pressed={scope === 'day'}
                            onClick={() => onScopeChange('day')}
                        >
                            Dia
                        </button>
                        <button
                            type="button"
                            className={`dashboard-month-ledger__scope-btn${scope === 'month' ? ' is-active' : ''}`}
                            aria-pressed={scope === 'month'}
                            onClick={() => onScopeChange('month')}
                        >
                            Mês
                        </button>
                    </div>
                )}
            </header>
            {items.length > 0 ? (
                <LedgerBucketFilter
                    counts={bucketCounts}
                    hidden={hidden}
                    onToggle={toggle}
                    onShowAll={showAll}
                />
            ) : null}
            <div className={scrollClass}>
                {visible.length === 0 ? (
                    <p className="dashboard-month-ledger__empty">
                        {pendingPayOnly
                            ? 'Nenhum pagamento pendente neste recorte.'
                            : items.length === 0
                              ? 'Nenhum lançamento neste recorte.'
                              : 'Nenhum tipo selecionado — toque em Todos ou nos ícones.'}
                    </p>
                ) : (
                    <ul className="cash-heatmap-day-panel__list dashboard-month-ledger__list">
                        {visible.map((it) => (
                            <LedgerExtratoRow
                                key={it.id}
                                item={it}
                                currency={currency}
                                day={it.day}
                                variant="ledger"
                                paySlot={it.cashOutPaySlot ?? 'none'}
                                confirmBusyKey={confirmBusy}
                                onConfirmCashOut={
                                    it.cashOutPaySlot === 'todo' && it.cashOutConfirm
                                        ? () =>
                                              void onConfirmCashOut(
                                                  it.cashOutConfirm!.expenseId,
                                                  it.cashOutConfirm!.periodKey
                                              )
                                        : undefined
                                }
                            />
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}