function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function nights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    const a = new Date(`${checkIn}T12:00:00`);
    const b = new Date(`${checkOut}T12:00:00`);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return 0;
    return Math.round((b - a) / 86400000);
}

export function staysSummary(stays = []) {
    let total = 0;
    let paid = 0;
    let unpaid = 0;
    let nightCount = 0;
    let withCoords = 0;
    for (const stay of stays) {
        const amount = Math.max(0, num(stay.amount));
        total += amount;
        const isPaid = Boolean(stay.paid);
        if (isPaid) paid += amount;
        else unpaid += amount;
        nightCount += nights(stay.checkInOn ?? stay.check_in_on, stay.checkOutOn ?? stay.check_out_on);
        const lat = stay.latitude ?? stay.lat;
        const lng = stay.longitude ?? stay.lng;
        if (Number.isFinite(lat) && Number.isFinite(lng)) withCoords += 1;
    }
    return {
        count: stays.length,
        total,
        paid,
        unpaid,
        nights: nightCount,
        withCoords
    };
}