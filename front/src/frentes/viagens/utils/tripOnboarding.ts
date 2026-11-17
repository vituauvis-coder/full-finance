import { isHomeDestination } from '@motor/viagens/trip-places.js';
import type { Trip, TripDestination, TripPayload } from '../types';

export function travelDestinations(payload: TripPayload | undefined): TripDestination[] {
    return (payload?.destinations ?? []).filter(
        (d) => !isHomeDestination(d) && Number.isFinite(d.latitude) && Number.isFinite(d.longitude)
    );
}

export function tripNeedsOnboarding(trip: Trip): boolean {
    if (trip.payload?.onboardingComplete === true) return false;
    return travelDestinations(trip.payload).length === 0;
}