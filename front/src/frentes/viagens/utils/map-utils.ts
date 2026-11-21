import { resolveFlightPlace } from '@motor/viagens/flight-route-geo.js';
import type { MapVisit } from '../types';

/** Nomes conhecidos em português (pins quando o tile ainda traz hanzi). */
const ROTEIRO_LABEL_PT: Record<string, string> = {
    北京市: 'Pequim',
    Beijing: 'Pequim',
    上海市: 'Xangai',
    Shanghai: 'Xangai',
    广州市: 'Cantão',
    Guangzhou: 'Cantão',
    深圳市: 'Shenzhen',
    香港: 'Hong Kong',
    'Hong Kong': 'Hong Kong',
    东京: 'Tóquio',
    Tokyo: 'Tóquio',
    東京都: 'Tóquio',
    大阪市: 'Osaka',
    Osaka: 'Osaka',
    首尔: 'Seul',
    Seoul: 'Seul',
    台北: 'Taipei',
    Taipei: 'Taipei',
    曼谷: 'Bangkok',
    Bangkok: 'Bangkok'
};

function roteiroMapPinLabelLocal(place: string, fallback: string) {
    const raw = place.trim();
    if (!raw) return fallback;
    if (ROTEIRO_LABEL_PT[raw]) return ROTEIRO_LABEL_PT[raw];
    if (/[\u3040-\u9fff\uac00-\ud7af]/.test(raw)) {
        for (const [key, label] of Object.entries(ROTEIRO_LABEL_PT)) {
            if (key.length > 1 && raw.includes(key)) return label;
        }
    }
    return raw;
}

export function roteiroMapPinLabel(place: string | null | undefined, fallback = '—') {
    const raw = place?.trim() ?? '';
    if (!raw) return fallback;
    const local = roteiroMapPinLabelLocal(raw, fallback);
    if (local !== raw) return local;
    if (/^china$/i.test(raw) || /^brasil$/i.test(raw)) return fallback;
    return mapAirportBadgeLabel(raw, fallback);
}

/** Família visual do pin no mapa do roteiro (ícone + tom). */
export type MapPinVisualKind = 'base' | 'lodging' | 'attraction' | 'food' | 'shop' | 'airport' | 'poi';

/** Ícone Material do pin — hotel ≠ base (cidade) ≠ atração (ex. Muralha). */
export function mapPinVisualKind(dest: {
    id?: string;
    kind?: string | null;
    name?: string | null;
}): MapPinVisualKind {
    const id = String(dest.id ?? '');
    const kind = String(dest.kind ?? '').trim().toLowerCase();
    const name = String(dest.name ?? '').toLowerCase();

    if (id.startsWith('rote-stay-') || kind === 'lodging' || kind === 'hotel') return 'lodging';
    if (kind === 'attraction' || /muralha|great wall|wall of china|templo|tower|castelo|palace|palacio/.test(name)) {
        return 'attraction';
    }
    if (kind === 'restaurant' || kind === 'food' || kind === 'cafe') return 'food';
    if (kind === 'shopping' || kind === 'shop' || kind === 'mall') return 'shop';
    if (kind === 'airport') return 'airport';
    if (kind === 'city' || kind === 'neighborhood' || kind === 'region' || kind === 'country') return 'base';
    if (kind === 'poi') return 'poi';
    return 'base';
}

export function mapPinIconForDestination(dest: {
    id?: string;
    kind?: string | null;
    name?: string | null;
}): string {
    switch (mapPinVisualKind(dest)) {
        case 'lodging':
            return 'hotel';
        case 'attraction':
            return 'attractions';
        case 'food':
            return 'restaurant';
        case 'shop':
            return 'local_mall';
        case 'airport':
            return 'flight';
        case 'poi':
            return 'place';
        case 'base':
        default:
            return 'location_city';
    }
}

/** Rótulo do pin no mapa — nunca troca cidade por código IATA (ex. China → PEK). */
export function mapPinLabelForDestination(dest: {
    name?: string;
    country?: string;
    city?: string | null;
    kind?: string | null;
}): string {
    const kind = String(dest.kind ?? '').trim();
    const raw = String(dest.name ?? '').trim();
    if (!raw) return '—';
    if (kind === 'airport') return mapAirportBadgeLabel(raw);
    if (kind === 'country') return roteiroMapPinLabelLocal(String(dest.country ?? raw), '—');
    const city = String(dest.city ?? '').trim();
    if (city && !/^china$/i.test(city)) {
        const shortCity = city.split('/')[0]?.trim() ?? city;
        const local = roteiroMapPinLabelLocal(raw, '');
        if (local) return `${local} · ${shortCity}`;
    }
    const local = roteiroMapPinLabelLocal(raw, '');
    if (local) return local;
    if (/^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase();
    return raw;
}

/** Nome curto no mapa: preferência pela sigla IATA quando existir no catálogo. */
export function mapAirportBadgeLabel(place: string | null | undefined, fallback = '—') {
    const raw = place?.trim() ?? '';
    if (!raw) return fallback;
    const resolved = resolveFlightPlace(raw);
    return resolved?.label ?? raw;
}

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