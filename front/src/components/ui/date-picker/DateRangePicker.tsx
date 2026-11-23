import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties
} from 'react';
import { createPortal } from 'react-dom';
import { MaterialIcon } from '../../icons/MaterialIcon';
import {
    coerceDayKey,
    cursorFromDayKey,
    formatDateLabelPt,
    isDayKeyInRange,
    monthGridCellsLifeOS,
    monthTitlePt,
    todayKey,
    WEEK_SHORT_PT
} from '../../../lib/calendarUi';
import { DatePickerMonthGrid } from './DatePickerMonthGrid';
import { DatePickerPeriodNav } from './DatePickerPeriodNav';
import {
    type PopCoords,
    type PopoverPlacement,
    popoverCoordsFromTrigger,
    resolvePopoverPlacement
} from './popoverCoords';

const POP_LAYOUT = { widthPx: 304, anchorHeightPx: 400 };

function normalizeRange(from: string, to: string): [string, string] | null {
    const a = coerceDayKey(from);
    const b = coerceDayKey(to);
    if (!a || !b) return null;
    return a <= b ? [a, b] : [b, a];
}

function formatRangeLabel(from: string, to: string, placeholder: string): string {
    const a = coerceDayKey(from);
    const b = coerceDayKey(to);
    if (!a && !b) return placeholder;
    if (a && !b) return `${formatDateLabelPt(a)} → …`;
    if (!a && b) return `… → ${formatDateLabelPt(b)}`;
    if (!a || !b) return placeholder;
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    if (lo === hi) return formatDateLabelPt(lo);
    const loParts = lo.split('-').map(Number);
    const hiParts = hi.split('-').map(Number);
    if (loParts[0] === hiParts[0] && loParts[1] === hiParts[1]) {
        const monthYear = formatDateLabelPt(lo).replace(/^\d+\s/, '').trim();
        return `${loParts[2]}–${hiParts[2]} ${monthYear}`;
    }
    return `${formatDateLabelPt(lo)} – ${formatDateLabelPt(hi)}`;
}

function inOpenRange(key: string, anchor: string, end: string): boolean {
    if (!anchor) return false;
    if (!end) return key === anchor;
    const [lo, hi] = anchor <= end ? [anchor, end] : [end, anchor];
    return key >= lo && key <= hi;
}

export type DateRangePickerProps = {
    id?: string;
    from: string;
    to: string;
    onChange: (from: string, to: string) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    'aria-label'?: string;
};

export function DateRangePicker({
    id,
    from,
    to,
    onChange,
    disabled = false,
    placeholder = 'Período',
    className = '',
    'aria-label': ariaLabel
}: DateRangePickerProps) {
    const fallbackId = useId();
    const fieldId = id ?? fallbackId;
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const placementRef = useRef<PopoverPlacement | null>(null);
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<PopCoords | null>(null);
    const [panel, setPanel] = useState<'days' | 'months'>('days');
    const [draftFrom, setDraftFrom] = useState('');
    const [draftTo, setDraftTo] = useState('');

    const fromKey = coerceDayKey(from) ?? '';
    const toKey = coerceDayKey(to) ?? '';
    const [cursor, setCursor] = useState(() => cursorFromDayKey(fromKey || toKey || todayKey()));

    const updateCoords = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        if (!placementRef.current) {
            placementRef.current = resolvePopoverPlacement(trigger, POP_LAYOUT.anchorHeightPx);
        }
        setCoords(popoverCoordsFromTrigger(trigger, placementRef.current, POP_LAYOUT));
    }, []);

    useEffect(() => {
        if (!open) return;
        setPanel('days');
        setDraftFrom(fromKey);
        setDraftTo(toKey);
        setCursor(cursorFromDayKey(fromKey || toKey || todayKey()));
    }, [open, fromKey, toKey]);

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
    }, [open, updateCoords]);

    useEffect(() => {
        if (!open) placementRef.current = null;
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onPointer = (e: MouseEvent) => {
            const t = e.target as Node;
            if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            setOpen(false);
        };
        document.addEventListener('mousedown', onPointer);
        window.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            window.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    const cells = useMemo(() => monthGridCellsLifeOS(cursor.year, cursor.month), [cursor.year, cursor.month]);
    const today = todayKey();
    const label = formatRangeLabel(fromKey, toKey, placeholder);
    const hint =
        open && draftFrom && !draftTo
            ? 'Escolha a data final'
            : open && !draftFrom
              ? 'Escolha a data inicial'
              : '';

    function commitRange(nextFrom: string, nextTo: string) {
        const norm = normalizeRange(nextFrom, nextTo);
        if (!norm) return;
        onChange(norm[0], norm[1]);
        setOpen(false);
    }

    function selectDay(key: string) {
        if (!draftFrom || (draftFrom && draftTo)) {
            setDraftFrom(key);
            setDraftTo('');
            return;
        }
        commitRange(draftFrom, key);
    }

    function toggleOpen() {
        if (disabled) return;
        if (open) setOpen(false);
        else {
            if (triggerRef.current) {
                placementRef.current = resolvePopoverPlacement(triggerRef.current, POP_LAYOUT.anchorHeightPx);
                setCoords(popoverCoordsFromTrigger(triggerRef.current, placementRef.current, POP_LAYOUT));
            }
            setOpen(true);
        }
    }

    const popStyle: CSSProperties | undefined = coords
        ? { top: coords.top, left: coords.left, width: coords.width }
        : undefined;

    const portal =
        open && coords ? (
            <div
                ref={popRef}
                className="ui-date-picker__pop ui-date-range-picker__pop"
                role="dialog"
                aria-label="Calendário de período"
                style={popStyle}
            >
                <p className="ui-date-range-picker__hint">{hint || 'Toque início e fim do período'}</p>
                {panel === 'months' ? (
                    <DatePickerMonthGrid
                        year={cursor.year}
                        selectedMonth={cursor.month}
                        onYearChange={(year) => setCursor((c) => ({ ...c, year }))}
                        onMonthPick={(monthIndex) => {
                            setCursor((c) => ({ ...c, month: monthIndex }));
                            setPanel('days');
                        }}
                        onBackToDays={() => setPanel('days')}
                    />
                ) : (
                    <>
                <DatePickerPeriodNav
                    cursor={cursor}
                    onCursorChange={setCursor}
                    onOpenMonthGrid={() => setPanel('months')}
                />
                <div className="ui-date-picker__week" aria-hidden="true">
                    {WEEK_SHORT_PT.map((d) => (
                        <span key={d}>{d.replace('.', '').slice(0, 3)}</span>
                    ))}
                </div>
                <div className="ui-date-picker__grid" role="grid" aria-label={monthTitlePt(cursor.year, cursor.month)}>
                    {cells.map((cell, i) => {
                        if (!cell.key || cell.day == null) {
                            return <span key={`empty-${i}`} className="ui-date-picker__day is-empty" />;
                        }
                        const inRange = inOpenRange(cell.key, draftFrom, draftTo);
                        const norm = draftFrom && draftTo ? normalizeRange(draftFrom, draftTo) : null;
                        const isStart = norm ? cell.key === norm[0] : cell.key === draftFrom;
                        const isEnd = norm ? cell.key === norm[1] : false;
                        const isToday = cell.key === today;
                        const outOfRange = !isDayKeyInRange(cell.key);
                        return (
                            <button
                                key={cell.key}
                                type="button"
                                role="gridcell"
                                disabled={outOfRange}
                                className={[
                                    'ui-date-picker__day',
                                    inRange ? 'is-in-range' : '',
                                    isStart ? 'is-range-start' : '',
                                    isEnd ? 'is-range-end' : '',
                                    isToday ? 'is-today' : '',
                                    outOfRange ? 'is-disabled' : ''
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                                onClick={() => selectDay(cell.key!)}
                            >
                                {cell.day}
                            </button>
                        );
                    })}
                </div>
                <footer className="ui-date-picker__footer">
                    <button
                        type="button"
                        className="ui-date-picker__today"
                        onClick={() => {
                            const t = today;
                            commitRange(t, t);
                        }}
                    >
                        Hoje
                    </button>
                    {fromKey || toKey ? (
                        <button
                            type="button"
                            className="ui-date-picker__clear"
                            onClick={() => {
                                onChange('', '');
                                setDraftFrom('');
                                setDraftTo('');
                                setOpen(false);
                            }}
                        >
                            Limpar período
                        </button>
                    ) : null}
                </footer>
                    </>
                )}
            </div>
        ) : null;

    const rootClass = [
        'ui-date-picker',
        'ui-date-range-picker',
        open ? 'is-open' : '',
        className
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={rootClass}>
            <button
                ref={triggerRef}
                id={fieldId}
                type="button"
                className={`ui-date-picker__trigger ui-date-range-picker__trigger ui-control${
                    fromKey || toKey ? '' : ' is-empty'
                }`}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={ariaLabel ?? 'Período de datas'}
                disabled={disabled}
                onClick={toggleOpen}
            >
                <span className="ui-date-picker__label">{label}</span>
                <MaterialIcon name="date_range" variant="app" opticalSize={18} className="ui-date-picker__icon" />
            </button>
            {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
        </div>
    );
}