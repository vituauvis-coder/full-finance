import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ScreenLoader } from '../../../components/ui/ScreenLoader';
import { ViagensBackControl } from '../components/ViagensBackControl';
import { ViagensPortalSection } from '../components/ViagensPortalSection';
import type { TripDraft } from '../components/ViagemFicha';
import { RoteirosPanel } from '../components/roteiros/RoteirosPanel';
import { RoteirosResumo } from '../components/roteiros/RoteirosResumo';
import {
    applyResumoStopWindows,
    dayKeyOf,
    holidayLeaveByDayFromPayload,
    itineraryItemsSignature,
    mergeChosenFlightsIntoItinerary,
    mergeDayStayBasesIntoItinerary,
    mergeHolidayLeaveIntoItinerary,
    mergeItineraryUserPlaces,
    mergeRemoteWorkIntoItinerary,
    remoteDayKeysFromPayload,
    roteiroNavStops,
    syncTripItinerary
} from '../components/roteiros/roteiros-display';
import { healStayDestinationIds } from '../components/hospedagens/hospedagens-display';
import { alignDraftDatesToChosenScenario, effectiveTripPeriod } from '../domain/tripResumoStats';
import { useTripAutosave } from '../hooks/useTripAutosave';
import '../styles/viagens-ficha-toolbar.css';
import '../styles/voos-workspace.css';
import '../styles/viagens-simulador.css';
import '../styles/orcamento-workspace.css';
import '../styles/roteiros-workspace.css';
import '../theme/viagens-theme.css';

export function ViagemRoteirosPage() {
    const { tripId } = useParams<{ tripId: string }>();
    const navigate = useNavigate();
    const { trip, draft, error, saveError, saving, onDraftChange, flushSave } = useTripAutosave(tripId);
    const draftRef = useRef(draft);
    draftRef.current = draft;

    if (error && !trip) {
        return (
            <ViagensPortalSection ficha>
                <div className="viagens-root viagens-ficha">
                    <p role="alert">{error}</p>
                    <ViagensBackControl label="Voltar" iconOnly onClick={() => navigate(`/viagens/${tripId}`)} />
                </div>
            </ViagensPortalSection>
        );
    }

    if (!trip || !draft) {
        return (
            <ViagensPortalSection ficha>
                <div className="viagens-root viagens-ficha">
                    <ScreenLoader label="Carregando roteiro" />
                </div>
            </ViagensPortalSection>
        );
    }

    return (
        <ViagensPortalSection ficha>
            <div className="viagens-root">
                <div className="viagens-ficha rote-page voos-page">
                    <header className="viagens-ficha__header">
                        <div className="viagens-ficha__chrome">
                            <div className="viagens-ficha__chrome-left">
                                <ViagensBackControl
                                    label="Voltar"
                                    iconOnly
                                    onClick={() => navigate(`/viagens/${trip.id}`)}
                                />
                                <h1 className="viagens-module-page__title">Roteiros</h1>
                            </div>
                            <div className="viagens-ficha__chrome-right">
                                {saving ? (
                                    <span className="viagens-ficha__save-hint" aria-live="polite">
                                        Salvando…
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </header>
                    {saveError ? (
                        <p role="alert" className="viagens-toast viagens-toast--error">
                            {saveError}
                        </p>
                    ) : null}

                    <RoteirosHome draft={draft} draftRef={draftRef} onDraftChange={onDraftChange} tripStatus={trip.effectiveStatus} />
                </div>
            </div>
        </ViagensPortalSection>
    );
}

function RoteirosHome({
    draft,
    draftRef,
    onDraftChange,
    tripStatus
}: {
    draft: TripDraft;
    draftRef: MutableRefObject<TripDraft | null>;
    onDraftChange: (draft: TripDraft) => void;
    tripStatus?: string;
}) {
    const [focusDestId, setFocusDestId] = useState<string | null>(null);
    const destinations = draft.payload.destinations ?? [];
    const itinerary = draft.payload.itinerary ?? [];
    const startsOn = draft.startsOn;
    const endsOn = draft.endsOn;

    useEffect(() => {
        const current = draftRef.current;
        if (!current) return;
        const aligned = alignDraftDatesToChosenScenario(current);
        const base = aligned ?? current;
        const allDestinations = base.payload.destinations ?? [];
        const period = effectiveTripPeriod(base.startsOn, base.endsOn, base.payload, allDestinations);
        const start = (period.startsOn ?? '').trim();
        const end = (period.endsOn ?? '').trim();
        if (!start || !end) return;
        const stops = applyResumoStopWindows(
            roteiroNavStops(allDestinations, base.payload),
            base.payload,
            allDestinations,
            start,
            end
        );
        const prev = base.payload.itinerary ?? [];
        const segments = base.payload.flight_segments ?? base.payload.flightSegments ?? [];
        let next = syncTripItinerary(start, end, prev, stops, allDestinations);
        next = mergeChosenFlightsIntoItinerary(next, segments, allDestinations);
        next = mergeRemoteWorkIntoItinerary(
            next,
            remoteDayKeysFromPayload(base.payload, allDestinations, start),
            allDestinations,
            stops
        );
        next = mergeHolidayLeaveIntoItinerary(
            next,
            holidayLeaveByDayFromPayload(base.payload, allDestinations, start, end),
            allDestinations,
            stops
        );
        const rawStays = base.payload.stays ?? [];
        const healedStays = healStayDestinationIds(rawStays, allDestinations);
        const staysForMerge = healedStays ?? rawStays;
        next = mergeDayStayBasesIntoItinerary(next, staysForMerge, allDestinations);
        next = mergeItineraryUserPlaces(prev, next, allDestinations);
        const datesChanged = Boolean(aligned);
        const sameKeys =
            prev.length === next.length &&
            prev.every(
                (d, i) =>
                    dayKeyOf(d) === dayKeyOf(next[i] ?? {}) &&
                    (d.destinationId ?? null) === (next[i]?.destinationId ?? null)
            );
        const staysChanged = Boolean(healedStays);
        if (
            !datesChanged &&
            sameKeys &&
            itineraryItemsSignature(prev) === itineraryItemsSignature(next) &&
            !staysChanged
        ) {
            return;
        }
        const synced: TripDraft = {
            ...base,
            startsOn: start,
            endsOn: end,
            payload: {
                ...base.payload,
                itinerary: next,
                ...(healedStays ? { stays: healedStays } : {})
            }
        };
        draftRef.current = synced;
        onDraftChange(synced);
    }, [
        startsOn,
        endsOn,
        destinations,
        draft.payload.flight_segments,
        draft.payload.flightSegments,
        draft.payload.chosen_time_scenario_id,
        draft.payload.chosenTimeScenarioId,
        draft.payload.stays,
        draftRef,
        onDraftChange
    ]);

    // Só define foco inicial. Não sobrescreve pin/tag do mapa (senão tudo “cai” no 1º stop).
    useEffect(() => {
        if (focusDestId) return;
        const stops = roteiroNavStops(destinations, draft.payload);
        if (stops[0]) {
            setFocusDestId(stops[0].id);
            return;
        }
        const firstMap = destinations.find(
            (d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude) && d.kind !== 'country'
        );
        if (firstMap) setFocusDestId(firstMap.id);
    }, [destinations, draft.payload, focusDestId]);

    function patchPayload(update: (payload: TripDraft['payload']) => TripDraft['payload']) {
        const current = draftRef.current;
        if (!current) return;
        const next: TripDraft = {
            ...current,
            payload: update(current.payload)
        };
        draftRef.current = next;
        onDraftChange(next);
    }

    return (
        <div className="rote-page__home voos-home">
            <RoteirosResumo
                destinations={destinations}
                itinerary={itinerary}
                startsOn={draft.startsOn}
                endsOn={draft.endsOn}
                focusDestId={focusDestId}
                onFocusDest={setFocusDestId}
            />
            <RoteirosPanel
                payload={draft.payload}
                destinations={destinations}
                startsOn={startsOn}
                endsOn={endsOn}
                status={tripStatus}
                focusDestId={focusDestId}
                onFocusDestChange={setFocusDestId}
                onPatchPayload={patchPayload}
                onChangeDestinations={(destinations) =>
                    patchPayload((p) => ({ ...p, destinations }))
                }
                onChangeItinerary={(update) =>
                    patchPayload((p) => ({
                        ...p,
                        itinerary:
                            typeof update === 'function' ? update(p.itinerary ?? []) : update
                    }))
                }
                onFlushSave={() => void flushSave()}
            />
        </div>
    );
}