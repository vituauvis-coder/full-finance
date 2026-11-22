import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GeocodeHit, TripDestination, TripItineraryDay, TripPayload } from '../../types';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { ViagemMiniMap } from '../ViagemMiniMap';
import { geocodeReverse } from '../../api/trips';
import {
    activityPlaceLabel,
    isCountryOnlyDestination,
    isCountryOnlyPlaceName,
    applyResumoStopWindows,
    canRemoveMapDestination,
    destinationFromGeocode,
    itineraryMapPins,
    mapPlaceCardTitle,
    mapPlaceCityLabel,
    mapPlannableDestinations,
    destinationsNear,
    destinationCoords,
    hiddenMapDestIds,
    placeAnchorBeforeDay,
    resolvePayloadDestinationId,
    roteiroNavStops,
    stayAsMapDestination,
    stayDistanceToPoint,
    stayTravelTimeSuffix
} from './roteiros-display';
import { stayDisplayTitle } from '../hospedagens/hospedagens-display';
import { RoteiroDestinationModal } from './RoteiroDestinationModal';
import { RoteirosConfirmModal } from './RoteirosConfirmModal';
import { RoteirosGeocodeField } from './RoteirosGeocodeField';
import { RoteirosPlannerTimeline } from './RoteirosPlannerTimeline';
import { RoteirosMapPinPopover, countItineraryActivitiesForDest } from './RoteirosMapPinPopover';
import { RoteirosMapLegend } from './RoteirosMapLegend';
import { roteiroMapPinLabel } from '../../utils/map-utils';
import { geocodeBiasFromTrip } from '../../utils/geocode-bias';
import {
    formatGeocodeHitOption,
    geocodeAliasFallback,
    isGenericCountryGeocodeHit,
    nearestGeocodeAliasHits
} from '../../utils/place-display';
import {
    buildRoteirosMapRoutes,
    classifyRoteirosHop,
    flightAirportsAsDestinations,
    mergeFlightAirportsIntoPlaces
} from './roteiros-map-routes';
import { normalizeGroundTransports } from '../../domain/ground-transport';
import {
    buildChinaRouteLegs,
    chinaRouteStops,
    resolveChinaRouteOrder
} from '../../domain/chinaCityRoute';
import { useChinaRouteGeometry } from '../../hooks/useChinaRouteGeometry';
import { RoteirosChinaRouteModal } from './RoteirosChinaRouteModal';
import { RoteirosChinaRouteTooltip } from './RoteirosChinaRouteTooltip';

type Props = {
    payload: TripPayload;
    destinations: TripDestination[];
    startsOn: string;
    endsOn: string;
    status?: string;
    focusDestId?: string | null;
    onFocusDestChange?: (id: string | null) => void;
    onPatchPayload: (update: (payload: TripPayload) => TripPayload) => void;
    onChangeDestinations: (destinations: TripDestination[]) => void;
    onChangeItinerary: (
        update: TripItineraryDay[] | ((prev: TripItineraryDay[]) => TripItineraryDay[])
    ) => void;
    onFlushSave?: () => void | Promise<void>;
};

type PendingDelete = { mapDest: TripDestination; payloadId: string | null };

type PinSuggestState = {
    lat: number;
    lng: number;
    loading: boolean;
    hits: GeocodeHit[];
    pickIndex: number;
    showAlternates: boolean;
};

function preferPlaceText(
    next: string | null | undefined,
    prev: string | null | undefined
): string | null | undefined {
    const n = String(next ?? '').trim();
    const p = String(prev ?? '').trim();
    if (n && !isCountryOnlyPlaceName(n)) return n;
    if (p && !isCountryOnlyPlaceName(p)) return p;
    return n || p || null;
}

function findDestinationByCoords(destinations: TripDestination[], hit: GeocodeHit): TripDestination | null {
    const eps = 0.0008;
    return (
        destinations.find(
            (d) =>
                Math.abs(d.latitude - hit.latitude) < eps &&
                Math.abs(d.longitude - hit.longitude) < eps
        ) ?? null
    );
}

export function RoteirosPanel({
    payload,
    destinations,
    startsOn,
    endsOn,
    status,
    focusDestId,
    onFocusDestChange,
    onPatchPayload,
    onChangeDestinations,
    onChangeItinerary,
    onFlushSave
}: Props) {
    const [mapPinMode, setMapPinMode] = useState(false);
    const [pinPopoverId, setPinPopoverId] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
    const [editingDestId, setEditingDestId] = useState<string | null>(null);
    const [pinSuggest, setPinSuggest] = useState<PinSuggestState | null>(null);
    const [chinaSelectedLegId, setChinaSelectedLegId] = useState<string | null>(null);
    const [chinaRouteModalOpen, setChinaRouteModalOpen] = useState(false);
    const itinerary = payload.itinerary ?? [];
    const { order: chinaRouteOrder, poolSize: chinaRoutePoolSize } = useMemo(
        () => resolveChinaRouteOrder(destinations, payload),
        [destinations, payload]
    );
    const chinaLegMeta = useMemo(
        () => buildChinaRouteLegs(chinaRouteOrder, destinations),
        [chinaRouteOrder, destinations]
    );
    const chinaRouteLegs = useChinaRouteGeometry(chinaLegMeta, destinations);
    const chinaStops = useMemo(
        () => chinaRouteStops(chinaRouteOrder, destinations),
        [chinaRouteOrder, destinations]
    );
    const groundTransports = useMemo(() => normalizeGroundTransports(payload), [payload]);
    const navStops = useMemo(
        () =>
            applyResumoStopWindows(roteiroNavStops(destinations, payload), payload, destinations, startsOn, endsOn),
        [destinations, payload, startsOn, endsOn]
    );
    const flightAirports = useMemo(
        () => buildRoteirosMapRoutes(destinations, payload).airports,
        [destinations, payload, itinerary]
    );
    const plannablePlaces = useMemo(
        () => mergeFlightAirportsIntoPlaces(mapPlannableDestinations(destinations), flightAirports),
        [destinations, flightAirports]
    );
    const hiddenMapIds = useMemo(() => hiddenMapDestIds(payload), [payload]);
    const stays = payload.stays ?? [];
    const mapDestinations = useMemo(() => {
        const fromItinerary = itineraryMapPins(itinerary, destinations, navStops);
        const fromMap = mapPlannableDestinations(destinations);
        const seen = new Set(fromItinerary.map((d) => d.id));
        const merged = [...fromItinerary];
        for (const d of fromMap) {
            if (seen.has(d.id)) continue;
            seen.add(d.id);
            merged.push(d);
        }
        for (const day of itinerary) {
            const stay = stays.find((s) => s.id === day.stayId);
            if (!stay) continue;
            const pin = stayAsMapDestination(stay);
            if (!pin || seen.has(pin.id)) continue;
            seen.add(pin.id);
            merged.push(pin);
        }
        const withAirports = mergeFlightAirportsIntoPlaces(merged, flightAirports);
        if (!hiddenMapIds.size) return withAirports;
        return withAirports.filter((d) => !hiddenMapIds.has(d.id));
    }, [itinerary, destinations, navStops, hiddenMapIds, stays, flightAirports]);
    const mapSearchBias = useMemo(
        () => geocodeBiasFromTrip(destinations, focusDestId),
        [destinations, focusDestId]
    );
    const editingDest =
        destinations.find((d) => d.id === editingDestId) ??
        mapDestinations.find((d) => d.id === editingDestId) ??
        null;

    // Cidade do aero entra fixa no catálogo (Madri→airport MAD) e some o pin de cidade duplicado.
    useEffect(() => {
        if (!flightAirports.length) return;
        const aeroDests = flightAirportsAsDestinations(flightAirports);
        let changed = false;
        const next = destinations.map((d) => {
            const aero = flightAirports.find((a) => a.id === d.id || a.linkedDestinationId === d.id);
            if (!aero) return d;
            const name = aero.city || aero.label;
            if (
                d.kind === 'airport' &&
                d.name === name &&
                Math.abs(d.latitude - aero.latitude) < 0.0001 &&
                Math.abs(d.longitude - aero.longitude) < 0.0001
            ) {
                return d;
            }
            changed = true;
            return {
                ...d,
                kind: 'airport' as const,
                name,
                city: aero.city,
                country: aero.country || d.country,
                latitude: aero.latitude,
                longitude: aero.longitude
            };
        });
        for (const a of aeroDests) {
            if (next.some((d) => d.id === a.id)) continue;
            next.push(a);
            changed = true;
        }
        if (changed) onChangeDestinations(next);
    }, [flightAirports, destinations, onChangeDestinations]);

    const ensureDestination = useCallback(
        (hit: GeocodeHit): TripDestination => {
            const existing = findDestinationByCoords(destinations, hit);
            if (existing) return existing;
            const next = destinationFromGeocode(hit);
            onChangeDestinations([...destinations, next]);
            return next;
        },
        [destinations, onChangeDestinations]
    );

    function commitGeocodeHit(hit: GeocodeHit, searchQuery = '') {
        if (!Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) return;

        let resolved = destinationFromGeocode(hit, searchQuery);
        if (isCountryOnlyDestination(resolved)) return;

        let focusId: string | null = null;
        onPatchPayload((p) => {
            const prev = p.destinations ?? [];
            const existing = findDestinationByCoords(prev, hit);
            if (existing) {
                const next = prev.map((d) =>
                    d.id === existing.id
                        ? {
                              ...d,
                              name: resolved.name || d.name,
                              country: resolved.country ?? d.country,
                              city: preferPlaceText(resolved.city, d.city),
                              address: preferPlaceText(resolved.address, d.address),
                              kind: resolved.kind ?? d.kind,
                              latitude: hit.latitude,
                              longitude: hit.longitude
                          }
                        : d
                );
                focusId = existing.id;
                return { ...p, destinations: next };
            }
            focusId = resolved.id;
            return { ...p, destinations: [...prev, resolved] };
        });

        if (!focusId) return;
        onFocusDestChange?.(focusId);
        setMapPinMode(false);
        setPinSuggest(null);
        void onFlushSave?.();
    }

    function addDestinationFromHit(hit: GeocodeHit, searchQuery = '') {
        const alias = geocodeAliasFallback(searchQuery);
        let nextHit = hit;
        if (alias && (alias.kind === 'city' || alias.kind === 'attraction')) {
            const weak =
                (hit.kind ?? '').trim() === 'country' ||
                isGenericCountryGeocodeHit(hit, searchQuery) ||
                !Number.isFinite(hit.latitude) ||
                !Number.isFinite(hit.longitude);
            // Query de cidade conhecida (ex.: Xangai) → marca a cidade assertiva.
            if (weak || alias.kind === 'city' || alias.kind === 'attraction') {
                nextHit = alias as GeocodeHit;
            }
        }
        if ((nextHit.kind ?? '').trim() === 'country') {
            if (alias) nextHit = alias as GeocodeHit;
            else return;
        }
        if (!Number.isFinite(nextHit.latitude) || !Number.isFinite(nextHit.longitude)) return;
        if (isCountryOnlyDestination(destinationFromGeocode(nextHit, searchQuery))) {
            if (!alias) return;
            nextHit = alias as GeocodeHit;
            if (isCountryOnlyDestination(destinationFromGeocode(nextHit, searchQuery))) return;
        }
        commitGeocodeHit(nextHit, searchQuery);
    }

    function pinHitsFrom(lat: number, lng: number, hits: GeocodeHit[]): GeocodeHit[] {
        const usable = (hits ?? []).filter(
            (h) =>
                Number.isFinite(h.latitude) &&
                Number.isFinite(h.longitude) &&
                (h.kind ?? '') !== 'country' &&
                !isGenericCountryGeocodeHit(h, h.name)
        );
        if (usable.length) return usable.slice(0, 3);
        return (nearestGeocodeAliasHits(lat, lng, { limit: 3 }) as GeocodeHit[]) ?? [];
    }

    async function dropPin(lat: number, lng: number) {
        const existing = destinations.find(
            (d) => Math.abs(d.latitude - lat) < 0.0008 && Math.abs(d.longitude - lng) < 0.0008
        );
        if (existing) {
            onFocusDestChange?.(existing.id);
            setPinSuggest(null);
            return;
        }
        setPinPopoverId(null);
        setPinSuggest({
            lat,
            lng,
            loading: true,
            hits: [],
            pickIndex: 0,
            showAlternates: false
        });
        try {
            const { hits } = await geocodeReverse(lat, lng);
            setPinSuggest({
                lat,
                lng,
                loading: false,
                hits: pinHitsFrom(lat, lng, hits ?? []),
                pickIndex: 0,
                showAlternates: false
            });
        } catch {
            setPinSuggest({
                lat,
                lng,
                loading: false,
                hits: pinHitsFrom(lat, lng, []),
                pickIndex: 0,
                showAlternates: false
            });
        }
    }

    function confirmPinSuggest() {
        if (!pinSuggest || pinSuggest.loading) return;
        const hit = pinSuggest.hits[pinSuggest.pickIndex];
        if (!hit) return;
        commitGeocodeHit(hit, hit.name);
    }

    function updateDest(id: string, partial: Partial<TripDestination>) {
        onChangeDestinations(destinations.map((d) => (d.id === id ? { ...d, ...partial } : d)));
    }

    function commitPendingDelete() {
        if (!pendingDelete) return;
        const { mapDest, payloadId } = pendingDelete;
        const dropIds = new Set<string>([mapDest.id]);
        if (payloadId) dropIds.add(payloadId);

        onPatchPayload((p) => {
            const prevHidden = hiddenMapDestIds(p);
            const hidden = [...new Set([...prevHidden, mapDest.id])];
            let nextDests = (p.destinations ?? []).filter((d) => {
                if (payloadId && d.id === payloadId) return false;
                if (!payloadId && destinationsNear(d, mapDest)) return false;
                if (dropIds.has(d.id)) return false;
                return true;
            });
            const nextItinerary = (p.itinerary ?? []).map((day) => ({
                ...day,
                destinationId: dropIds.has(day.destinationId ?? '') ? null : day.destinationId,
                items: (day.items ?? []).map((it) =>
                    dropIds.has(it.destinationId ?? '')
                        ? { ...it, destinationId: null, placeName: null, groundTransportId: null }
                        : it
                )
            }));
            return {
                ...p,
                destinations: nextDests,
                itinerary: nextItinerary,
                roteMapHiddenDestIds: hidden
            };
        });

        if (focusDestId && dropIds.has(focusDestId)) onFocusDestChange?.(null);
        if (pinPopoverId && dropIds.has(pinPopoverId)) setPinPopoverId(null);
        setPendingDelete(null);
    }

    function requestRemoveDest(mapDest: TripDestination) {
        setPinPopoverId(null);
        setPendingDelete({
            mapDest,
            payloadId: resolvePayloadDestinationId(mapDest, destinations)
        });
    }

    function focusStop(id: string) {
        onFocusDestChange?.(id);
        setPinPopoverId(null);
    }

    function selectMapPin(id: string) {
        onFocusDestChange?.(id);
        setPinPopoverId(id);
    }

    function openEditPin(id: string) {
        setEditingDestId(id);
        setPinPopoverId(null);
    }

    function assignActivityPlace(dayId: string, itemId: string, destId: string | null) {
        let focusId: string | null = destId;
        onPatchPayload((p) => {
            const catalog = p.destinations ?? [];
            const dest = destId ? (catalog.find((d) => d.id === destId) ?? null) : null;
            if (destId && (!dest || isCountryOnlyDestination(dest))) return p;
            const stops = roteiroNavStops(catalog, p);
            const placeName = dest
                ? mapPlaceCityLabel(dest.city ?? dest.neighborhood, dest.country) ||
                  (isCountryOnlyPlaceName(String(dest.name ?? ''))
                      ? null
                      : String(dest.name ?? '')
                            .split(/[,/·]/)[0]
                            ?.trim()) ||
                  mapPlaceCardTitle(dest) ||
                  null
                : null;
            const prevAnchor = dest
                ? placeAnchorBeforeDay(dayId, p.itinerary ?? [], catalog, stops)
                : null;
            const suggestedMode = dest && prevAnchor ? classifyRoteirosHop(prevAnchor, dest, p) : null;
            const itinerary = (p.itinerary ?? []).map((day) => {
                if (day.id !== dayId) return day;
                return {
                    ...day,
                    items: (day.items ?? []).map((it) => {
                        if (it.id !== itemId) return it;
                        if (!destId) {
                            return {
                                ...it,
                                destinationId: null,
                                placeName: null,
                                groundTransportId: null
                            };
                        }
                        return {
                            ...it,
                            destinationId: destId,
                            placeName,
                            travelMode: it.travelMode ?? suggestedMode ?? null
                        };
                    })
                };
            });
            return { ...p, itinerary };
        });
        if (focusId) onFocusDestChange?.(focusId);
        void onFlushSave?.();
    }

    return (
        <div className="rote-board voos-home__block">
            <div className="rote-board__planner-layout">
                <section className="rote-map-frame" aria-label="Mapa do roteiro">
                    <header className="rote-map-frame__tab">
                        <span className="rote-map-frame__tab-label">
                            <MaterialIcon name="map" variant="app" opticalSize={18} filled />
                            Mapa
                        </span>
                    </header>

                    <div className="rote-map-frame__search-row">
                        <div className="rote-map-frame__search">
                            <RoteirosGeocodeField
                                searchBias={mapSearchBias}
                                relaxedHits
                                onPick={addDestinationFromHit}
                            />
                        </div>
                    </div>

                    {mapDestinations.length > 0 ? (
                        <div
                            className="rote-map-place-tags"
                            role="toolbar"
                            aria-label="Locais marcados no mapa"
                        >
                            {mapDestinations.map((dest) => {
                                const focused = focusDestId === dest.id;
                                const canRemove = canRemoveMapDestination(dest, destinations);
                                const title = mapPlaceCardTitle(dest);
                                return (
                                    <div
                                        key={dest.id}
                                        className={[
                                            'rote-map-place-tag',
                                            focused ? 'rote-map-place-tag--on' : ''
                                        ]
                                            .filter(Boolean)
                                            .join(' ')}
                                    >
                                        <button
                                            type="button"
                                            className="rote-map-place-tag__label"
                                            aria-pressed={focused}
                                            title="Zoom no mapa"
                                            onClick={() => focusStop(dest.id)}
                                        >
                                            {title}
                                        </button>
                                        <button
                                            type="button"
                                            className="rote-map-place-tag__act"
                                            aria-label={`Editar ${title}`}
                                            title="Editar"
                                            onClick={() => openEditPin(dest.id)}
                                        >
                                            <MaterialIcon name="edit" variant="app" opticalSize={14} />
                                        </button>
                                        {canRemove ? (
                                            <button
                                                type="button"
                                                className="rote-map-place-tag__act rote-map-place-tag__act--danger"
                                                aria-label={`Remover ${title}`}
                                                title="Remover"
                                                onClick={() => requestRemoveDest(dest)}
                                            >
                                                <MaterialIcon name="close" variant="app" opticalSize={14} />
                                            </button>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}

                    <div className="rote-map-tools" role="toolbar" aria-label="Ferramentas do mapa">
                        <div className="rote-map-tools__group" role="group" aria-label="Modo do mapa">
                            <button
                                type="button"
                                className={['rote-map-tools__btn', !mapPinMode ? 'is-on' : ''].join(' ')}
                                aria-pressed={!mapPinMode}
                                onClick={() => {
                                    setMapPinMode(false);
                                    setPinPopoverId(null);
                                    setPinSuggest(null);
                                }}
                            >
                                <MaterialIcon name="near_me" variant="app" opticalSize={16} />
                                Selecionar
                            </button>
                            <button
                                type="button"
                                className={['rote-map-tools__btn', mapPinMode ? 'is-on' : ''].join(' ')}
                                aria-pressed={mapPinMode}
                                onClick={() => {
                                    setMapPinMode(true);
                                    setPinPopoverId(null);
                                    setPinSuggest(null);
                                }}
                            >
                                <MaterialIcon name="add_location_alt" variant="app" opticalSize={16} />
                                Marcar pin
                            </button>
                        </div>
                        {chinaRoutePoolSize >= 2 ? (
                            <button
                                type="button"
                                className="rote-map-tools__btn rote-map-tools__btn--pill"
                                onClick={() => setChinaRouteModalOpen(true)}
                            >
                                <MaterialIcon name="route" variant="app" opticalSize={16} />
                                Rota China
                            </button>
                        ) : null}
                    </div>

                    <div className="rote-board__map">
                        <ViagemMiniMap
                            destinations={mapDestinations}
                            zoomTargets={navStops}
                            roteirosPayload={payload}
                            status={status ?? 'planejada'}
                            visual="roteiros"
                            focusDestId={focusDestId}
                            chinaRouteLegs={chinaRouteLegs}
                            chinaRouteStops={chinaStops.length >= 2 ? chinaStops : undefined}
                            chinaSelectedLegId={chinaSelectedLegId}
                            renderChinaLegTooltip={(leg) => (
                                <RoteirosChinaRouteTooltip
                                    leg={leg}
                                    onClose={() => setChinaSelectedLegId(null)}
                                />
                            )}
                            onFocusDest={mapPinMode ? undefined : (id) => (id ? selectMapPin(id) : onFocusDestChange?.(null))}
                            onTapCoord={mapPinMode ? dropPin : undefined}
                            pinPopoverId={mapPinMode ? null : pinPopoverId}
                            onPinPopoverClose={() => setPinPopoverId(null)}
                            renderPinPopover={(dest) => {
                                const payloadId = resolvePayloadDestinationId(dest, destinations);
                                const activityDestId = payloadId ?? dest.id;
                                const isStayPin = String(dest.id).startsWith('rote-stay-');
                                const stayIdFromPin = isStayPin
                                    ? String(dest.id).replace(/^rote-stay-/, '')
                                    : null;
                                const relatedStay =
                                    stays.find((s) => s.id === stayIdFromPin) ??
                                    stays.find((s) =>
                                        itinerary.some(
                                            (d) =>
                                                d.stayId === s.id &&
                                                (d.destinationId === activityDestId ||
                                                    (d.items ?? []).some((it) => it.destinationId === activityDestId))
                                        )
                                    ) ??
                                    null;
                                const dist =
                                    !isStayPin && relatedStay
                                        ? stayDistanceToPoint(relatedStay, destinationCoords(dest))
                                        : null;
                                const stayLabel = relatedStay ? stayDisplayTitle(relatedStay) : null;
                                return (
                                    <RoteirosMapPinPopover
                                        dest={dest}
                                        activityCount={countItineraryActivitiesForDest(itinerary, activityDestId)}
                                        canRemove={
                                            isStayPin
                                                ? false
                                                : canRemoveMapDestination(dest, destinations)
                                        }
                                        stayDistanceLabel={
                                            dist
                                                ? `${dist.label}${stayTravelTimeSuffix(
                                                      dist,
                                                      itinerary
                                                          .flatMap((d) => d.items ?? [])
                                                          .find((it) => it.destinationId === activityDestId)
                                                          ?.travelMode
                                                  )}${stayLabel ? ` · ${stayLabel}` : ''}`
                                                : isStayPin
                                                  ? 'Hospedagem base'
                                                  : null
                                        }
                                        onEdit={
                                            isStayPin
                                                ? undefined
                                                : () =>
                                                      openEditPin(
                                                          resolvePayloadDestinationId(dest, destinations) ??
                                                              dest.id
                                                      )
                                        }
                                        onRemove={() => requestRemoveDest(dest)}
                                    />
                                );
                            }}
                        />
                        {pinSuggest ? (
                            <div className="rote-map-pin-suggest" role="dialog" aria-label="Confirmar local do pin">
                                {pinSuggest.loading ? (
                                    <p className="rote-map-pin-suggest__q">Identificando local…</p>
                                ) : pinSuggest.hits.length === 0 ? (
                                    <>
                                        <p className="rote-map-pin-suggest__q">Não achei um local próximo.</p>
                                        <div className="rote-map-pin-suggest__actions">
                                            <button
                                                type="button"
                                                className="rote-map-pin-suggest__btn"
                                                onClick={() => setPinSuggest(null)}
                                            >
                                                Fechar
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="rote-map-pin-suggest__q">
                                            Quer marcar{' '}
                                            <strong>
                                                {formatGeocodeHitOption(
                                                    pinSuggest.hits[pinSuggest.pickIndex]!,
                                                    pinSuggest.hits[pinSuggest.pickIndex]!.name
                                                ).title || pinSuggest.hits[pinSuggest.pickIndex]!.name}
                                            </strong>
                                            ?
                                        </p>
                                        {pinSuggest.showAlternates && pinSuggest.hits.length > 1 ? (
                                            <ul className="rote-map-pin-suggest__alts">
                                                {pinSuggest.hits.map((h, idx) => {
                                                    const opt = formatGeocodeHitOption(h, h.name);
                                                    return (
                                                        <li key={`${h.name}-${h.latitude}-${idx}`}>
                                                            <button
                                                                type="button"
                                                                className={[
                                                                    'rote-map-pin-suggest__alt',
                                                                    idx === pinSuggest.pickIndex ? 'is-on' : ''
                                                                ]
                                                                    .filter(Boolean)
                                                                    .join(' ')}
                                                                onClick={() =>
                                                                    setPinSuggest((prev) =>
                                                                        prev
                                                                            ? {
                                                                                  ...prev,
                                                                                  pickIndex: idx,
                                                                                  showAlternates: false
                                                                              }
                                                                            : prev
                                                                    )
                                                                }
                                                            >
                                                                <span>{opt.title}</span>
                                                                <small>{opt.badge}</small>
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        ) : null}
                                        <div className="rote-map-pin-suggest__actions">
                                            <button
                                                type="button"
                                                className="rote-map-pin-suggest__btn rote-map-pin-suggest__btn--primary"
                                                onClick={confirmPinSuggest}
                                            >
                                                Marcar
                                            </button>
                                            {pinSuggest.hits.length > 1 ? (
                                                <button
                                                    type="button"
                                                    className="rote-map-pin-suggest__btn"
                                                    onClick={() =>
                                                        setPinSuggest((prev) =>
                                                            prev
                                                                ? {
                                                                      ...prev,
                                                                      showAlternates: !prev.showAlternates
                                                                  }
                                                                : prev
                                                        )
                                                    }
                                                >
                                                    Trocar
                                                </button>
                                            ) : null}
                                            <button
                                                type="button"
                                                className="rote-map-pin-suggest__btn"
                                                onClick={() => setPinSuggest(null)}
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : null}
                    </div>
                    <RoteirosMapLegend />
                </section>
                <RoteirosPlannerTimeline
                    destinations={destinations}
                    plannablePlaces={plannablePlaces}
                    plannerStops={navStops}
                    groundTransports={groundTransports}
                    tripPayload={payload}
                    days={itinerary}
                    onChangeDays={onChangeItinerary}
                    onSelectActivityPlace={assignActivityPlace}
                />
            </div>

            <RoteirosConfirmModal
                open={Boolean(pendingDelete)}
                title="Remover pin?"
                message={
                    pendingDelete
                        ? `O lugar «${roteiroMapPinLabel(pendingDelete.mapDest.name)}» sai do mapa e das atividades ligadas a ele.`
                        : ''
                }
                confirmLabel="Remover pin"
                onConfirm={commitPendingDelete}
                onClose={() => setPendingDelete(null)}
            />

            <RoteiroDestinationModal
                open={Boolean(editingDest)}
                dest={editingDest}
                onClose={() => setEditingDestId(null)}
                onSave={(partial) => {
                    if (!editingDestId) return;
                    if (destinations.some((d) => d.id === editingDestId)) {
                        updateDest(editingDestId, partial);
                        return;
                    }
                    const base = mapDestinations.find((d) => d.id === editingDestId);
                    if (base) onChangeDestinations([...destinations, { ...base, ...partial }]);
                }}
            />

            <RoteirosChinaRouteModal
                open={chinaRouteModalOpen}
                destinations={destinations}
                payload={payload}
                onPatchPayload={(update) => {
                    onPatchPayload(update);
                    void onFlushSave?.();
                }}
                selectedLegId={chinaSelectedLegId}
                onSelectLeg={setChinaSelectedLegId}
                onClose={() => setChinaRouteModalOpen(false)}
            />
        </div>
    );
}