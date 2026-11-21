import { canonicalCountryLabel, countryIso2ForLabel } from '@motor/viagens/trip-countries.js';
import type { TripDestination } from '../types';

export type GeocodeSearchBias = {
    countryCodes?: string;
    lat?: number;
    lon?: number;
};

export function geocodeBiasFromTrip(
    destinations: TripDestination[],
    focusDestId?: string | null,
    dayCountryLabel?: string | null
): GeocodeSearchBias {
    const codes = new Set<string>();
    for (const d of destinations) {
        const label = canonicalCountryLabel(d.country ?? d.name);
        const iso = countryIso2ForLabel(label);
        if (iso) codes.add(iso.toLowerCase());
    }
    if (dayCountryLabel) {
        const iso = countryIso2ForLabel(canonicalCountryLabel(dayCountryLabel));
        if (iso) codes.add(iso.toLowerCase());
    }
    const focused =
        (focusDestId ? destinations.find((d) => d.id === focusDestId) : null) ??
        destinations.find((d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude)) ??
        null;
    return {
        countryCodes: [...codes].slice(0, 4).join(','),
        lat: focused?.latitude,
        lon: focused?.longitude
    };
}