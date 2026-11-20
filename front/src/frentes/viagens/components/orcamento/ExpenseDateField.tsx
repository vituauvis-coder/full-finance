import { useEffect, useMemo, useRef, useState } from 'react';
import { parseDayKey } from '@motor/viagens/calendar-format.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatTripDayShort, monthTitlePt, shiftMonth, todayKey, WEEK_SHORT_PT } from '../../utils/tripCalendar';

function ymd(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthCells(year: number, month: number) {
    const pad = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ key: string | null; day: number | null }> = [];
    for (let i = 0; i < pad; i++) cells.push({ key: null, day: null });
    for (let d = 1; d <= days; d++) cells.push({ key: ymd(year, month, d), day: d });
    return cells;
}

type Props = {
    value?: string;
    onChange: (isoDate: string) => void;
};

export function ExpenseDateField({ value, onChange }: Props) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const dateKey = value?.trim().slice(0, 10) ?? '';
    const selected = dateKey ? parseDayKey(dateKey) : null;
    const initial = selected ?? new Date();
    const [cursor, setCursor] = useState({ year: initial.getFullYear(), month: initial.getMonth() });

    useEffect(() => {
        if (!open) return;
        const origin = (dateKey ? parseDayKey(dateKey) : null) ?? new Date();
        setCursor({ year: origin.getFullYear(), month: origin.getMonth() });
    }, [open, dateKey]);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        window.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            window.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor]);
    const today = todayKey();
    const label = dateKey ? formatTripDayShort(dateKey) : 'Escolher data';

    return (
        <div className="orc-exp-date" ref={rootRef}>
            <button
                type="button"
                className={`orc-exp-date__trigger${dateKey ? '' : ' is-empty'}`}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                <span>{label}</span>
                <MaterialIcon name="calendar_month" variant="app" opticalSize={15} />
            </button>
            {open ? (
                <div className="orc-exp-date__pop" role="dialog" aria-label="Data do lançamento">
                    <header className="orc-exp-date__nav">
                        <button
                            type="button"
                            className="orc-exp-date__nav-btn"
                            aria-label="Mês anterior"
                            onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
                        >
                            <MaterialIcon name="chevron_left" variant="app" opticalSize={16} />
                        </button>
                        <p>{monthTitlePt(cursor.year, cursor.month)}</p>
                        <button
                            type="button"
                            className="orc-exp-date__nav-btn"
                            aria-label="Próximo mês"
                            onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
                        >
                            <MaterialIcon name="chevron_right" variant="app" opticalSize={16} />
                        </button>
                    </header>
                    <div className="orc-exp-date__week" aria-hidden="true">
                        {WEEK_SHORT_PT.map((d) => (
                            <span key={d}>{d.replace('.', '').slice(0, 3)}</span>
                        ))}
                    </div>
                    <div className="orc-exp-date__grid">
                        {cells.map((cell, i) => {
                            if (!cell.key || cell.day == null) {
                                return <span key={`e-${i}`} className="orc-exp-date__day is-empty" />;
                            }
                            const isSel = dateKey === cell.key;
                            const isToday = cell.key === today;
                            return (
                                <button
                                    key={cell.key}
                                    type="button"
                                    className={`orc-exp-date__day${isSel ? ' is-on' : ''}${isToday ? ' is-today' : ''}`}
                                    onClick={() => {
                                        onChange(cell.key);
                                        setOpen(false);
                                    }}
                                >
                                    {cell.day}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}