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
    const [popoverBox, setPopoverBox] = useState<{ top: number; left: number; width: number } | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const addRef = useRef<HTMLButtonElement>(null);

    const suggestions = useMemo(
        () => countriesCatalogSuggestions(query, query.trim() ? 24 : 400),
        [query]
    );

    const routeOnly = useMemo(() => {
        if (selected.length) return [];
        const sel = new Set(selected.map((c) => canonicalCountryLabel(c).toLowerCase()));
        return fromRoute.filter((c) => !sel.has(canonicalCountryLabel(c).toLowerCase()));
    }, [fromRoute, selected]);

    const displayCountries = selected.length ? selected : fromRoute;

    const selectedKeys = useMemo(
        () => new Set(selected.map((c) => canonicalCountryLabel(c).toLowerCase())),
        [selected]
    );

    const patchCountries = useCallback(
        (next: string[]) => {
            onChange(uniqueCountryLabels(next));
        },
        [onChange]
    );

    const closePopover = useCallback(() => {
        setOpen(false);
        setPopoverBox(null);
        setQuery('');
    }, []);

    const addCountry = useCallback(
        (raw: string) => {
            const label = canonicalCountryLabel(raw);
            if (!label) return;
            patchCountries([...selected, label]);
            setQuery('');
            closePopover();
        },
        [closePopover, patchCountries, selected]
    );

    const removeCountry = useCallback(
        (label: string) => {
            const f = canonicalCountryLabel(label).toLowerCase();
            patchCountries(selected.filter((c) => canonicalCountryLabel(c).toLowerCase() !== f));
        },
        [patchCountries, selected]
    );

    const placePopover = useCallback(() => {
        const btn = addRef.current;
        if (!btn) return;
        const r = btn.getBoundingClientRect();
        const width = Math.max(16 * 16, r.width);
        let left = r.left;
        const margin = 8;
        if (left + width > window.innerWidth - margin) {
            left = window.innerWidth - width - margin;
        }
        left = Math.max(margin, left);
        setPopoverBox({ top: r.bottom + 6, left, width });
    }, []);

    useEffect(() => {
        if (!open) return;
        placePopover();
        const onResize = () => placePopover();
        window.addEventListener('resize', onResize);
        window.addEventListener('scroll', onResize, true);
        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('scroll', onResize, true);
        };
    }, [open, placePopover]);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            const t = e.target as Node;
            if (wrapRef.current?.contains(t)) return;
            const pop = document.getElementById('trip-countries-popover-layer');
            if (pop?.contains(t)) return;
            closePopover();
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open, closePopover]);

    useEffect(() => {
        if (!open) return;
        const id = window.requestAnimationFrame(() => {
            const el = document.getElementById('trip-countries-popover-search');
            if (el instanceof HTMLInputElement) el.focus();
        });
        return () => window.cancelAnimationFrame(id);
    }, [open]);

    return (
        <div className="trip-countries" ref={wrapRef}>
            <div className="trip-countries__row" role="list" aria-label="Países da viagem">
                {displayCountries.length === 0 ? (
                    <span className="trip-countries__empty">Países da rota</span>
                ) : (
                    displayCountries.map((c) => {
                        const canRemove = selectedKeys.has(canonicalCountryLabel(c).toLowerCase());
                        return (
                            <span key={c} className="trip-countries__chip" role="listitem">
                                <CountryFlag label={c} showLabel className="country-flag country-flag--chip" />
                                {canRemove ? (
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
                        );
                    })
                )}
                <button
                    ref={addRef}
                    type="button"
                    className="trip-countries__add"
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    onClick={() => {
                        if (open) closePopover();
                        else setOpen(true);
                    }}
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
            {open && popoverBox ? (
                <div
                    id="trip-countries-popover-layer"
                    className="trip-countries__popover trip-countries__popover--fixed"
                    role="listbox"
                    style={{
                        top: popoverBox.top,
                        left: popoverBox.left,
                        width: popoverBox.width
                    }}
                >
                    <input
                        id="trip-countries-popover-search"
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
                            if (e.key === 'Escape') closePopover();
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