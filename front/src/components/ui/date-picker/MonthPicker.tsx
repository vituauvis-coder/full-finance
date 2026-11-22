import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties
} from 'react';
import { createPortal } from 'react-dom';
import { MaterialIcon } from '../../icons/MaterialIcon';
import { MONTH_SHORT_PT, monthTitlePt } from '../../../lib/calendarUi';

const POP_WIDTH_PX = 288;
const POP_ESTIMATE_PX = 280;

type PopCoords = { top: number; left: number; width: number };

function popCoordsFromTrigger(trigger: HTMLElement, popHeight = POP_ESTIMATE_PX): PopCoords {
    const width = Math.min(POP_WIDTH_PX, window.innerWidth - 16);
    const r = trigger.getBoundingClientRect();
    let left = r.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - width);
    if (left < 8) left = 8;

    let top = r.bottom + 8;
    if (top + popHeight > window.innerHeight - 8) {
        const above = r.top - 8 - popHeight;
        if (above >= 8) top = above;
    }

    return { top, left, width };
}

function coerceYearMonth(raw: string): string | null {
    const m = String(raw ?? '').trim().match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    const month = parseInt(m[2], 10);
    if (month < 1 || month > 12) return null;
    return `${m[1]}-${m[2]}`;
}

function formatYearMonthLabel(ym: string): string {
    const m = ym.match(/^(\d{4})-(\d{2})$/);
    if (!m) return '—';
    const year = parseInt(m[1], 10);
    const monthIndex = parseInt(m[2], 10) - 1;
    return monthTitlePt(year, monthIndex);
}

function currentYearMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function isYearMonthInRange(ym: string, min?: string, max?: string): boolean {
    if (min && ym < min.slice(0, 7)) return false;
    if (max && ym > max.slice(0, 7)) return false;
    return true;
}

export type MonthPickerProps = {
    id?: string;
    value: string;
    onChange: (yearMonth: string) => void;
    disabled?: boolean;
    required?: boolean;
    min?: string;
    max?: string;
    placeholder?: string;
    className?: string;
    'aria-label'?: string;
};

export function MonthPicker({
    id,
    value,
    onChange,
    disabled = false,
    required = false,
    min,
    max,
    placeholder = 'Selecionar mês',
    className = '',
    'aria-label': ariaLabel
}: MonthPickerProps) {
    const fallbackId = useId();
    const fieldId = id ?? fallbackId;
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<PopCoords | null>(null);

    const yearMonth = coerceYearMonth(value) ?? '';
    const parsedYear = yearMonth ? parseInt(yearMonth.slice(0, 4), 10) : new Date().getFullYear();
    const [cursorYear, setCursorYear] = useState(parsedYear);

    const updateCoords = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const popHeight = popRef.current?.offsetHeight ?? POP_ESTIMATE_PX;
        setCoords(popCoordsFromTrigger(trigger, popHeight));
    }, []);

    useEffect(() => {
        if (yearMonth) setCursorYear(parsedYear);
    }, [parsedYear, yearMonth]);

    useEffect(() => {
        if (!open) return;
        setCursorYear(yearMonth ? parsedYear : new Date().getFullYear());
    }, [open, parsedYear, yearMonth]);

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
    }, [open, updateCoords, cursorYear]);

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

    const label = yearMonth ? formatYearMonthLabel(yearMonth) : placeholder;
    const currentYm = currentYearMonth();

    function selectMonth(monthIndex: number) {
        const ym = `${cursorYear}-${String(monthIndex + 1).padStart(2, '0')}`;
        if (!isYearMonthInRange(ym, min, max)) return;
        onChange(ym);
        setOpen(false);
    }

    function toggleOpen() {
        if (disabled) return;
        if (open) setOpen(false);
        else {
            if (triggerRef.current) setCoords(popCoordsFromTrigger(triggerRef.current));
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
                className="ui-date-picker__pop ui-month-picker__pop"
                role="dialog"
                aria-label="Mês de referência"
                style={popStyle}
            >
                <header className="ui-date-picker__nav">
                    <button
                        type="button"
                        className="ui-date-picker__nav-btn"
                        aria-label="Ano anterior"
                        onClick={() => setCursorYear((y) => y - 1)}
                    >
                        <MaterialIcon name="chevron_left" variant="app" opticalSize={18} />
                    </button>
                    <p className="ui-date-picker__month">{cursorYear}</p>
                    <button
                        type="button"
                        className="ui-date-picker__nav-btn"
                        aria-label="Próximo ano"
                        onClick={() => setCursorYear((y) => y + 1)}
                    >
                        <MaterialIcon name="chevron_right" variant="app" opticalSize={18} />
                    </button>
                </header>
                <div className="ui-month-picker__grid" role="grid" aria-label={`Meses de ${cursorYear}`}>
                    {MONTH_SHORT_PT.map((short, monthIndex) => {
                        const ym = `${cursorYear}-${String(monthIndex + 1).padStart(2, '0')}`;
                        const isSel = yearMonth === ym;
                        const isNow = currentYm === ym;
                        const outOfRange = !isYearMonthInRange(ym, min, max);
                        return (
                            <button
                                key={ym}
                                type="button"
                                role="gridcell"
                                disabled={outOfRange}
                                className={[
                                    'ui-month-picker__month',
                                    isSel ? 'is-on' : '',
                                    isNow ? 'is-today' : '',
                                    outOfRange ? 'is-disabled' : ''
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                                onClick={() => selectMonth(monthIndex)}
                            >
                                {short}
                            </button>
                        );
                    })}
                </div>
                <footer className="ui-date-picker__footer">
                    <button
                        type="button"
                        className="ui-date-picker__today"
                        onClick={() => {
                            if (isYearMonthInRange(currentYm, min, max)) {
                                onChange(currentYm);
                                setOpen(false);
                            }
                        }}
                    >
                        Este mês
                    </button>
                </footer>
            </div>
        ) : null;

    const rootClass = ['ui-date-picker', 'ui-month-picker', open ? 'is-open' : '', className]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={rootClass}>
            <button
                ref={triggerRef}
                id={fieldId}
                type="button"
                className={`ui-date-picker__trigger ui-control${yearMonth ? '' : ' is-empty'}`}
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