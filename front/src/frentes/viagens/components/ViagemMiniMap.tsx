import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, NavigationControl, Popup, Source, type MapRef } from 'react-map-gl/maplibre';
import type { ReactNode } from 'react';
import { isHomeDestination, routeStops } from '@motor/viagens/trip-places.js';
import { VIAGENS_HOME } from '@motor/viagens/viagens-atlas.js';
import type { TripDestination, TripPayload, TripStatus } from '../types';
import {
    ROTEIROS_ROUTE_ICONS,
    ROTEIROS_ROUTE_PAINT,
    buildRoteirosMapRoutes,
    featureCollectionFromSegments,
    formatHopDurationLabel,
    isCityPinCoveredByAirport,
    type RoteirosRouteMode,
    type RoteirosRouteSegment
} from './roteiros/roteiros-map-routes';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import {
    applyRoteirosMapLabels,
    applyRoteirosRoadmapStyle,
    bindRoteirosMapLabels,
    ensureMapLibreWorker,
    mapStyleForRoteiros,
    mapStyleForTheme,
    scheduleMapResize
} from '../utils/maplibre-setup';
import { ViagensPlaceBadge } from './ViagensPlaceBadge';
import {
    mapAirportBadgeLabel,
    mapPinIconForDestination,
    mapPinLabelForDestination,
    mapPinVisualKind
} from '../utils/map-utils';
import { fetchRoadRoute } from '../api/trips';
import 'maplibre-gl/dist/maplibre-gl.css';

ensureMapLibreWorker();

type Props = {
    destinations: TripDestination[];
    status?: TripStatus;
    visual?: 'default' | 'roteiros';
    focusDestId?: string | null;
    onFocusDest?: (id: string | null) => void;
    onTapCoord?: (lat: number, lng: number) => void;
    /** Pin selecionado no modo roteiros — popup no mapa. */
    pinPopoverId?: string | null;
    onPinPopoverClose?: () => void;
    renderPinPopover?: (dest: TripDestination) => ReactNode;
    roteirosPayload?: TripPayload;
    /** Atalhos de zoom (ex.: países da ficha) — não viram pin no mapa. */
    zoomTargets?: TripDestination[];
};

export function ViagemMiniMap({
    destinations,
    status = 'planejada',
    visual = 'default',
    focusDestId,
    onFocusDest,
    onTapCoord,
    pinPopoverId,
    onPinPopoverClose,
    renderPinPopover,
    roteirosPayload,
    zoomTargets
}: Props) {
    void status;
    const mapRef = useRef<MapRef>(null);
    const labelsBoundRef = useRef(false);
    const [mapStyle] = useState(() => (visual === 'roteiros' ? mapStyleForRoteiros() : mapStyleForTheme()));
    const roteiros = visual === 'roteiros';
    const routeCatalog = roteirosPayload?.destinations ?? destinations;
    const itineraryRouteKey = useMemo(() => {
        const days = roteirosPayload?.itinerary ?? [];
        return days
            .flatMap((d) => (d.items ?? []).map((i) => `${i.id}:${i.destinationId ?? ''}:${i.travelMode ?? ''}`))
            .join('|');
    }, [roteirosPayload]);

    const roteirosRoutes = useMemo(() => {
        if (!roteiros) return null;
        return buildRoteirosMapRoutes(routeCatalog, roteirosPayload);
    }, [routeCatalog, roteiros, roteirosPayload, itineraryRouteKey]);

    /** Trechos terrestres enriquecidos com geometria real (OSRM); null = ainda no fallback. */
    const [roadSegments, setRoadSegments] = useState<RoteirosRouteSegment[] | null>(null);

    useEffect(() => {
        if (!roteirosRoutes) {
            setRoadSegments(null);
            return;
        }
        const base = roteirosRoutes.segments;
        setRoadSegments(base);
        let cancelled = false;

        (async () => {
            const next = await Promise.all(
                base.map(async (seg) => {
                    if (seg.mode !== 'ground' && seg.mode !== 'walk') return seg;
                    const start = seg.coordinates[0];
                    const end = seg.coordinates[seg.coordinates.length - 1];
                    if (!start || !end) return seg;
                    try {
                        const road = await fetchRoadRoute({
                            fromLng: start[0],
                            fromLat: start[1],
                            toLng: end[0],
                            toLat: end[1],
                            profile: seg.mode === 'walk' ? 'foot' : 'driving'
                        });
                        if (!Array.isArray(road.coordinates) || road.coordinates.length < 2) {
                            return seg;
                        }
                        const coords = road.coordinates as [number, number][];
                        const midPt = coords[Math.floor(coords.length / 2)] ?? end;
                        const durationMin =
                            road.durationSec != null && Number.isFinite(road.durationSec)
                                ? Math.max(1, Math.round(road.durationSec / 60))
                                : seg.durationMin;
                        const durationLabel = formatHopDurationLabel(durationMin);
                        return {
                            ...seg,
                            coordinates: coords,
                            mid: { longitude: midPt[0]!, latitude: midPt[1]! },
                            durationMin,
                            durationLabel: seg.scheduleLabel || durationLabel,
                            tip: `${seg.fromLabel} → ${seg.toLabel}${
                                seg.scheduleLabel ? ` · ${seg.scheduleLabel}` : ''
                            } · ${durationLabel}`
                        };
                    } catch {
                        return seg;
                    }
                })
            );
            if (!cancelled) setRoadSegments(next);
        })();

        return () => {
            cancelled = true;
        };
    }, [roteirosRoutes]);

    const flightAirports = useMemo(() => roteirosRoutes?.airports ?? [], [roteirosRoutes]);

    const stops = useMemo(() => {
        const base = roteiros
            ? destinations.filter(
                  (d) => !isHomeDestination(d) && Number.isFinite(d.latitude) && Number.isFinite(d.longitude)
              )
            : routeStops(destinations);
        // Cidade do aero some do mapa — fica só o marco MAD/PEK.
        if (!roteiros || !flightAirports.length) return base;
        return base.filter((d) => !isCityPinCoveredByAirport(d, flightAirports));
    }, [destinations, roteiros, flightAirports]);

    const focusCatalog = useMemo(() => {
        const seen = new Set<string>();
        const out: TripDestination[] = [];
        for (const d of [...stops, ...(zoomTargets ?? [])]) {
            if (seen.has(d.id)) continue;
            seen.add(d.id);
            out.push(d);
        }
        return out;
    }, [stops, zoomTargets]);

    const activeSegments = roadSegments ?? roteirosRoutes?.segments ?? null;

    const hopGeo = useMemo(() => {
        if (activeSegments) return featureCollectionFromSegments(activeSegments);
        // Sem roteiros: só ida pelos stops — não inventa volta para Recife.
        const coords: [number, number][] = [[VIAGENS_HOME.longitude, VIAGENS_HOME.latitude]];
        for (const d of stops) coords.push([d.longitude, d.latitude]);
        const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
        for (let i = 0; i < coords.length - 1; i++) {
            features.push({
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: [coords[i], coords[i + 1]] }
            });
        }
        return { type: 'FeatureCollection' as const, features };
    }, [stops, activeSegments]);

    const hopIcons = useMemo(
        () =>
            (activeSegments ?? []).map((s) => ({
                ...s,
                icon: ROTEIROS_ROUTE_ICONS[s.mode]
            })),
        [activeSegments]
    );

    const center = useMemo(() => {
        if (!stops.length) return { lng: VIAGENS_HOME.longitude, lat: VIAGENS_HOME.latitude, zoom: 3 };
        const lat = stops.reduce((s, d) => s + d.latitude, 0) / stops.length;
        const lng = stops.reduce((s, d) => s + d.longitude, 0) / stops.length;
        return { lng, lat, zoom: stops.length === 1 ? 6 : 4.5 };
    }, [stops]);

    const onMapClick = useCallback(
        (ev: { lngLat: { lat: number; lng: number } }) => {
            onTapCoord?.(ev.lngLat.lat, ev.lngLat.lng);
        },
        [onTapCoord]
    );

    useEffect(() => {
        if (!focusDestId) return;
        const map = mapRef.current?.getMap();
        const focus = focusCatalog.find((d) => d.id === focusDestId);
        if (!map || !focus) return;
        map.flyTo({
            center: [focus.longitude, focus.latitude],
            zoom: Math.max(map.getZoom(), 5.5),
            duration: 750,
            essential: true
        });
    }, [focusDestId, focusCatalog]);

    const pinPopoverDest = useMemo(
        () => (pinPopoverId ? (stops.find((d) => d.id === pinPopoverId) ?? null) : null),
        [pinPopoverId, stops]
    );
    const roteirosSelect = roteiros && !onTapCoord;

    const tuneRoteiros = useCallback(() => {
        const map = mapRef.current?.getMap();
        if (!map || !roteiros) return;
        applyRoteirosMapLabels(map);
        applyRoteirosRoadmapStyle(map);
    }, [roteiros]);

    return (
        <div
            className={[
                'viagens-mini-map',
                roteiros ? 'viagens-mini-map--roteiros' : '',
                roteiros && onTapCoord ? 'viagens-mini-map--pin-mode' : ''
            ]
                .filter(Boolean)
                .join(' ')}
            aria-label="Mini-mapa da viagem"
        >
            <Map
                ref={mapRef}
                initialViewState={{ ...center, zoom: center.zoom }}
                mapStyle={mapStyle}
                style={{ width: '100%', height: '100%' }}
                attributionControl={{ compact: true }}
                onLoad={() => {
                    const map = mapRef.current?.getMap();
                    if (!map) return;
                    scheduleMapResize(map);
                    if (roteiros) {
                        if (!labelsBoundRef.current) {
                            labelsBoundRef.current = true;
                            bindRoteirosMapLabels(map);
                        }
                        tuneRoteiros();
                    }
                }}
                onStyleData={tuneRoteiros}
                onClick={
                    roteiros
                        ? onTapCoord
                            ? (e) => onMapClick({ lngLat: e.lngLat })
                            : () => onPinPopoverClose?.()
                        : (e) => onMapClick({ lngLat: e.lngLat })
                }
                cursor={roteiros ? (onTapCoord ? 'crosshair' : 'default') : onTapCoord ? 'crosshair' : 'default'}
                dragPan
            >
                {roteiros ? <NavigationControl position="top-right" showCompass={false} /> : null}
                <Source id="mini-routes" type="geojson" data={hopGeo}>
                    {roteiros ? (
                        (['flight_out', 'flight_back', 'ground', 'walk'] as RoteirosRouteMode[]).map(
                            (mode) => {
                                const paint = ROTEIROS_ROUTE_PAINT[mode];
                                return (
                                    <Layer
                                        key={mode}
                                        id={`mini-routes-${mode}`}
                                        type="line"
                                        filter={['==', ['get', 'mode'], mode]}
                                        layout={{
                                            'line-cap': 'round',
                                            'line-join': 'round'
                                        }}
                                        paint={{
                                            'line-color': paint.color,
                                            'line-width': paint.width,
                                            ...(paint.dash ? { 'line-dasharray': paint.dash } : {}),
                                            'line-opacity': paint.opacity ?? 1
                                        }}
                                    />
                                );
                            }
                        )
                    ) : (
                        <Layer
                            id="mini-routes-line"
                            type="line"
                            paint={{
                                'line-color': 'rgba(46, 196, 182, 1)',
                                'line-width': 2,
                                'line-dasharray': [1.8, 1.2]
                            }}
                        />
                    )}
                </Source>
                {roteiros
                    ? flightAirports.map((aero) => (
                          <Marker
                              key={aero.id}
                              longitude={aero.longitude}
                              latitude={aero.latitude}
                              anchor="center"
                          >
                              <span
                                  className="rote-map-airport"
                                  title={`Aeroporto · ${aero.label}`}
                                  aria-label={`Aeroporto ${aero.code || aero.label}`}
                              >
                                  <span className="rote-map-airport__icon" aria-hidden>
                                      <MaterialIcon name="flight" variant="app" opticalSize={18} filled />
                                  </span>
                                  <span className="rote-map-airport__code">{aero.code}</span>
                              </span>
                          </Marker>
                      ))
                    : null}
                {roteiros
                    ? hopIcons.map((hop) => {
                          const isFlight = hop.mode === 'flight_out' || hop.mode === 'flight_back';
                          const title =
                              hop.tip ||
                              (hop.mode === 'flight_out'
                                  ? `Ida · ${hop.durationLabel}`
                                  : hop.mode === 'flight_back'
                                    ? `Volta · ${hop.durationLabel}`
                                    : hop.durationLabel);
                          return (
                              <Marker
                                  key={hop.id}
                                  longitude={hop.mid.longitude}
                                  latitude={hop.mid.latitude}
                                  anchor="center"
                              >
                                  <button
                                      type="button"
                                      className={[
                                          'rote-map-hop',
                                          'rote-map-hop--interactive',
                                          `rote-map-hop--${hop.mode}`
                                      ].join(' ')}
                                      title={title}
                                      aria-label={title}
                                  >
                                      <span
                                          className={[
                                              'rote-map-hop-icon',
                                              `rote-map-hop-icon--${hop.mode}`
                                          ].join(' ')}
                                      >
                                          <MaterialIcon
                                              name={hop.icon}
                                              variant="app"
                                              opticalSize={18}
                                              filled={isFlight}
                                          />
                                      </span>
                                      <span
                                          className={[
                                              'rote-map-hop-time',
                                              `rote-map-hop-time--${hop.mode}`
                                          ].join(' ')}
                                      >
                                          {hop.durationLabel}
                                      </span>
                                  </button>
                              </Marker>
                          );
                      })
                    : null}
                <Marker longitude={VIAGENS_HOME.longitude} latitude={VIAGENS_HOME.latitude} anchor="center">
                    <ViagensPlaceBadge
                        name={roteiros ? 'REC' : VIAGENS_HOME.name}
                        className={roteiros ? 'viagens-place-badge__label--roteiros' : ''}
                    />
                </Marker>
                {pinPopoverDest && renderPinPopover ? (
                    <Popup
                        longitude={pinPopoverDest.longitude}
                        latitude={pinPopoverDest.latitude}
                        anchor="bottom"
                        offset={14}
                        closeButton
                        closeOnClick={false}
                        className="rote-map-pin-popup"
                        onClose={() => onPinPopoverClose?.()}
                    >
                        {renderPinPopover(pinPopoverDest)}
                    </Popup>
                ) : null}
                {stops.map((d) => {
                    const focused = roteiros && (focusDestId === d.id || pinPopoverId === d.id);
                    const label = roteiros ? mapPinLabelForDestination(d) : mapAirportBadgeLabel(d.name);
                    const pinKind = roteiros ? mapPinVisualKind(d) : 'base';
                    const pinIcon = roteiros ? mapPinIconForDestination(d) : 'location_on';
                    const pinClass = [
                        'viagens-place-marker',
                        'rote-map-pin',
                        `rote-map-pin--${pinKind}`,
                        focused ? 'rote-map-marker--focus' : ''
                    ];
                    return (
                        <Marker
                            key={d.id}
                            longitude={d.longitude}
                            latitude={d.latitude}
                            anchor={roteiros ? 'bottom' : 'center'}
                        >
                            {roteiros && !roteirosSelect ? (
                                <span
                                    className={[...pinClass, 'rote-map-marker--static']
                                        .filter(Boolean)
                                        .join(' ')}
                                    aria-hidden
                                >
                                    <MaterialIcon name={pinIcon} variant="app" opticalSize={22} filled />
                                </span>
                            ) : roteiros && roteirosSelect ? (
                                <button
                                    type="button"
                                    className={[...pinClass, 'viagens-place-marker--interactive', 'rote-map-marker--select']
                                        .filter(Boolean)
                                        .join(' ')}
                                    aria-label={`Selecionar ${label}`}
                                    aria-pressed={pinPopoverId === d.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onFocusDest?.(d.id);
                                    }}
                                >
                                    <MaterialIcon name={pinIcon} variant="app" opticalSize={22} filled />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="viagens-place-marker viagens-place-marker--interactive"
                                    aria-label={`Ir para ${label}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onFocusDest?.(d.id);
                                    }}
                                >
                                    <ViagensPlaceBadge name={label} />
                                </button>
                            )}
                        </Marker>
                    );
                })}
            </Map>
        </div>
    );
}