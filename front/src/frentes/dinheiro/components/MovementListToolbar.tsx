import { CivilPeriodTimeline } from '../../../components/finance/CivilPeriodTimeline';

type Props = {
    period: string;
    year: number;
    onPeriodChange: (p: string) => void;
    onYearChange: (y: number) => void;
    timelineClass: string;
};

export function MovementListToolbar({ period, year, onPeriodChange, onYearChange, timelineClass }: Props) {
    return (
        <div className="movements-toolbar">
            <CivilPeriodTimeline
                period={period}
                year={year}
                onPeriodChange={onPeriodChange}
                onYearChange={onYearChange}
                className={timelineClass}
            />
        </div>
    );
}