import { useEffect, useMemo, useRef, useState } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatFlightStamp, formatFlightLocal, parseFlightLocal, toDatetimeLocal } from '../../domain/flightDisplay';
import { WEEK_SHORT_PT, monthTitlePt, shiftMonth, todayKey } from '../../utils/tripCalendar';

const TIME_PRESETS = Array.from({ length: 18 }, (_, i) => `${String(i + 5).padStart(2, '0')}:00`);

type Props = {
    label: string;
    value: string | null;
    onChange: (next: string | null) => void;
    hint?: string | null;
    min?: string | null;
    tripStart?: string;
    tripEnd?: string;
    defaultTime?: string;
};

function split(value?: string | null): { date: string; time: string } {
    const local = toDatetimeLocal(value);
    if (!local) return { date: '', time: '' };
    const [date, time] = local.split('T');
    return { date, time: (time ?? '').slice(0, 5) };
}

function join(date: string, time: string, fallbackTime: string): string | null {
    if (!date) return null;
    return `${date}T${time || fallbackTime}`;
}

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

export function FlightDateTimeField({
    label,
    value,
    onChange,
    hint,
    min,
    tripStart,
    tripEnd,
    defaultTime = '08:00'
}: Props) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const current = split(value);
    const minDate = split(min).date;
    const selected = parseFlightLocal(value);
    const initialMonth = selected ?? parseFlightLocal(min) ?? (tripStart ? parseFlightLocal(`${tripStart}T12:00`) : null) ?? new Date();
    const [cursor, setCursor] = useState({ year: initialMonth.getFullYear(), month: initialMonth.getMonth() });

    useEffect(() => {
        if (!open) return;
        const origin = selected ?? parseFlightLocal(min) ?? new Date();
        setCursor({ year: origin.getFullYear(), month: origin.getMonth() });
    }, [open, value, min]);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.stopImmediatePropagation();
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
    const stamp = formatFlightStamp(value);

    useEffect(() => {
        if (!open) return;
        const on = rootRef.current?.querySelector('.voos-dt__times .is-on');
        on?.scrollIntoView({ block: 'nearest' });
    }, [open, current.time]);

    function commit(date: string, time: string) {
        const next = join(date, time, defaultTime);
        if (!next) {
            onChange(null);
            return;
        }
        if (min) {
            const a = parseFlightLocal(min);
            const b = parseFlightLocal(next);
            if (a && b && b.getTime() <= a.getTime()) {
                onChange(formatFlightLocal(new Date(a.getTime() + 60 * 60_000)));
                return;
            }
        }
        onChange(next);
    }

    return (
        <div className="voos-field voos-dt" ref={rootRef}>
            <span>
                {label}
                {hint ? <em className="voos-dt__hint">{hint}</em> : null}
            </span>
            <button
                type="button"
                className={`viagens-field voos-dt__trigger${value ? '' : ' is-empty'}`}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                <span>{stamp ?? 'Data e horário'}</span>
                <MaterialIcon name="calendar_month" variant="app" opticalSize={16} />
            </button>
            {open ? (
                <div className="voos-dt__pop" role="dialog" aria-label={label}>
                    <div className="voos-dt__cal">
                        <header className="voos-dt__nav">
                            <button
                                type="button"
                                className="voos-dt__nav-btn"
                                aria-label="Mês anterior"
                                onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
                            >
                                <MaterialIcon name="chevron_left" variant="app" opticalSize={18} />
                            </button>
                            <p>{monthTitlePt(cursor.year, cursor.month)}</p>
                            <button
                                type="button"
                                className="voos-dt__nav-btn"
                                aria-label="Próximo mês"
                                onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
                            >
                                <MaterialIcon name="chevron_right" variant="app" opticalSize={18} />
                            </button>
                        </header>
                        <div className="voos-dt__week" aria-hidden="true">
                            {WEEK_SHORT_PT.map((d) => (
                                <span key={d}>{d.replace('.', '')}</span>
                            ))}
                        </div>
                        <div className="voos-dt__grid">
                            {cells.map((cell, i) => {
                                if (!cell.key || cell.day == null) {
                                    return <span key={`e-${i}`} className="voos-dt__day is-empty" />;
                                }
                                const disabled = Boolean(minDate && cell.key < minDate);
                                const inTrip = Boolean(
                                    tripStart && tripEnd && cell.key >= tripStart && cell.key <= tripEnd
                                );
                                const isSel = current.date === cell.key;
                                const isToday = cell.key === today;
                                return (
                                    <button
                                        key={cell.key}
                                        type="button"
                                        disabled={disabled}
                                        className={`voos-dt__day${isSel ? ' is-on' : ''}${inTrip ? ' is-trip' : ''}${isToday ? ' is-today' : ''}`}
                                        onClick={() => commit(cell.key as string, current.time || defaultTime)}
                                    >
                                        {cell.day}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="voos-dt__side">
                        <p className="voos-dt__time-label">Horário</p>
                        <div className="voos-dt__times">
                            {TIME_PRESETS.map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    className={current.time === t ? 'is-on' : undefined}
                                    onClick={() => commit(current.date || today, t)}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        <input
                            className="viagens-field voos-dt__exact"
                            type="time"
                            value={current.time}
                            onChange={(e) => commit(current.date || today, e.target.value)}
                            aria-label="Horário exato"
                        />
                        {value ? (
                            <button type="button" className="voos-text-btn" onClick={() => onChange(null)}>
                                Limpar
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
