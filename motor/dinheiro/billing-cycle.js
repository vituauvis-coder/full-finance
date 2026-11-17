export function getBillingCycle(card) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const closingDay = card.closingDay ?? card.closeDay;
    const dueDayNum = card.dueDate ?? card.dueDay;
    let start;
    let end;
    let due;

    if (!closingDay || !dueDayNum) {
        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0);
        return { start: startOfMonth, end: endOfMonth, due: endOfMonth };
    }

    if (today.getDate() > closingDay) {
        start = new Date(year, month, closingDay + 1);
        end = new Date(year, month + 1, closingDay);
        due = new Date(year, month + 1, dueDayNum);
    } else {
        start = new Date(year, month - 1, closingDay + 1);
        end = new Date(year, month, closingDay);
        due = new Date(year, month, dueDayNum);
    }
    return { start, end, due };
}