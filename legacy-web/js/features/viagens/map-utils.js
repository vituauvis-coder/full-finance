export function displayCoordinate(visit, allVisits) {
    const rounded = (lat, lng) => ({
        lat: Math.round(lat * 10000),
        lng: Math.round(lng * 10000)
    });
    const key = rounded(visit.destination.latitude, visit.destination.longitude);
    const same = allVisits.filter((v) => {
        const k = rounded(v.destination.latitude, v.destination.longitude);
        return k.lat === key.lat && k.lng === key.lng;
    });
    const index = same.findIndex((v) => v.id === visit.id);
    return {
        lat: visit.destination.latitude,
        lng: visit.destination.longitude + 0.04 * index
    };
}

export function formatBRL(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);
}

export function pinClassForStatus(status) {
    if (status === 'em_curso') return 'viagens-pin--em_curso';
    if (status === 'realizada') return 'viagens-pin--realizada';
    return 'viagens-pin--planejada';
}