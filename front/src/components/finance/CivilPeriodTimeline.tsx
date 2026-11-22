import {
    isAllYearsPeriod,
    isCivilYearPeriod,
    MONTH_NAMES,
    monthIndexFromPeriod,
    periodFromMonthIndex
} from '../../lib/period';

type Props = {
    period: string;
    year: number;
    onPeriodChange: (period: string) => void;
    onYearChange: (year: number) => void;
    className?: string;
    ariaLabel?: string;
    /** Entradas/Saídas — clique no ano aplica filtro do ano civil. */
    onYearScopeSelect?: () => void;
    /** Cofrinhos — visão sem recorte de ano. */
    onAllYearsSelect?: () => void;
    /** Ano fixo — oculta ‹ › (legado). */
    lockCivilYear?: number;
};

const ACCENT_RE = /\bcivil-period-timeline--([a-z0-9-]+)\b/;

function resolveTimelineClasses(className: string) {
    const m = className.match(ACCENT_RE);
    const accent = m ? m[1] : 'dashboard';
    const rest = className.replace(ACCENT_RE, '').replace(/\s+/g, ' ').trim();
    return {
        classes: ['civil-period-timeline', `civil-period-timeline--${accent}`, rest].filter(Boolean).join(' ')
    };
}

export function CivilPeriodTimeline({
    period,
    year,
    onPeriodChange,
    onYearChange,
    className = '',
    ariaLabel = 'Mês do painel',
    onYearScopeSelect,
    onAllYearsSelect,
    lockCivilYear
}: Props) {
    const activeMonth = monthIndexFromPeriod(period);
    const yearScopeActive = isCivilYearPeriod(period);
    const allYearsActive = isAllYearsPeriod(period);
    const displayYear = lockCivilYear ?? year;
    const yearLocked = lockCivilYear != null;
    const { classes } = resolveTimelineClasses(className);

    return (
        <div
            className={classes}
            data-civil-period-timeline
            role="tablist"
            aria-label={ariaLabel}
        >
            <div
                className={`civil-period-timeline__year-stepper${yearScopeActive ? ' is-year-scope' : ''}`}
                aria-label="Ano civil"
            >
                {!yearLocked ? (
                    <button
                        type="button"
                        className="civil-period-timeline__year-btn"
                        aria-label="Ano anterior"
                        onClick={() => onYearChange(year - 1)}
                    >
                        ‹
                    </button>
                ) : null}
                {onYearScopeSelect ? (
                    <button
                        type="button"
                        className={`civil-period-timeline__year-value civil-period-timeline__year-value--select${
                            yearScopeActive ? ' is-active' : ''
                        }`}
                        data-civil-period-year-label
                        aria-pressed={yearScopeActive}
                            aria-label={`Filtrar pelo ano ${displayYear}`}
                            onClick={onYearScopeSelect}
                        >
                            {displayYear}
                        </button>
                ) : (
                    <span className="civil-period-timeline__year-value" data-civil-period-year-label>
                        {displayYear}
                    </span>
                )}
                {!yearLocked ? (
                    <button
                        type="button"
                        className="civil-period-timeline__year-btn"
                        aria-label="Próximo ano"
                        onClick={() => onYearChange(year + 1)}
                    >
                        ›
                    </button>
                ) : null}
            </div>
            {onAllYearsSelect ? (
                <button
                    type="button"
                    className={`civil-period-timeline__scope-btn${allYearsActive ? ' is-active' : ''}`}
                    aria-pressed={allYearsActive}
                    aria-label="Filtrar todos os anos"
                    onClick={onAllYearsSelect}
                >
                    Todos os anos
                </button>
            ) : null}
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