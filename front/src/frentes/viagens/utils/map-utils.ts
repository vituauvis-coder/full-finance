import type { MapVisit } from '../types';

function roundedPoint(lat: number, lng: number) {
    return { lat: Math.round(lat * 10000), lng: Math.round(lng * 10000) };
}

/** Espelha shared/trips/trips-engine displayCoordinate para o mapa web. */
export function displayCoordinate(visit: MapVisit, allVisits: MapVisit[]) {
    const key = roundedPoint(visit.destination.latitude, visit.destination.longitude);
    const same = allVisits.filter((v) => {
        const k = roundedPoint(v.destination.latitude, v.destination.longitude);
        return k.lat === key.lat && k.lng === key.lng;
    });
    const index = same.findIndex((v) => v.id === visit.id);
    return {
        lat: visit.destination.latitude,
        lng: visit.destination.longitude + 0.04 * index
    };
}

export function visitsBounds(visits: MapVisit[]): [[number, number], [number, number]] | null {
    if (!visits.length) return null;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const v of visits) {
        const c = displayCoordinate(v, visits);
        minLat = Math.min(minLat, c.lat);
        maxLat = Math.max(maxLat, c.lat);
        minLng = Math.min(minLng, c.lng);
        maxLng = Math.max(maxLng, c.lng);
    }
    const pad = 8;
    return [
        [minLng - pad, minLat - pad],
        [maxLng + pad, maxLat + pad]
    ];
}

export function pinClassForStatus(status: string) {
    if (status === 'em_curso') return 'viagens-pin--em_curso';
    if (status === 'realizada') return 'viagens-pin--realizada';
    return 'viagens-pin--planejada';
}

export function formatBRL(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}