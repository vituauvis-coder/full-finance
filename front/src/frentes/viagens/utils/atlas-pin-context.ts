import type { MapVisit, Trip } from '../types';
import { formatTripTicketDay } from './trip-dates';

export type AtlasPinItineraryHint = {
    dayLabel: string;
    activityTitle?: string;
};

function dayLabelFromKey(dayKey: string | null | undefined): string | null {
    const raw = dayKey?.trim();
    if (!raw) return null;
    const parsed = formatTripTicketDay(raw);
    return parsed ?? raw;
}

/** Primeira menção do destino no roteiro (dia + atividade). */
export function itineraryHintForDestination(trip: Trip, destinationId: string): AtlasPinItineraryHint | null {
    const target = String(destinationId);
    for (const day of trip.payload?.itinerary ?? []) {
        const dayKey = (day as { dayKey?: string; day_key?: string }).dayKey ?? day.day_key;
        const dayLabel = dayLabelFromKey(dayKey);
        const dayDest = day.destinationId ?? day.destination_id ?? null;

        for (const item of day.items ?? []) {
            const itemDest = item.destinationId ?? item.destination_id ?? dayDest;
            if (String(itemDest) !== target) continue;
            const activityTitle =
                (item.title ?? item.placeName ?? item.place_name)?.trim() || undefined;
            if (!dayLabel && !activityTitle) return null;
            return {
                dayLabel: dayLabel ? `Roteiro · ${dayLabel}` : 'Roteiro',
                activityTitle
            };
        }

        if (dayDest != null && String(dayDest) === target && dayLabel) {
            return { dayLabel: `Roteiro · ${dayLabel}` };
        }
    }
    return null;
}

export function atlasPinPopoverFromVisit(visit: MapVisit, trip: Trip | undefined) {
    const hint =
        trip && visit.destination.id
            ? itineraryHintForDestination(trip, visit.destination.id)
            : null;
    return {
        placeName: visit.hover.placeName || visit.destination.name,
        tripTitle: visit.hover.tripTitle || visit.tripTitle,
        status: visit.status,
        monthYear: visit.hover.monthYear,
        itineraryDay: hint?.dayLabel,
        activity: hint?.activityTitle,
        citySpent: visit.hover.citySpent,
        tripTotal: visit.hover.tripTotal,
        tripId: visit.tripId
    };
}

export function atlasPinPopoverFromTrip(trip: Trip, placeName: string) {
    return {
        placeName,
        tripTitle: trip.title?.trim() || 'Viagem',
        status: trip.effectiveStatus ?? 'planejada',
        monthYear: '',
        itineraryDay: undefined as string | undefined,
        activity: undefined as string | undefined,
        citySpent: undefined as number | undefined,
        tripTotal: trip.tripTotal,
        tripId: trip.id
    };
}