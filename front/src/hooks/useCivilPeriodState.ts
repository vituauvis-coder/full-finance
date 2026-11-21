import { useCallback, useState } from 'react';
import { defaultCivilYear, defaultPeriod, periodFromMonthIndex } from '../lib/period';

export type CivilPeriodToolbarBindings = {
    period: string;
    year: number;
    onPeriodChange: (period: string) => void;
    onYearChange: (year: number) => void;
};

export function useCivilPeriodState(): CivilPeriodToolbarBindings & {
    selectChartMonth: (monthIndex: number, civilYear: number) => void;
} {
    const [period, setPeriod] = useState(defaultPeriod);
    const [year, setYear] = useState(defaultCivilYear);

    const selectChartMonth = useCallback((monthIndex: number, civilYear: number) => {
        setYear(civilYear);
        setPeriod(periodFromMonthIndex(monthIndex));
    }, []);

    return {
        period,
        year,
        onPeriodChange: setPeriod,
        onYearChange: setYear,
        selectChartMonth
    };
}