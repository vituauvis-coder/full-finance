export function parseCashOutConfirmedPeriods(expense) {
    const raw = expense?.cashOutConfirmedPeriods;
    if (raw == null || raw === '') return new Set();
    try {
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(arr)) return new Set();
        return new Set(arr.map((x) => String(x).trim()).filter(Boolean));
    } catch {
        return new Set();
    }
}

export function monthKeyFromDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function calendarDayKeyFromDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isPeriodConfirmedForDebit(confirmedSet, date) {
    if (!confirmedSet?.size) return false;
    if (Number.isNaN(date.getTime())) return false;
    return confirmedSet.has(calendarDayKeyFromDate(date)) || confirmedSet.has(monthKeyFromDate(date));
}