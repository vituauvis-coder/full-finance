import { useId, type ReactNode } from 'react';
import type { DayAgg } from '../../../lib/cashHeatmap';
import { formatBRL } from '../../../lib/format';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { formatHeatmapMonthLabel } from '../../../lib/cashHeatmap';
import { heatmapToneClass } from '../domain/cashHeatmapTone';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const HEATMAP_LEGEND = [
    { swatch: 'empty', label: 'Neutro' },
    { swatch: 'in', label: 'Mais entradas' },
    { swatch: 'out-light', label: 'Mais saídas · leve' },
    { swatch: 'out-mid', label: 'Mais saídas · médio' },
    { swatch: 'out-heavy', label: 'Mais saídas · forte' },
    { swatch: 'due', label: 'Vencimento de fatura' }
] as const;

function dayTooltip(agg: DayAgg, currency: string) {
    const parts: string[] = [];
    if (agg.totalEntrada > 0) parts.push(`Entrada ${formatBRL(agg.totalEntrada, currency)}`);
    if (agg.totalSaida > 0) parts.push(`Saída ${formatBRL(agg.totalSaida, currency)}`);
    for (const inv of agg.faturas || []) {
        parts.push(`Fatura ${inv.cardName}: ${formatBRL(inv.amount, currency)}`);
    }
    return parts.length ? parts.join(' · ') : 'Sem movimentações';
}

type Props = {
    year: number;
    monthIndex: number;
    dayMap: Map<number, DayAgg>;
    selectedDay: number;
    currency: string;
    onSelectDay: (day: number) => void;
};

export function CashHeatmapCalendar({ year, monthIndex, dayMap, selectedDay, currency, onSelectDay }: Props) {
    const legendTitleId = useId();
    const firstDow = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const prevMonthDays = new Date(year, monthIndex, 0).getDate();
    const label = formatHeatmapMonthLabel(year, monthIndex);

    const cells: ReactNode[] = [];

    for (let i = 0; i < firstDow; i++) {
        const num = prevMonthDays - firstDow + i + 1;
        cells.push(
            <span key={`pad-prev-${i}`} className="cash-heatmap-day-btn cash-heatmap-day-btn--muted" aria-hidden="true">
                <span className="cash-heatmap-day-btn__num">{num}</span>
            </span>
        );
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const agg = dayMap.get(day) ?? {
            totalSaida: 0,
            totalEntrada: 0,
            temFatura: false,
            nivelSaida: 0,
            faturas: []
        };
        const tone = heatmapToneClass(agg);
        const tip = dayTooltip(agg, currency);
        const pressed = day === selectedDay;
        cells.push(
            <button
                key={day}
                type="button"
                className={`cash-heatmap-day-btn ${tone}${pressed ? ' cash-heatmap-day-btn--selected' : ''}`}
                aria-pressed={pressed}
                aria-label={`Dia ${day}, ${tip}`}
                title={tip}
                onClick={() => onSelectDay(day)}
            >
                <span className="cash-heatmap-day-btn__num">{day}</span>
                {agg.temFatura ? <span className="cash-heatmap-day-btn__dot" title="Vencimento de fatura" /> : null}
            </button>
        );
    }

    /** Sempre 6 linhas — evita o bloco “pular” de altura entre meses */
    const totalSlots = 42;
    const trailing = totalSlots - firstDow - daysInMonth;
    for (let i = 1; i <= trailing; i++) {
        cells.push(
            <span key={`pad-next-${i}`} className="cash-heatmap-day-btn cash-heatmap-day-btn--muted" aria-hidden="true">
                <span className="cash-heatmap-day-btn__num">{i}</span>
            </span>
        );
    }

    return (
        <div className="cash-heatmap-calendar" aria-live="polite">
            <header className="cash-heatmap-calendar__header">
                <div>
                    <h3 className="cash-heatmap-calendar__title dashboard-section-title">
                        <MaterialIcon name="calendar_month" variant="app" />
                        Heatmap de Caixa
                    </h3>
                    <p className="cash-heatmap-calendar__subtitle">
                        Verde quando entradas superam saídas; vermelho quando saídas superam entradas (intensidade pelo
                        volume).
                    </p>
                </div>
                <div className="cash-heatmap-calendar__month-badge">
                    <MaterialIcon name="calendar_today" variant="app" /> {label}
                </div>
            </header>
            <div className="cash-heatmap-calendar__weekdays" aria-hidden="true">
                {WEEKDAYS.map((d) => (
                    <span key={d} className="cash-heatmap-calendar__weekday">
                        {d}
                    </span>
                ))}
            </div>
            <div className="cash-heatmap-calendar__grid" role="grid" aria-label={`Calendário ${label}`}>
                {cells}
            </div>
            <footer className="cash-heatmap-calendar__legend cash-heatmap-legend">
                <p className="cash-heatmap-legend__title" id={legendTitleId}>
                    Saldo do dia
                </p>
                <ul className="cash-heatmap-legend__list" aria-labelledby={legendTitleId}>
                    {HEATMAP_LEGEND.map((item) => (
                        <li key={item.swatch} className="cash-heatmap-legend__item">
                            <span
                                className={`cash-heatmap-legend-swatch cash-heatmap-legend-swatch--${item.swatch}`}
                                aria-hidden="true"
                            />
                            <span className="cash-heatmap-legend__label">{item.label}</span>
                        </li>
                    ))}
                </ul>
            </footer>
        </div>
    );
}