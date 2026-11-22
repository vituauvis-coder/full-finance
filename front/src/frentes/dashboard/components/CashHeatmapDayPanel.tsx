import { useEffect, useMemo, useRef } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { formatHeatmapMonthLabel } from '../../../lib/cashHeatmap';
import type { DayDetailItem } from '../../../lib/cashHeatmap';
import type { Account, Movement } from '../../../lib/types/finance';
import { enrichLedgerItems } from '../domain/ledgerItemVisual';
import { LedgerExtratoRow } from './LedgerExtratoRow';

type Props = {
    year: number;
    monthIndex: number;
    selectedDay: number;
    items: DayDetailItem[];
    expenses: Movement[];
    gains: Movement[];
    accounts: Account[];
    currency: string;
};

export function CashHeatmapDayPanel({
    year,
    monthIndex,
    selectedDay,
    items,
    expenses,
    gains,
    accounts,
    currency
}: Props) {
    const listRef = useRef<HTMLUListElement>(null);
    const monthLabel = formatHeatmapMonthLabel(year, monthIndex);
    const monthName = monthLabel.split(' ')[0];
    const enriched = useMemo(
        () => enrichLedgerItems(items, expenses, gains, accounts),
        [items, expenses, gains, accounts]
    );

    useEffect(() => {
        const list = listRef.current;
        if (!list || enriched.length === 0) return;

        const syncFade = () => {
            const overflow = list.scrollHeight > list.clientHeight + 4;
            const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 12;
            list.classList.toggle('cash-heatmap-day-panel__list--fade-bottom', overflow && !atBottom);
        };

        syncFade();
        list.addEventListener('scroll', syncFade, { passive: true });
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncFade) : null;
        ro?.observe(list);
        return () => {
            list.removeEventListener('scroll', syncFade);
            ro?.disconnect();
        };
    }, [enriched]);

    return (
        <div className="cash-heatmap-day-panel" aria-live="polite">
            <header className="cash-heatmap-day-panel__head">
                <p className="cash-heatmap-day-panel__label">Detalhes do dia</p>
                <h3 className="cash-heatmap-day-panel__date">
                    {selectedDay} de {monthName}{' '}
                    <span className="cash-heatmap-day-panel__year">{year}</span>
                </h3>
            </header>
            <div className="cash-heatmap-day-panel__list-wrap cash-heatmap-day-panel__list-wrap--scroll-capped">
                {enriched.length === 0 ? (
                    <div className="cash-heatmap-day-panel__empty">
                        <MaterialIcon name="event_busy" variant="app" />
                        <p>
                            O mapa está limpo.
                            <br />
                            Sem movimentações nem faturas neste dia.
                        </p>
                    </div>
                ) : (
                    <ul ref={listRef} className="cash-heatmap-day-panel__list">
                        {enriched.map((it) => (
                            <LedgerExtratoRow key={it.id} item={it} currency={currency} variant="panel" />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}