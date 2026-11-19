import { useCallback, useEffect, useMemo, useState } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import {
    anchorMonth,
    applyRangeDayClick,
    formatTripDayShort,
    monthTitlePt,
    shiftMonth,
    toDateKeyLocal,
    todayKey,
    WEEK_SHORT_PT
} from '../utils/tripCalendar';
import '../styles/trip-calendar.css';

function inRange(key: string, start: string, end: string): boolean {
    if (!start) return false;
    if (!end) return key === start;
    return key >= start && key <= end;
}

type Props = {
    startsOn: string;
    endsOn: string;
    onStartsChange: (value: string) => void;
    onEndsChange: (value: string) => void;
    /** Dia ISO da próxima tarefa (chip «Próxima tarefa»). */
    nextTaskDayKey?: string | null;
    scenarioCount?: number;
    onOpenSimulador?: () => void;
};

export function TripCalendarCard({
    startsOn,
    endsOn,
    onStartsChange,
    onEndsChange,
    nextTaskDayKey,
    scenarioCount = 0,
    onOpenSimulador
}: Props) {
    const start = startsOn.trim();
    const end = endsOn.trim();

    const [view, setView] = useState(() => anchorMonth(start, end));

    useEffect(() => {
        if (!start && !end) return;
        const next = anchorMonth(start, end);
        setView((prev) => (prev.year === next.year && prev.month === next.month ? prev : next));
    }, [start, end]);

    const monthTitle = monthTitlePt(view.year, view.month);

    const grid = useMemo(() => {
        const first = new Date(view.year, view.month, 1);
        const lastDay = new Date(view.year, view.month + 1, 0).getDate();
        const pad = first.getDay();
        const cells: { key: string; day: number; empty: boolean }[] = [];
        for (let i = 0; i < pad; i++) cells.push({ key: `pad-${i}`, day: 0, empty: true });
        for (let d = 1; d <= lastDay; d++) {
            cells.push({ key: toDateKeyLocal(view.year, view.month, d), day: d, empty: false });
        }
        while (cells.length < 42) {
            cells.push({ key: `pad-end-${cells.length}`, day: 0, empty: true });
        }
        return cells;
    }, [view.year, view.month]);

    const goMonth = useCallback((delta: number) => {
        setView((v) => shiftMonth(v.year, v.month, delta));
    }, []);

    const focusMonthOf = useCallback((key: string | null | undefined) => {
        if (!key?.trim()) return;
        const d = new Date(`${key.trim().slice(0, 10)}T12:00:00`);
        if (Number.isNaN(d.getTime())) return;
        setView({ year: d.getFullYear(), month: d.getMonth() });
    }, []);

    const onDayClick = useCallback(
        (key: string) => {
            const next = applyRangeDayClick(key, start, end);
            onStartsChange(next.startsOn);
            onEndsChange(next.endsOn);
        },
        [start, end, onStartsChange, onEndsChange]
    );

    const clearRange = useCallback(() => {
        onStartsChange('');
        onEndsChange('');
    }, [onStartsChange, onEndsChange]);

    return (
        <article className="viagens-panel viagens-panel--cal viagens-cal--smart" aria-label="Calendário da viagem">
            <header className="viagens-cal__nav">
                <button type="button" className="viagens-cal__nav-btn" aria-label="Mês anterior" onClick={() => goMonth(-1)}>
                    <MaterialIcon name="chevron_left" variant="app" opticalSize={18} />
                </button>
                <h3 className="viagens-cal__nav-title">{monthTitle}</h3>
                <button type="button" className="viagens-cal__nav-btn" aria-label="Próximo mês" onClick={() => goMonth(1)}>
                    <MaterialIcon name="chevron_right" variant="app" opticalSize={18} />
                </button>
            </header>

            <div className="viagens-cal__chips" role="toolbar" aria-label="Atalhos do calendário">
                <button type="button" className="viagens-cal__chip" onClick={() => focusMonthOf(start || end)}>
                    <MaterialIcon name="flag" variant="app" opticalSize={14} />
                    Viagem
                </button>
                <button
                    type="button"
                    className="viagens-cal__chip"
                    onClick={() => focusMonthOf(nextTaskDayKey ?? start ?? todayKey())}
                >
                    <MaterialIcon name="task_alt" variant="app" opticalSize={14} />
                    Próxima tarefa
                </button>
                <button type="button" className="viagens-cal__chip" onClick={() => focusMonthOf(todayKey())}>
                    <MaterialIcon name="today" variant="app" opticalSize={14} />
                    Hoje
                </button>
            </div>

            <div className="viagens-cal__week" aria-hidden="true">
                {WEEK_SHORT_PT.map((w) => (
                    <span key={w}>{w}</span>
                ))}
            </div>

            <div className="viagens-cal__grid" role="grid" aria-label={`Dias de ${monthTitle}`}>
                {grid.map((cell) => {
                    if (cell.empty) {
                        return <span key={cell.key} className="viagens-cal__day-btn viagens-cal__day-btn--empty" />;
                    }
                    const key = cell.key;
                    const classes = ['viagens-cal__day-btn'];
                    const inR = inRange(key, start, end);
                    if (inR) classes.push('viagens-cal__day-btn--in-range');
                    if (start && key === start) classes.push('viagens-cal__day-btn--start');
                    if (end && key === end) classes.push('viagens-cal__day-btn--end');
                    const selected = inR || key === start || key === end;
                    return (
                        <button
                            key={key}
                            type="button"
                            className={classes.join(' ')}
                            aria-pressed={selected}
                            aria-label={`Dia ${cell.day}`}
                            onClick={() => onDayClick(key)}
                        >
                            {cell.day}
                        </button>
                    );
                })}
            </div>

            <footer className="viagens-cal__footer">
                <div className="viagens-cal__bound viagens-cal__bound--start">
                    <span>Início</span>
                    <strong>{start ? formatTripDayShort(start) : '—'}</strong>
                </div>
                <div className="viagens-cal__bound viagens-cal__bound--end">
                    <span>Fim</span>
                    <strong>{end ? formatTripDayShort(end) : '—'}</strong>
                </div>
                <button type="button" className="viagens-cal__clear" onClick={clearRange} disabled={!start && !end}>
                    Limpar
                </button>
            </footer>
            {onOpenSimulador ? (
                <button type="button" className="viagens-cal__sim" onClick={onOpenSimulador}>
                    <MaterialIcon name="query_stats" variant="app" opticalSize={18} />
                    Simulador
                    <span className="viagens-badge">{scenarioCount}</span>
                </button>
            ) : null}
        </article>
    );
}