import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { parseDayKey } from '@motor/viagens/calendar-format.js';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { formatTripDayShort, monthTitlePt, shiftMonth, todayKey, WEEK_SHORT_PT } from '../utils/tripCalendar';

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
    onChange: (isoDate: string | undefined) => void;
};

export function ChecklistDueField({ value, onChange }: Props) {
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [anchor, setAnchor] = useState({ top: 0, left: 0 });

    const dateKey = value?.trim().slice(0, 10) ?? '';
    const selected = dateKey ? parseDayKey(dateKey) : null;
    const initial = selected ?? new Date();
    const [cursor, setCursor] = useState({ year: initial.getFullYear(), month: initial.getMonth() });

    function placePopover() {
        const r = triggerRef.current?.getBoundingClientRect();
        if (!r) return;
        const w = 252;
        const margin = 8;
        const left = Math.max(margin, Math.min(r.right - w, window.innerWidth - w - margin));
        let top = r.bottom + 6;
        const h = 290;
        if (top + h > window.innerHeight - margin) {
            top = Math.max(margin, r.top - h - 6);
        }
        setAnchor({ top, left });
    }

    useLayoutEffect(() => {
        if (!open) return;
        const origin = (dateKey ? parseDayKey(dateKey) : null) ?? new Date();
        setCursor({ year: origin.getFullYear(), month: origin.getMonth() });
        placePopover();
    }, [open, dateKey]);

    useEffect(() => {
        if (!open) return;
        const onReflow = () => placePopover();
        window.addEventListener('resize', onReflow);
        window.addEventListener('scroll', onReflow, true);
        return () => {
            window.removeEventListener('resize', onReflow);
            window.removeEventListener('scroll', onReflow, true);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            const t = e.target as Node;
            if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        const id = window.setTimeout(() => {
            document.addEventListener('click', onDoc, true);
        }, 0);
        window.addEventListener('keydown', onKey, true);
        return () => {
            window.clearTimeout(id);
            document.removeEventListener('click', onDoc, true);
            window.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor]);
    const today = todayKey();
    const hasDate = !!dateKey;

    return (
        <div className="viagens-check-due" ref={rootRef}>
            <button
                ref={triggerRef}
                type="button"
                className={`viagens-checklist-item__due-badge viagens-check-due__trigger${hasDate ? ' has-date' : ''}`}
                aria-haspopup="dialog"
                aria-expanded={open}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen((v) => !v);
                }}
            >
                <MaterialIcon name={hasDate ? 'calendar_month' : 'event'} variant="app" opticalSize={13} />
                {hasDate ? formatTripDayShort(dateKey) : 'Data'}
            </button>
            {open ? (
                <div
                    ref={popRef}
                    className="viagens-check-due__pop"
                    role="dialog"
                    aria-label="Data da tarefa"
                    style={{ top: anchor.top, left: anchor.left }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <header className="viagens-check-due__nav">
                        <button
                            type="button"
                            className="viagens-check-due__nav-btn"
                            aria-label="Mês anterior"
                            onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
                        >
                            <MaterialIcon name="chevron_left" variant="app" opticalSize={16} />
                        </button>
                        <p>{monthTitlePt(cursor.year, cursor.month)}</p>
                        <button
                            type="button"
                            className="viagens-check-due__nav-btn"
                            aria-label="Próximo mês"
                            onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
                        >
                            <MaterialIcon name="chevron_right" variant="app" opticalSize={16} />
                        </button>
                    </header>
                    <div className="viagens-check-due__week" aria-hidden="true">
                        {WEEK_SHORT_PT.map((d) => (
                            <span key={d}>{d.replace('.', '').slice(0, 3)}</span>
                        ))}
                    </div>
                    <div className="viagens-check-due__grid">
                        {cells.map((cell, i) => {
                            if (!cell.key || cell.day == null) {
                                return <span key={`e-${i}`} className="viagens-check-due__day is-empty" />;
                            }
                            const isSel = dateKey === cell.key;
                            const isToday = cell.key === today;
                            return (
                                <button
                                    key={cell.key}
                                    type="button"
                                    className={`viagens-check-due__day${isSel ? ' is-on' : ''}${isToday ? ' is-today' : ''}`}
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
                    {hasDate ? (
                        <button
                            type="button"
                            className="viagens-check-due__clear"
                            onClick={() => {
                                onChange(undefined);
                                setOpen(false);
                            }}
                        >
                            Remover data
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}