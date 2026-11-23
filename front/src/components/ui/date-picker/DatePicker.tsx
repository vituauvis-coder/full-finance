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

const POP_LAYOUT = { widthPx: 296, anchorHeightPx: 360 };

export type DatePickerProps = {
    id?: string;
    value: string;
    onChange: (isoDate: string) => void;
    disabled?: boolean;
    required?: boolean;
    min?: string;
    max?: string;
    placeholder?: string;
    className?: string;
    'aria-label'?: string;
};

export function DatePicker({
    id,
    value,
    onChange,
    disabled = false,
    required = false,
    min,
    max,
    placeholder = 'Selecionar data',
    className = '',
    'aria-label': ariaLabel
}: DatePickerProps) {
    const fallbackId = useId();
    const fieldId = id ?? fallbackId;
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const placementRef = useRef<PopoverPlacement | null>(null);
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<PopCoords | null>(null);
    const [panel, setPanel] = useState<'days' | 'months'>('days');

    const dateKey = coerceDayKey(value) ?? '';
    const [cursor, setCursor] = useState(() => cursorFromDayKey(dateKey || todayKey()));

    const updateCoords = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        if (!placementRef.current) {
            placementRef.current = resolvePopoverPlacement(trigger, POP_LAYOUT.anchorHeightPx);
        }
        setCoords(popoverCoordsFromTrigger(trigger, placementRef.current, POP_LAYOUT));
    }, []);

    useEffect(() => {
        if (dateKey) setCursor(cursorFromDayKey(dateKey));
    }, [dateKey]);

    useEffect(() => {
        if (!open) return;
        setPanel('days');
        setCursor(cursorFromDayKey(dateKey || todayKey()));
    }, [open, dateKey]);

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
    const label = dateKey ? formatDateLabelPt(dateKey) : placeholder;

    function selectDay(key: string) {
        if (!isDayKeyInRange(key, min, max)) return;
        onChange(key);
        setOpen(false);
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
                className="ui-date-picker__pop"
                role="dialog"
                aria-label="Calendário"
                style={popStyle}
            >
                {panel === 'months' ? (
                    <DatePickerMonthGrid
                        year={cursor.year}
                        selectedMonth={cursor.month}
                        min={min}
                        max={max}
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
                            min={min}
                            max={max}
                            onCursorChange={setCursor}
                            onOpenMonthGrid={() => setPanel('months')}
                        />
                        <div className="ui-date-picker__week" aria-hidden="true">
                            {WEEK_SHORT_PT.map((d) => (
                                <span key={d}>{d.replace('.', '').slice(0, 3)}</span>
                            ))}
                        </div>
                        <div
                            className="ui-date-picker__grid"
                            role="grid"
                            aria-label={monthTitlePt(cursor.year, cursor.month)}
                        >
                            {cells.map((cell, i) => {
                                if (!cell.key || cell.day == null) {
                                    return <span key={`empty-${i}`} className="ui-date-picker__day is-empty" />;
                                }
                                const isSel = dateKey === cell.key;
                                const isToday = cell.key === today;
                                const outOfRange = !isDayKeyInRange(cell.key, min, max);
                                return (
                                    <button
                                        key={cell.key}
                                        type="button"
                                        role="gridcell"
                                        disabled={outOfRange}
                                        className={[
                                            'ui-date-picker__day',
                                            isSel ? 'is-on' : '',
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
                                    if (isDayKeyInRange(today, min, max)) selectDay(today);
                                }}
                            >
                                Hoje
                            </button>
                            {dateKey && !required ? (
                                <button type="button" className="ui-date-picker__clear" onClick={() => onChange('')}>
                                    Limpar
                                </button>
                            ) : null}
                        </footer>
                    </>
                )}
            </div>
        ) : null;

    const rootClass = ['ui-date-picker', open ? 'is-open' : '', className].filter(Boolean).join(' ');

    return (
        <div className={rootClass}>
            <button
                ref={triggerRef}
                id={fieldId}
                type="button"
                className={`ui-date-picker__trigger ui-control${dateKey ? '' : ' is-empty'}`}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-required={required || undefined}
                aria-label={ariaLabel}
                disabled={disabled}
                onClick={toggleOpen}
            >
                <span className="ui-date-picker__label">{label}</span>
                <MaterialIcon name="calendar_month" variant="app" opticalSize={20} className="ui-date-picker__icon" />
            </button>
            {typeof document !== 'undefined' && portal ? createPortal(portal, document.body) : null}
        </div>
    );
}