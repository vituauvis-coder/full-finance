import {
    civilPeriodTimelineToolbarClasses,
    civilPeriodToolbarAriaLabel,
    type CivilPeriodToolbarAccent
} from '../../lib/civilPeriodToolbar';
import './civil-period-toolbar.css';
import { CivilPeriodTimeline } from './CivilPeriodTimeline';

export type CivilPeriodToolbarProps = {
    period: string;
    year: number;
    onPeriodChange: (period: string) => void;
    onYearChange: (year: number) => void;
    accent: CivilPeriodToolbarAccent;
    ariaLabel?: string;
    /** Entradas e saídas — mesma envoltória que o layout de movimentações. */
    inMovementsToolbar?: boolean;
};

export function CivilPeriodToolbar({
    period,
    year,
    onPeriodChange,
    onYearChange,
    accent,
    ariaLabel,
    inMovementsToolbar = false
}: CivilPeriodToolbarProps) {
    const timeline = (
        <CivilPeriodTimeline
            period={period}
            year={year}
            onPeriodChange={onPeriodChange}
            onYearChange={onYearChange}
            className={civilPeriodTimelineToolbarClasses(accent)}
            ariaLabel={civilPeriodToolbarAriaLabel(accent, ariaLabel)}
        />
    );

    if (!inMovementsToolbar) return timeline;

    return <div className="movements-toolbar">{timeline}</div>;
}