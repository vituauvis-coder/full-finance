import type { Trip, TripStatus } from '../types';
import { formatTripDateRange } from '../utils/trip-dates';

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

export function tripTicketDates(trip: Trip): string {
    return formatTripDateRange(trip.startsOn, trip.endsOn);
}

export function tripTicketRef(trip: Trip): string {
    const raw = trip.id.replace(/-/g, '').slice(-8).toUpperCase();
    return raw || '00000000';
}