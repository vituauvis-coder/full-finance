import { canonicalCountryLabel } from '@motor/viagens/trip-countries.js';
import type { TripCheckItem, TripCountryTravelNote } from '../types';

export type CountryCheckField = 'requiredDocs' | 'paymentMethods' | 'internetChip';

export function splitCountryNoteItems(raw: string | undefined): string[] {
    const t = (raw ?? '').trim();
    if (!t) return [];
    const parts = t
        .split(/\s*[·;]\s*|\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
    return parts.length ? parts : [t];
}

export function checksForCountryField(
    checks: TripCheckItem[],
    country: string,
    field: CountryCheckField
): TripCheckItem[] {
    const key = canonicalCountryLabel(country);
    return checks.filter(
        (c) =>
            c.countryCheck?.country === key &&
            c.countryCheck?.field === field
    );
}

export function appendCountryCheckItems(
    checks: TripCheckItem[],
    country: string,
    field: CountryCheckField,
    titles: string[]
): TripCheckItem[] {
    const key = canonicalCountryLabel(country);
    const items = titles
        .map((title) => title.trim())
        .filter(Boolean)
        .map((title) => ({
            id: crypto.randomUUID(),
            title,
            done: false,
            countryCheck: { country: key, field }
        }));
    return items.length ? [...checks, ...items] : checks;
}

export function markCountryChecksSeeded(
    notes: Record<string, TripCountryTravelNote>,
    country: string,
    field: CountryCheckField
): Record<string, TripCountryTravelNote> {
    const key = canonicalCountryLabel(country);
    const prev = notes[key] ?? {};
    return {
        ...notes,
        [key]: {
            ...prev,
            checksSeeded: { ...prev.checksSeeded, [field]: true }
        }
    };
}

export function seedTextForField(
    merged: TripCountryTravelNote,
    field: CountryCheckField,
    fallback: string
): string {
    const raw = merged[field];
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (field === 'requiredDocs' && merged.obligations?.trim()) return merged.obligations;
    return fallback;
}