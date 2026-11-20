import { parseDayKey, startOfDayInLifeOS } from './calendar-format.js';

export function parseHopInstant(raw) {
    if (!raw?.trim()) return null;
    const s = String(raw).trim();
    if (s.includes('T')) {
        const d = new Date(s.length === 16 ? `${s}:00` : s);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return parseDayKey(s);
}

export function countryStayWindow(arrive, leave) {
    if (!arrive) return { days: 0, hours: 0, isLayoverOnly: true };
    if (!leave) return { days: 1, hours: 24, isLayoverOnly: true };

    const hours = Math.max(0, (leave.getTime() - arrive.getTime()) / 3600000);
    const arriveDay = startOfDayInLifeOS(arrive);
    const leaveDay = startOfDayInLifeOS(leave);
    const dayGap = Math.round((leaveDay.getTime() - arriveDay.getTime()) / 86400000);

    if (dayGap <= 0 || hours <= 18) {
        return { days: 1, hours: Math.max(hours, 1), isLayoverOnly: true };
    }
    if (dayGap === 1 && hours <= 40) {
        return { days: 1, hours, isLayoverOnly: true };
    }
    return { days: Math.max(1, dayGap), hours, isLayoverOnly: false };
}