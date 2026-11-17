import { MONTH_NAMES, monthIndexFromPeriod, periodFromMonthIndex } from '../../lib/period';

type Props = {
    period: string;
    year: number;
    onPeriodChange: (period: string) => void;
    onYearChange: (year: number) => void;
    className?: string;
};

export function CivilPeriodTimeline({ period, year, onPeriodChange, onYearChange, className = '' }: Props) {
    const activeMonth = monthIndexFromPeriod(period);

    return (
        <div
            className={`civil-period-timeline civil-period-timeline--dashboard ${className}`.trim()}
            data-civil-period-timeline
            role="tablist"
            aria-label="Mês do painel"
        >
            <div className="civil-period-timeline__year-stepper" aria-label="Ano civil">
                <button
                    type="button"
                    className="civil-period-timeline__year-btn"
                    aria-label="Ano anterior"
                    onClick={() => onYearChange(year - 1)}
                >
                    ‹
                </button>
                <span className="civil-period-timeline__year-value" data-civil-period-year-label>
                    {year}
                </span>
                <button
                    type="button"
                    className="civil-period-timeline__year-btn"
                    aria-label="Próximo ano"
                    onClick={() => onYearChange(year + 1)}
                >
                    ›
                </button>
            </div>
            <div className="civil-period-timeline__chips" data-civil-period-chips>
                {MONTH_NAMES.map((name, index) => {
                    const isActive = index === activeMonth;
                    return (
                        <button
                            key={name}
                            type="button"
                            className={`civil-period-timeline__month-btn${isActive ? ' is-active' : ''}`}
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => onPeriodChange(periodFromMonthIndex(index))}
                        >
                            {name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}