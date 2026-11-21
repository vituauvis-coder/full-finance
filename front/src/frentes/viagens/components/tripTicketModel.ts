import type { Trip, TripStatus } from '../types';
import { formatTripTicketDay } from '../utils/trip-dates';
import { toApiDayKey } from '@motor/viagens/calendar-format.js';
import { resolveTripCountries } from '@motor/viagens/trip-countries.js';

export function tripTicketStatus(trip: Trip): TripStatus {
    const s = trip.effectiveStatus;
    if (s === 'em_curso' || s === 'realizada' || s === 'planejada') return s;
    return 'planejada';
}

export function tripTicketStatusLabel(status: TripStatus): string {
    if (status === 'em_curso') return 'Em curso';
    if (status === 'realizada') return 'Realizada';
    return 'Planejada';
}

export function tripTicketTitle(trip: Trip): string {
    return trip.title?.trim() || 'Nova viagem';
}

export function tripTicketRoute(trip: Trip): string {
    return (trip.payload?.destinations ?? [])
        .map((d) => d.name?.trim())
        .filter(Boolean)
        .join(' → ');
}

/** Países para o bilhete (seleção ou roteiro). */
export function tripTicketCountries(trip: Trip): string[] {
    return resolveTripCountries(trip.payload, trip.payload?.destinations ?? []);
}


export type TripTicketLegDates = {
    ida: string;
    volta: string;
};

/** Ida e volta no estilo passagem aérea. */
export function tripTicketLegDates(trip: Trip): TripTicketLegDates {
    const startKey = toApiDayKey(trip.startsOn);
    const endKey = toApiDayKey(trip.endsOn);
    const ida = formatTripTicketDay(trip.startsOn) ?? '—';

    if (!endKey) {
        return { ida, volta: '—' };
    }
    if (startKey && endKey === startKey) {
        return { ida, volta: '—' };
    }
    const volta = formatTripTicketDay(trip.endsOn) ?? '—';
    return { ida, volta };
}

export function tripTicketRef(trip: Trip): string {
    const raw = trip.id.replace(/-/g, '').slice(-8).toUpperCase();
    return raw || '00000000';
}
