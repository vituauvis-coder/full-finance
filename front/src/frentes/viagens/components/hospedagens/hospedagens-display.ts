import { haversineKm } from '@motor/viagens/geo-distance.js';
import type { TripDestination, TripStay } from '../../types';
import { pickPlaceDisplayName } from '../../utils/place-display';

export const HOSP_PIN_TINTS = ['turquesa', 'oceano', 'coral', 'ouro', 'turquesa'] as const;

export function stayCheckIn(stay: TripStay): string {
    return stay.checkInOn ?? stay.check_in_on ?? '';
}

export function stayCheckOut(stay: TripStay): string {
    return stay.checkOutOn ?? stay.check_out_on ?? '';
}

export function stayNights(stay: TripStay): number | null {
    const a = stayCheckIn(stay);
    const b = stayCheckOut(stay);
    if (!a || !b) return null;
    const nights = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
    return nights > 0 ? nights : null;
}

export function stayPeriodPinLabel(stay: TripStay): string {
    const nights = stayNights(stay);
    if (nights != null) return `${nights} d`;
    const ci = stayCheckIn(stay);
    const co = stayCheckOut(stay);
    if (ci && co) return '—';
    if (ci) return 'Check-in';
    if (co) return 'Check-out';
    return '—';
}

export function stayDisplayTitle(stay: TripStay): string {
    const raw = (stay.name ?? '').trim();
    if (raw) {
        return pickPlaceDisplayName({ name: stay.name, countryName: stay.country ?? stay.city }) || raw;
    }
    return pickPlaceDisplayName({ name: stay.name, countryName: stay.country ?? stay.city }) || '';
}

export function stayHasDisplayTitle(stay: TripStay): boolean {
    return Boolean(stayDisplayTitle(stay).trim());
}

export function stayAirportHintForCard(hint: string | null | undefined): string | null {
    if (!hint?.trim()) return null;
    const noise = /sem coordenadas|busque o endereço|nenhum voo escolhido|no mapa/i;
    return noise.test(hint) ? null : hint.trim();
}

export function stayDisplayCity(stay: TripStay, destById: Map<string, TripDestination>): string {
    const fromStay = stay.city?.trim();
    if (fromStay) return fromStay;
    const destId = stay.destinationId ?? '';
    const dest = destById.get(destId);
    return dest?.name?.trim() ?? '';
}

export function lodgeDateParts(iso: string): { day: string; month: string; week: string } | null {
    if (!iso) return null;
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return {
        day: String(d.getDate()),
        month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        week: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
    };
}

export function lodgeDateShort(iso: string): string {
    if (!iso) return '—';
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
}

export function lodgeKindLabel(stay: TripStay): string {
    const k = (stay.kind ?? '').toLowerCase();
    if (k.includes('hostel') || k.includes('albergue')) return 'Hostel';
    if (k.includes('apartment') || k.includes('airbnb')) return 'Acomodação';
    if (k.includes('motel')) return 'Motel';
    if (k.includes('guest')) return 'Pousada';
    if (k.includes('hotel') || stay.source === 'search') return 'Hotel';
    return 'Hospedagem';
}

export function sortStaysChronologically(stays: TripStay[]): TripStay[] {
    return [...stays].sort((a, b) => {
        const da = stayCheckIn(a);
        const db = stayCheckIn(b);
        if (da && db) return da.localeCompare(db);
        if (da) return -1;
        if (db) return 1;
        return stayDisplayTitle(a).localeCompare(stayDisplayTitle(b), 'pt-BR');
    });
}

export function stayLatLng(stay: TripStay | null | undefined): { lat: number; lng: number } | null {
    if (!stay) return null;
    const lat = Number(stay.latitude ?? stay.lat);
    const lng = Number(stay.longitude ?? stay.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

/** Noite coberta: check-in ≤ dia < check-out. */
export function stayCoversDayKey(stay: TripStay, dayKey: string): boolean {
    const key = String(dayKey ?? '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    const ci = stayCheckIn(stay).slice(0, 10);
    const co = stayCheckOut(stay).slice(0, 10);
    if (!ci || !co) return false;
    return key >= ci && key < co;
}

export function suggestStayForDayKey(stays: TripStay[], dayKey: string): TripStay | null {
    const list = sortStaysChronologically(stays ?? []);
    return list.find((s) => stayCoversDayKey(s, dayKey)) ?? null;
}

function foldStayPlace(s: string): string {
    return String(s ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .trim();
}

const STAY_CITY_ALIASES: Record<string, string> = {
    shanghai: 'xangai',
    xangai: 'xangai',
    madrid: 'madri',
    madri: 'madri',
    beijing: 'pequim',
    pequim: 'pequim',
    peking: 'pequim',
    bilbao: 'bilbao',
    recife: 'recife'
};

function canonStayCity(raw: string): string {
    const head = foldStayPlace(raw).split(/[,/·(]/)[0]?.trim() ?? '';
    return STAY_CITY_ALIASES[head] ?? head;
}

/**
 * Liga hospedagem ao destino da viagem pela cidade/coords reais.
 * Nunca cai no destino principal/primeiro da lista (evita hotel em Xangai → Madri).
 */
export function matchDestinationIdForStay(
    stay: {
        destinationId?: string | null;
        city?: string | null;
        country?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        lat?: number | null;
        lng?: number | null;
        name?: string | null;
    },
    destinations: TripDestination[]
): string | null {
    const catalog = (destinations ?? []).filter(
        (d) =>
            d.kind !== 'country' &&
            d.kind !== 'continent' &&
            Number.isFinite(d.latitude) &&
            Number.isFinite(d.longitude)
    );
    if (!catalog.length) return null;

    const stayCity = canonStayCity(String(stay.city ?? ''));
    const stayCountry = foldStayPlace(String(stay.country ?? ''));
    const lat = Number(stay.latitude ?? stay.lat);
    const lng = Number(stay.longitude ?? stay.lng);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    const cityCompatible = (d: TripDestination): boolean => {
        if (!stayCity) return false;
        const dCity = canonStayCity(
            String(d.city ?? '').trim() || (String(d.name ?? '').split(/[,/·(]/)[0] ?? '')
        );
        if (!dCity) return false;
        if (dCity === stayCity) return true;
        if (stayCity.length >= 3 && dCity.length >= 3) {
            return dCity.includes(stayCity) || stayCity.includes(dCity);
        }
        return false;
    };

    const linkedId = String(stay.destinationId ?? '').trim();
    if (linkedId) {
        const linked = catalog.find((d) => d.id === linkedId) ?? null;
        if (linked) {
            if (cityCompatible(linked)) return linked.id;
            if (hasCoords) {
                const km = haversineKm(lat, lng, linked.latitude, linked.longitude);
                if (km != null && km < 80) return linked.id;
            }
            // destinationId antigo errado (ex. principal Madri) — ignora
        }
    }

    if (hasCoords) {
        let best: { id: string; km: number } | null = null;
        for (const d of catalog) {
            const km = haversineKm(lat, lng, d.latitude, d.longitude);
            if (km == null || !Number.isFinite(km) || km > 120) continue;
            if (!best || km < best.km) best = { id: d.id, km };
        }
        if (best) return best.id;
    }

    if (stayCity) {
        const byCity = catalog.find((d) => cityCompatible(d));
        if (byCity) return byCity.id;
    }

    if (stayCountry) {
        const inCountry = catalog.filter((d) => foldStayPlace(String(d.country ?? '')) === stayCountry);
        if (inCountry.length === 1) return inCountry[0]!.id;
    }

    return null;
}

/** Regrava destinationId quando o vínculo antigo não bate com cidade/coords (ex. hotel Xangai → Madri). */
export function healStayDestinationIds(
    stays: TripStay[],
    destinations: TripDestination[]
): TripStay[] | null {
    let changed = false;
    const next = (stays ?? []).map((s) => {
        const hasPlace = Boolean(String(s.city ?? '').trim() || stayLatLng(s));
        if (!hasPlace) return s;
        const matched = matchDestinationIdForStay(s, destinations);
        if ((s.destinationId ?? null) === matched) return s;
        changed = true;
        return { ...s, destinationId: matched };
    });
    return changed ? next : null;
}