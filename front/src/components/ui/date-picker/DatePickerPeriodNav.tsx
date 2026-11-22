import { MaterialIcon } from '../../icons/MaterialIcon';
import { MONTH_NAMES_PT, monthTitlePt, shiftMonth, yearOptionsForPicker } from '../../../lib/calendarUi';

type Cursor = { year: number; month: number };

type Props = {
    cursor: Cursor;
    onCursorChange: (next: Cursor) => void;
    min?: string;
    max?: string;
    /** Grade de meses (atalho para trocar mês/ano antes de escolher o dia). */
    onOpenMonthGrid?: () => void;
};

export function DatePickerPeriodNav({ cursor, onCursorChange, min, max, onOpenMonthGrid }: Props) {
    const years = yearOptionsForPicker(min, max);

    return (
        <header className="ui-date-picker__nav ui-date-picker__nav--period">
            <button
                type="button"
                className="ui-date-picker__nav-btn"
                aria-label="Mês anterior"
                onClick={() => onCursorChange(shiftMonth(cursor.year, cursor.month, -1))}
            >
                <MaterialIcon name="chevron_left" variant="app" opticalSize={18} />
            </button>
            <div className="ui-date-picker__period-picks">
                <select
                    className="ui-date-picker__period-select"
                    value={cursor.month}
                    aria-label="Mês"
                    onChange={(e) =>
                        onCursorChange({ year: cursor.year, month: Number(e.target.value) })
                    }
                >
                    {MONTH_NAMES_PT.map((name, monthIndex) => (
                        <option key={name} value={monthIndex}>
                            {name}
                        </option>
                    ))}
                </select>
                <select
                    className="ui-date-picker__period-select ui-date-picker__period-select--year"
                    value={cursor.year}
                    aria-label="Ano"
                    onChange={(e) =>
                        onCursorChange({ year: Number(e.target.value), month: cursor.month })
                    }
                >
                    {years.map((year) => (
                        <option key={year} value={year}>
                            {year}
                        </option>
                    ))}
                </select>
            </div>
            <button
                type="button"
                className="ui-date-picker__nav-btn"
                aria-label="Próximo mês"
                onClick={() => onCursorChange(shiftMonth(cursor.year, cursor.month, 1))}
            >
                <MaterialIcon name="chevron_right" variant="app" opticalSize={18} />
            </button>
            {onOpenMonthGrid ? (
                <button
                    type="button"
                    className="ui-date-picker__month-grid-btn"
                    title={`Ver meses de ${cursor.year}`}
                    aria-label={`Abrir grade de meses de ${monthTitlePt(cursor.year, cursor.month)}`}
                    onClick={onOpenMonthGrid}
                >
                    <MaterialIcon name="grid_view" variant="app" opticalSize={18} />
                </button>
            ) : null}
        </header>
    );
}