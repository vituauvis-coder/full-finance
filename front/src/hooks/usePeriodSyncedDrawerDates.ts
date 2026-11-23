import { useEffect, useRef } from 'react';
import { getPeriodDateBounds, isAllYearsPeriod, toLocalDateInputValue } from '../lib/period';

export function usePeriodSyncedDrawerDates(
    period: string,
    civilYear: number,
    dateFrom: string,
    dateTo: string,
    dateManual: boolean,
    setDateFrom: (v: string) => void,
    setDateTo: (v: string) => void,
    clearManual: () => void
) {
    const prevPeriod = useRef({ period, civilYear });
    const setDateFromRef = useRef(setDateFrom);
    const setDateToRef = useRef(setDateTo);
    const clearManualRef = useRef(clearManual);
    setDateFromRef.current = setDateFrom;
    setDateToRef.current = setDateTo;
    clearManualRef.current = clearManual;

    useEffect(() => {
        const periodChanged = prevPeriod.current.period !== period || prevPeriod.current.civilYear !== civilYear;
        prevPeriod.current = { period, civilYear };
        if (dateManual && !periodChanged) return;
        if (isAllYearsPeriod(period)) {
            setDateFromRef.current('');
            setDateToRef.current('');
            if (periodChanged) clearManualRef.current();
            return;
        }
        const { startDate, endDate } = getPeriodDateBounds(period, civilYear);
        setDateFromRef.current(toLocalDateInputValue(startDate));
        setDateToRef.current(toLocalDateInputValue(endDate));
        if (periodChanged) clearManualRef.current();
    }, [period, civilYear, dateManual]);
}