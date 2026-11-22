import { MONTH_SHORT_PT, yearOptionsForPicker } from '../../../lib/calendarUi';
import { MaterialIcon } from '../../icons/MaterialIcon';

type Props = {
    year: number;
    selectedMonth: number;
    onYearChange: (year: number) => void;
    onMonthPick: (monthIndex: number) => void;
    onBackToDays: () => void;
    min?: string;
    max?: string;
};

function monthAllowed(year: number, monthIndex: number, min?: string, max?: string): boolean {
    const start = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const endDay = new Date(year, monthIndex + 1, 0).getDate();
    const end = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    if (min && end < min.slice(0, 10)) return false;
    if (max && start > max.slice(0, 10)) return false;
    return true;
}

export function DatePickerMonthGrid({
    year,
    selectedMonth,
    onYearChange,
    onMonthPick,
    onBackToDays,
    min,
    max
}: Props) {
    const years = yearOptionsForPicker(min, max);

    return (
        <>
            <header className="ui-date-picker__nav ui-date-picker__nav--months">
                <button
                    type="button"
                    className="ui-date-picker__nav-btn"
                    aria-label="Ano anterior"
                    onClick={() => onYearChange(year - 1)}
                >
                    <MaterialIcon name="chevron_left" variant="app" opticalSize={18} />
                </button>
                <select
                    className="ui-date-picker__period-select ui-date-picker__period-select--year"
                    value={year}
                    aria-label="Ano"
                    onChange={(e) => onYearChange(Number(e.target.value))}
                >
                    {years.map((y) => (
                        <option key={y} value={y}>
                            {y}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    className="ui-date-picker__nav-btn"
                    aria-label="Próximo ano"
                    onClick={() => onYearChange(year + 1)}
                >
                    <MaterialIcon name="chevron_right" variant="app" opticalSize={18} />
                </button>
            </header>
            <div className="ui-month-picker__grid" role="grid" aria-label={`Meses de ${year}`}>
                {MONTH_SHORT_PT.map((short, monthIndex) => {
                    const allowed = monthAllowed(year, monthIndex, min, max);
                    const isSel = selectedMonth === monthIndex;
                    return (
                        <button
                            key={short}
                            type="button"
                            role="gridcell"
                            disabled={!allowed}
                            className={[
                                'ui-month-picker__month',
                                isSel ? 'is-on' : '',
                                !allowed ? 'is-disabled' : ''
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            onClick={() => onMonthPick(monthIndex)}
                        >
                            {short}
                        </button>
                    );
                })}
            </div>
            <footer className="ui-date-picker__footer ui-date-picker__footer--compact">
                <button type="button" className="ui-date-picker__today" onClick={onBackToDays}>
                    Escolher dia
                </button>
            </footer>
        </>
    );
}