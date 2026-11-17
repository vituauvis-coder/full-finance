import { useCallback, useEffect, useState } from 'react';
import { isHomeDestination } from '@motor/viagens/trip-places.js';
import { geocodeSearch } from '../api/trips';
import type { GeocodeHit, Trip, TripDestination } from '../types';
import { travelDestinations } from '../utils/tripOnboarding';
import { ViagemMiniMap } from './ViagemMiniMap';
import { tripToDraft, type TripDraft } from './ViagemFicha';
import './ViagemOnboardingStep.css';

type Props = {
    trip: Trip;
    saving?: boolean;
    submitLabel?: string;
    onChange: (draft: TripDraft) => void;
    onContinue: () => void;
    onBack: () => void;
};

export function ViagemOnboardingStep({
    trip,
    saving,
    submitLabel = 'Continuar para a ficha',
    onChange,
    onContinue,
    onBack
}: Props) {
    const [draft, setDraft] = useState(() => tripToDraft(trip));
    const destinations = draft.payload.destinations ?? [];
    const travel = travelDestinations(draft.payload);

    const [geoQ, setGeoQ] = useState('');
    const [geoHits, setGeoHits] = useState<GeocodeHit[]>([]);
    const [geoBusy, setGeoBusy] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    useEffect(() => {
        setDraft(tripToDraft(trip));
    }, [trip]);

    const patch = useCallback(
        (fn: (d: TripDraft) => TripDraft) => {
            setLocalError(null);
            setDraft((prev) => {
                const next = fn(prev);
                onChange(next);
                return next;
            });
        },
        [onChange]
    );

    async function runGeocode() {
        const q = geoQ.trim();
        if (q.length < 2) return;
        setGeoBusy(true);
        try {
            const { hits } = await geocodeSearch(q);
            setGeoHits(hits);
        } catch {
            setLocalError('Não foi possível buscar o lugar. Tente de novo.');
        } finally {
            setGeoBusy(false);
        }
    }

    function replacePrincipalDestination(dest: TripDestination) {
        const home = (draft.payload.destinations ?? []).filter((d) => isHomeDestination(d));
        patch((d) => ({
            ...d,
            payload: {
                ...d.payload,
                destinations: [...home, dest]
            }
        }));
    }

    function addDestination(hit: GeocodeHit) {
        const dest: TripDestination = {
            id: crypto.randomUUID(),
            name: hit.name,
            country: hit.country,
            latitude: hit.latitude,
            longitude: hit.longitude,
            isPrincipal: true
        };
        const home = (draft.payload.destinations ?? []).filter((d) => isHomeDestination(d));
        patch((d) => ({
            ...d,
            title: d.title.trim() || hit.name,
            payload: {
                ...d.payload,
                destinations: [...home, dest]
            }
        }));
        setGeoQ('');
        setGeoHits([]);
    }

    function dropPin(lat: number, lng: number) {
        replacePrincipalDestination({
            id: crypto.randomUUID(),
            name: geoQ.trim() || 'Novo destino',
            latitude: lat,
            longitude: lng,
            isPrincipal: true
        });
    }

    function handleContinue() {
        if (!draft.title.trim()) {
            setLocalError('Dê um nome à viagem.');
            return;
        }
        if (travelDestinations(draft.payload).length === 0) {
            setLocalError('Escolha ou marque um destino no mapa.');
            return;
        }
        onContinue();
    }

    const selected = travel[0];

    return (
        <div className="viagens-onboarding">
            <nav className="viagens-onboarding__steps" aria-label="Etapas">
                <span className="viagens-onboarding__step viagens-onboarding__step--on">1 Essenciais</span>
                <span className="viagens-onboarding__step">2 Ficha completa</span>
            </nav>

            <div className="viagens-onboarding__card">
                <h2 id="viagens-onboarding-title" className="viagens-onboarding__title">
                    Comece pela ideia
                </h2>
                <p className="viagens-onboarding__lead">
                    Nome e destino principal. Ao continuar, o pin entra no atlas (globo e mapa).
                </p>

                <div className="viagens-onboarding__field">
                    <label htmlFor="onboarding-trip-title">Nome da viagem</label>
                    <input
                        id="onboarding-trip-title"
                        type="text"
                        className="viagens-field viagens-onboarding__input"
                        value={draft.title}
                        onChange={(e) => patch((d) => ({ ...d, title: e.target.value }))}
                        placeholder="Ex.: Férias em Natal"
                        autoFocus
                    />
                </div>

                <div className="viagens-onboarding__field">
                    <label htmlFor="onboarding-geo">Destino</label>
                    <div className="viagens-onboarding__search">
                        <input
                            id="onboarding-geo"
                            type="search"
                            className="viagens-field viagens-onboarding__input"
                            value={geoQ}
                            onChange={(e) => setGeoQ(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && void runGeocode()}
                            placeholder="Cidade, país ou aeroporto"
                        />
                        <button
                            type="button"
                            className="viagens-btn viagens-btn--ghost"
                            disabled={geoBusy || geoQ.trim().length < 2}
                            onClick={() => void runGeocode()}
                        >
                            {geoBusy ? 'Buscando…' : 'Buscar'}
                        </button>
                    </div>
                    {selected ? (
                        <p className="viagens-onboarding__chip">
                            <span aria-hidden>📍</span> {selected.name}
                            {selected.country ? ` · ${selected.country}` : ''}
                        </p>
                    ) : null}
                    {geoHits.length > 0 ? (
                        <ul className="viagens-onboarding__hits">
                            {geoHits.map((h, i) => (
                                <li key={`${h.name}-${i}`}>
                                    <button type="button" onClick={() => addDestination(h)}>
                                        {h.name}
                                        {h.country ? ` — ${h.country}` : ''}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    <p className="viagens-muted viagens-onboarding__hint">Ou clique no mapa para soltar um pin.</p>
                </div>

                <div className="viagens-onboarding__map">
                    <ViagemMiniMap
                        destinations={destinations}
                        status={trip.effectiveStatus}
                        onTapCoord={dropPin}
                    />
                </div>

                {localError ? (
                    <p className="viagens-toast viagens-toast--error" role="alert">
                        {localError}
                    </p>
                ) : null}

                <div className="viagens-onboarding__actions">
                    <button type="button" className="viagens-btn viagens-btn--ghost" onClick={onBack}>
                        Voltar ao atlas
                    </button>
                    <button
                        type="button"
                        className="viagens-btn viagens-btn--coral"
                        disabled={saving}
                        onClick={handleContinue}
                    >
                        {saving ? 'Salvando…' : submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}