export function getPeriodDateBounds(period, now = new Date(), options = {}) {
    const civilYearOpt = options.civilYear;
    const civilYear =
        civilYearOpt != null && Number.isFinite(Number(civilYearOpt)) ? Number(civilYearOpt) : now.getFullYear();

    let startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    let endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthMatch = /^month-(\d+)$/.exec(period || '');
    if (monthMatch) {
        const mi = Math.min(11, Math.max(0, parseInt(monthMatch[1], 10)));
        startDate = new Date(civilYear, mi, 1);
        endDate = new Date(civilYear, mi + 1, 0, 23, 59, 59, 999);
        return { startDate, endDate };
    }

    switch (period) {
        case 'last-3-months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'last-6-months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'last-12-months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'current-year':
            startDate = new Date(civilYear, 0, 1);
            endDate = new Date(civilYear, 11, 31, 23, 59, 59, 999);
            break;
        case 'last-year':
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
            break;
        default:
            break;
    }

    return { startDate, endDate };
}

export function getMonthKeysInPeriod(period, now = new Date(), options = {}) {
    const { startDate, endDate } = getPeriodDateBounds(period, now, options);
    const keys = [];
    let y = startDate.getFullYear();
    let m = startDate.getMonth();
    const endY = endDate.getFullYear();
    const endM = endDate.getMonth();
    while (y < endY || (y === endY && m <= endM)) {
        keys.push(`${y}-${String(m + 1).padStart(2, '0')}`);
        m++;
        if (m > 11) {
            m = 0;
            y++;
        }
    }
    return keys;
}