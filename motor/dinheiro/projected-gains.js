import { movementDateToJsDate } from './movement-date.js';

export function sumProjectedGainsForCalendarMonth(mo, userGains) {
    let sum = 0;
    for (const t of userGains || []) {
        if (t.referenceOnly) continue;
        const d = movementDateToJsDate(t.date);
        if (d >= mo.start && d <= mo.end) sum += Number(t.amount) || 0;
    }
    return sum;
}