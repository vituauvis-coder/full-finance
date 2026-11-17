import { useEffect, useRef } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { formatHeatmapMonthLabel } from '../../../lib/cashHeatmap';
import type { DayDetailItem } from '../../../lib/cashHeatmap';
import { formatBRL } from '../../../lib/format';

function itemIcon(it: DayDetailItem) {
    if (it.kind === 'gain') return 'trending_up';
    if (it.kind === 'invoice') return 'receipt_long';
    if (it.pending) return 'pending_actions';
    return 'trending_down';
}

function itemTone(it: DayDetailItem) {
    if (it.kind === 'gain') return 'gain';
    if (it.kind === 'invoice') return 'invoice';
    if (it.pending) return 'pending';
    return 'expense';
}

type Props = {
    year: number;
    monthIndex: number;
    selectedDay: number;
    items: DayDetailItem[];
    currency: string;
};

export function CashHeatmapDayPanel({ year, monthIndex, selectedDay, items, currency }: Props) {
    const listRef = useRef<HTMLUListElement>(null);
    const monthLabel = formatHeatmapMonthLabel(year, monthIndex);
    const monthName = monthLabel.split(' ')[0];

    useEffect(() => {
        const list = listRef.current;
        if (!list || items.length === 0) return;

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
    }, [items]);

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
                {items.length === 0 ? (
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
                        {items.map((it) => {
                            const tone = itemTone(it);
                            const sign = it.kind === 'gain' ? '+' : it.kind === 'invoice' ? '' : '−';
                            const prefix = sign ? `${sign} ` : '';
                            return (
                                <li key={it.id} className="cash-heatmap-day-item cash-heatmap-day-item--compact">
                                    <span
                                        className={`cash-heatmap-day-item__icon cash-heatmap-day-item__icon--${tone}`}
                                        aria-hidden="true"
                                    >
                                        <MaterialIcon name={itemIcon(it)} variant="app" />
                                    </span>
                                    <div className="cash-heatmap-day-item__body">
                                        <span className="cash-heatmap-day-item__title">{it.title}</span>
                                        <span className="cash-heatmap-day-item__meta">
                                            {[it.bank, it.tag].filter(Boolean).join(' · ')}
                                        </span>
                                    </div>
                                    <span className={`cash-heatmap-day-item__amount cash-heatmap-day-item__amount--${tone}`}>
                                        {prefix}
                                        {formatBRL(it.amount, currency)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}