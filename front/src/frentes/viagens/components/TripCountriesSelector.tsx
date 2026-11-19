import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    canonicalCountryLabel,
    countriesCatalogSuggestions,
    uniqueCountryLabels
} from '@motor/viagens/trip-countries.js';
import { placesSummary } from '@motor/viagens/trip-places.js';
import type { TripDestination, TripPayload } from '../types';
import { CountryFlag } from './CountryFlag';
import '../styles/trip-countries-selector.css';

function readTripCountries(payload: TripPayload): string[] {
    const raw = payload.tripCountries ?? payload.trip_countries;
    return Array.isArray(raw) ? uniqueCountryLabels(raw) : [];
}

type Props = {
    payload: TripPayload;
    destinations: TripDestination[];
    onChange: (countries: string[]) => void;
};

export function TripCountriesSelector({ payload, destinations, onChange }: Props) {
    const selected = useMemo(() => readTripCountries(payload), [payload]);
    const fromRoute = useMemo(() => placesSummary(destinations).countries, [destinations]);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const wrapRef = useRef<HTMLDivElement>(null);

    const suggestions = useMemo(() => countriesCatalogSuggestions(query, 10), [query]);

    const routeOnly = useMemo(() => {
        if (selected.length) return [];
        const sel = new Set(selected.map((c) => canonicalCountryLabel(c).toLowerCase()));
        return fromRoute.filter((c) => !sel.has(canonicalCountryLabel(c).toLowerCase()));
    }, [fromRoute, selected]);

    const displayCountries = selected.length ? selected : fromRoute;

    const patchCountries = useCallback(
        (next: string[]) => {
            onChange(uniqueCountryLabels(next));
        },
        [onChange]
    );

    const addCountry = useCallback(
        (raw: string) => {
            const label = canonicalCountryLabel(raw);
            if (!label) return;
            patchCountries([...selected, label]);
            setQuery('');
            setOpen(false);
        },
        [patchCountries, selected]
    );

    const removeCountry = useCallback(
        (label: string) => {
            const f = canonicalCountryLabel(label).toLowerCase();
            patchCountries(selected.filter((c) => canonicalCountryLabel(c).toLowerCase() !== f));
        },
        [patchCountries, selected]
    );

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    return (
        <div className="trip-countries" ref={wrapRef}>
            <div className="trip-countries__row" role="list" aria-label="Países da viagem">
                {displayCountries.length === 0 ? (
                    <span className="trip-countries__empty">Países da rota</span>
                ) : (
                    displayCountries.map((c) => (
                        <span key={c} className="trip-countries__chip" role="listitem">
                            <CountryFlag label={c} showLabel className="country-flag country-flag--chip" />
                            {selected.length > 0 ? (
                                <button
                                    type="button"
                                    className="trip-countries__chip-remove"
                                    aria-label={`Remover ${c}`}
                                    onClick={() => removeCountry(c)}
                                >
                                    ×
                                </button>
                            ) : null}
                        </span>
                    ))
                )}
                <button
                    type="button"
                    className="trip-countries__add"
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    onClick={() => setOpen((v) => !v)}
                >
                    + País
                </button>
            </div>
            {routeOnly.length > 0 && selected.length === 0 ? (
                <p className="trip-countries__hint">
                    Do roteiro —{' '}
                    {routeOnly.map((c) => (
                        <button key={c} type="button" className="trip-countries__hint-btn" onClick={() => addCountry(c)}>
                            <CountryFlag label={c} showLabel className="country-flag country-flag--inline" />
                        </button>
                    ))}
                </p>
            ) : null}
            {open ? (
                <div className="trip-countries__popover" role="listbox">
                    <input
                        className="trip-countries__search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar país…"
                        aria-label="Buscar país"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && suggestions[0]) {
                                e.preventDefault();
                                addCountry(suggestions[0]);
                            }
                            if (e.key === 'Escape') setOpen(false);
                        }}
                    />
                    <ul className="trip-countries__suggest">
                        {suggestions.map((s) => (
                            <li key={s}>
                                <button type="button" onClick={() => addCountry(s)}>
                                    <CountryFlag label={s} showLabel className="country-flag country-flag--inline" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}