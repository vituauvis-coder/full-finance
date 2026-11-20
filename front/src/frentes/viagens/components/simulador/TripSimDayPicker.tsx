import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import {
    coerceDayKey,
    cursorFromDayKey,
    formatTripDayShort,
    monthCellsLifeOS,
    monthTitlePt,
    shiftMonth,
    todayKey,
    WEEK_SHORT_PT
} from '../../utils/tripCalendar';

const POP_WIDTH_PX = 232;
const POP_ESTIMATE_PX = 300;

type PopCoords = { top: number; left: number; width: number };

function rectCoords(trigger: HTMLElement, popHeight = POP_ESTIMATE_PX): PopCoords {
    const width = Math.min(POP_WIDTH_PX, window.innerWidth - 16);
    const r = trigger.getBoundingClientRect();
    let left = r.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - width);
    if (left < 8) left = 8;

    let top = r.bottom + 6;
    if (top + popHeight > window.innerHeight - 8) {
        const above = r.top - 6 - popHeight;
        if (above >= 8) top = above;
    }

    return { top, left, width };
}

type Props = {
    value?: string;
    onChange: (isoDate: string) => void;
    placeholder?: string;
};

export function TripSimDayPicker({ value, onChange, placeholder = 'Escolher data' }: Props) {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<PopCoords | null>(null);
    const [pendingKey, setPendingKey] = useState<string | null>(null);
    const dateKey = coerceDayKey(value ?? '') ?? '';
    const displayKey = pendingKey ?? dateKey;
    const [cursor, setCursor] = useState(() => cursorFromDayKey(displayKey || todayKey()));

    const updateCoords = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const popHeight = popRef.current?.offsetHeight ?? POP_ESTIMATE_PX;
        setCoords(rectCoords(trigger, popHeight));
    }, []);

    useEffect(() => {
        if (dateKey && pendingKey === dateKey) setPendingKey(null);
    }, [dateKey, pendingKey]);

    useEffect(() => {
        if (displayKey) setCursor(cursorFromDayKey(displayKey));
    }, [displayKey]);

    useEffect(() => {
        if (!open) return;
        setCursor(cursorFromDayKey(displayKey || todayKey()));
    }, [open, displayKey]);

    useLayoutEffect(() => {
        if (!open) return;
        updateCoords();
        const align = requestAnimationFrame(() => updateCoords());
        window.addEventListener('resize', updateCoords);
        window.addEventListener('scroll', updateCoords, true);
        return () => {
            cancelAnimationFrame(align);
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords, true);
        };
    }, [open, updateCoords, cursor.year, cursor.month]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            setOpen(false);
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [open]);

    const cells = useMemo(() => monthCellsLifeOS(cursor.year, cursor.month), [cursor.year, cursor.month]);
    const today = todayKey();
    const label = displayKey ? formatTripDayShort(displayKey) : placeholder;

    function applyKey(key: string) {
        const k = coerceDayKey(key);
        if (!k) return;
        setPendingKey(k);
        onChange(k);
        setOpen(false);
    }

    function openPicker() {
        if (triggerRef.current) setCoords(rectCoords(triggerRef.current));
        setOpen(true);
    }

    function toggleOpen() {
        if (open) setOpen(false);
        else openPicker();
    }

    const popStyle: CSSProperties | undefined = coords
        ? { top: coords.top, left: coords.left, width: coords.width }
        : undefined;

    const portal =
        open && coords ? (
                <div
                    ref={popRef}
                    className="viagens-sim-date__pop viagens-sim-date__pop--portal"
                    style={popStyle}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Data de início das férias"
                >
                    <header className="viagens-sim-date__nav">
                        <button
                            type="button"
                            className="viagens-sim-date__nav-btn"
                            aria-label="Mês anterior"
                            onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
                        >
                            <MaterialIcon name="chevron_left" variant="app" opticalSize={16} />
                        </button>
                        <p>{monthTitlePt(cursor.year, cursor.month)}</p>
                        <button
                            type="button"
                            className="viagens-sim-date__nav-btn"
                            aria-label="Próximo mês"
                            onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
                        >
                            <MaterialIcon name="chevron_right" variant="app" opticalSize={16} />
                        </button>
                    </header>
                    <div className="viagens-sim-date__week" aria-hidden="true">
                        {WEEK_SHORT_PT.map((d) => (
                            <span key={d}>{d.replace(/\./g, '').slice(0, 3)}</span>
                        ))}
                    </div>
                    <div className="viagens-sim-date__grid">
                        {cells.map((cell, i) => {
                            if (!cell.key || cell.day == null) {
                                return <span key={`e-${i}`} className="viagens-sim-date__day is-empty" />;
                            }
                            const isSel = displayKey === cell.key;
                            const isToday = cell.key === today;
                            return (
                                <button
                                    key={cell.key}
                                    type="button"
                                    className={`viagens-sim-date__day${isSel ? ' is-on' : ''}${isToday ? ' is-today' : ''}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        applyKey(cell.key!);
                                    }}
                                >
                                    {cell.day}
                                </button>
                            );
                        })}
                    </div>
                </div>
        ) : null;

    return (
        <div className="viagens-sim-date">
            <button
                ref={triggerRef}
                type="button"
                className={`viagens-sim-date__trigger${displayKey ? '' : ' is-empty'}`}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={toggleOpen}
                onPaste={(e) => {
                    const text = e.clipboardData.getData('text');
                    const k = coerceDayKey(text);
                    if (k) {
                        e.preventDefault();
                        applyKey(k);
                    }
                }}
            >
                <span>{label}</span>
                <MaterialIcon name="calendar_month" variant="app" opticalSize={15} />
            </button>
            {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
        </div>
    );
}