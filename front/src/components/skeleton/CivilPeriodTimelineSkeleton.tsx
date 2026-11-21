import { defaultCivilYear, defaultPeriod, MONTH_NAMES, monthIndexFromPeriod } from '../../lib/period';

type Props = {
    /** Entradas/saídas — timeline dentro de `movements-toolbar`. */
    inToolbar?: boolean;
    /** Modificador de acento (`civil-period-timeline--*`). */
    accentClass?: string;
};

/** Paridade de DOM com `CivilPeriodTimeline`; tons neutros no CSS. */
export function CivilPeriodTimelineSkeleton({
    inToolbar = false,
    accentClass = 'civil-period-timeline--dashboard'
}: Props) {
    const activeMonth = monthIndexFromPeriod(defaultPeriod());
    const year = defaultCivilYear();

    const timeline = (
        <div
            className={['civil-period-timeline', 'skeleton-timeline', accentClass].filter(Boolean).join(' ')}
            data-civil-period-timeline
            aria-hidden="true"
        >
            <div className="civil-period-timeline__year-stepper" aria-label="Ano civil">
                <button type="button" className="civil-period-timeline__year-btn" tabIndex={-1} disabled>
                    ‹
                </button>
                <span className="civil-period-timeline__year-value" data-civil-period-year-label>
                    {year}
                </span>
                <button type="button" className="civil-period-timeline__year-btn" tabIndex={-1} disabled>
                    ›
                </button>
            </div>
            <div className="civil-period-timeline__chips" data-civil-period-chips>
                {MONTH_NAMES.map((name, index) => (
                    <button
                        key={name}
                        type="button"
                        className={`civil-period-timeline__month-btn${index === activeMonth ? ' is-active' : ''}`}
                        tabIndex={-1}
                        disabled
                    >
                        {name}
                    </button>
                ))}
            </div>
        </div>
    );

    if (!inToolbar) return timeline;

    return <div className="movements-toolbar">{timeline}</div>;
}