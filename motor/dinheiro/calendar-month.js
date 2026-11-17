export function isProjectionMonth(mo, ref = new Date()) {
    const y = mo.start.getFullYear();
    const m = mo.start.getMonth();
    const ry = ref.getFullYear();
    const rm = ref.getMonth();
    return y > ry || (y === ry && m > rm);
}

export function enumerateCalendarMonths(startDate, endDate) {
    const months = [];
    let y = startDate.getFullYear();
    let m = startDate.getMonth();
    const endY = endDate.getFullYear();
    const endM = endDate.getMonth();
    while (y < endY || (y === endY && m <= endM)) {
        const start = new Date(y, m, 1);
        const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
        const label = start.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        months.push({
            label: label.charAt(0).toUpperCase() + label.slice(1),
            start,
            end
        });
        m++;
        if (m > 11) {
            m = 0;
            y++;
        }
    }
    return months;
}