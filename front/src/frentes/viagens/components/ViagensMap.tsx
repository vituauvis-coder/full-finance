import type { Map as MapLibreMap } from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/maplibre';
import { cluster as clusterVisits } from '@motor/viagens/trips-engine.js';
import { VIAGENS_GLOBE, VIAGENS_HOME } from '@motor/viagens/viagens-atlas.js';
import type { MapVisit, Trip } from '../types';
import { displayCoordinate, mapAirportBadgeLabel } from '../utils/map-utils';
import { resolveTripCountries } from '@motor/viagens/trip-countries.js';
import { flightArrivalPoints } from '@motor/viagens/flight-route-geo.js';
import { buildCountryHighlightCollection } from '../utils/countryHighlightsGeo';
import { applyMapRoutePaint, bindMapRoutePaint, mapRoutePaint } from '../utils/map-route-paint';
import { flightRoutesForMap } from '../utils/map-routes';
import {
    loadViagensMapView,
    persistViagensMapView,
    projectionForView,
    type ViagensMapView
} from '../domain/viagensMapView';
import {
    applyGlobeRealisticEarth,
    applyGlobeVectorEarthColors,
    bindAtlasStyleTuning,
    ensureMapLibreWorker,
    GLOBE_EARTH_RASTER_TILES,
    GLOBE_SPACE_SKY,
    mapStyleForAtlasView,
    scheduleMapResize,
    syncAtlasMapLayerStack
} from '../utils/maplibre-setup';
import { applyRealtimeSunToMap, realtimeSunSnapshot, type RealtimeSunSnapshot } from '../utils/realtimeSun';
import {
    createNightShadeObjectUrl,
    GLOBE_RASTER_BEFORE_ID,
    NIGHT_SHADE_IMAGE_COORDINATES,
    revokeNightShadeObjectUrl
} from '../utils/nightShadeImage';

const SUN_REFRESH_MS = 60_000;

ensureMapLibreWorker();
import { HoverTicket } from './HoverTicket';
import { ViagensMapViewToggle } from './ViagensMapViewToggle';
import { ViagensPlaceBadge } from './ViagensPlaceBadge';
import 'maplibre-gl/dist/maplibre-gl.css';

const VIEW_ZOOM: Record<ViagensMapView, number> = {
    flat: 1.85,
    globe: 2.85
};

type Props = {
    trips: Trip[];
    visits: MapVisit[];
    onOpenTrip: (tripId: string) => void;
};

type HoverState = {
    visit: MapVisit;
};

export function ViagensMap({ trips, visits, onOpenTrip }: Props) {
    const mapRef = useRef<MapRef>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const styleFallbackRef = useRef(false);
    const moveBoundRef = useRef(false);
    const mapViewRef = useRef<ViagensMapView>(loadViagensMapView());
    const [mapView, setMapView] = useState<ViagensMapView>(() => loadViagensMapView());
    const [mapStyle, setMapStyle] = useState(() => mapStyleForAtlasView(loadViagensMapView()));
    mapViewRef.current = mapView;
    const [spanLat, setSpanLat] = useState(VIAGENS_GLOBE.latitudeDelta);
    const [hovered, setHovered] = useState<HoverState | null>(null);
    const [sunOverlay, setSunOverlay] = useState<RealtimeSunSnapshot>(() => realtimeSunSnapshot());
    const [nightShadeUrl, setNightShadeUrl] = useState<string | null>(null);
    const nightShadeUrlRef = useRef<string | null>(null);

    const routeLegs = useMemo(() => flightRoutesForMap(trips, visits), [trips, visits]);

    const highlightCountryLabels = useMemo(() => {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const trip of trips) {
            for (const c of resolveTripCountries(trip.payload, trip.payload?.destinations ?? [])) {
                const k = c.toLowerCase();
                if (seen.has(k)) continue;
                seen.add(k);
                out.push(c);
            }
        }
        return out;
    }, [trips]);

    const [countryGeo, setCountryGeo] = useState<GeoJSON.FeatureCollection>(() => ({
        type: 'FeatureCollection',
        features: []
    }));

    useEffect(() => {
        let cancelled = false;
        void buildCountryHighlightCollection(highlightCountryLabels).then((geo) => {
            if (!cancelled) setCountryGeo(geo);
        });
        return () => {
            cancelled = true;
        };
    }, [highlightCountryLabels]);

    const clusters = useMemo(() => clusterVisits(visits, spanLat), [visits, spanLat]);

    useEffect(() => {
        const root = document.documentElement;
        const syncTheme = () => setMapStyle(mapStyleForAtlasView(mapViewRef.current));
        const obs = new MutationObserver(syncTheme);
        obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
        return () => obs.disconnect();
    }, []);

    useEffect(() => {
        const el = frameRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => {
            const map = mapRef.current?.getMap();
            if (map) scheduleMapResize(map);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const refreshAtlasSun = useCallback(async () => {
        const snap = realtimeSunSnapshot();
        setSunOverlay(snap);
        const url = await createNightShadeObjectUrl(new Date());
        revokeNightShadeObjectUrl(nightShadeUrlRef.current ?? undefined);
        nightShadeUrlRef.current = url;
        setNightShadeUrl(url);
        const map = mapRef.current?.getMap();
        if (!map?.isStyleLoaded()) return;
        applyRealtimeSunToMap(map, snap);
        const src = map.getSource('viagens-night-shade') as
            | { updateImage?: (spec: { url: string; coordinates: [number, number][] }) => void }
            | undefined;
        if (src?.updateImage) {
            src.updateImage({ url, coordinates: NIGHT_SHADE_IMAGE_COORDINATES });
        }
        applyGlobeVectorEarthColors(map);
        syncAtlasMapLayerStack(map);
    }, []);

    useEffect(() => {
        void refreshAtlasSun();
        const timer = window.setInterval(() => void refreshAtlasSun(), SUN_REFRESH_MS);
        return () => {
            window.clearInterval(timer);
            revokeNightShadeObjectUrl(nightShadeUrlRef.current ?? undefined);
            nightShadeUrlRef.current = null;
        };
    }, [refreshAtlasSun]);

    useEffect(() => {
        if (!nightShadeUrl) return;
        const map = mapRef.current?.getMap();
        if (!map) return;
        const fixOrder = () => syncAtlasMapLayerStack(map);
        if (map.isStyleLoaded()) fixOrder();
        map.on('idle', fixOrder);
        return () => map.off('idle', fixOrder);
    }, [nightShadeUrl, mapStyle, mapView]);

    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map) return;
        return bindMapRoutePaint(map, 'viagens');
    }, [routeLegs, mapStyle]);

    const bindMap = useCallback((map: MapLibreMap) => {
        map.on('moveend', () => {
            const b = map.getBounds();
            const latSpan = Math.abs(b.getNorth() - b.getSouth());
            setSpanLat((prev) => (Math.abs(prev - latSpan) > 0.01 ? latSpan : prev));
        });
    }, []);

    const handleLoad = useCallback(() => {
        const map = mapRef.current?.getMap();
        if (!map) return;
        if (!moveBoundRef.current) {
            moveBoundRef.current = true;
            bindMap(map);
            bindAtlasStyleTuning(map, () => mapViewRef.current);
        }
        map.setProjection?.({ type: projectionForView(mapView) });
        applyGlobeRealisticEarth(map);
        void refreshAtlasSun();
        scheduleMapResize(map);
        applyMapRoutePaint(map, 'viagens');
    }, [bindMap, mapView, refreshAtlasSun]);

    const applyMapView = useCallback((view: ViagensMapView) => {
        const map = mapRef.current?.getMap();
        if (!map) return;
        const projection = projectionForView(view);
        map.setProjection?.({ type: projection });
        applyGlobeRealisticEarth(map);
        void refreshAtlasSun();
        map.flyTo({
            center: [VIAGENS_GLOBE.longitude, VIAGENS_GLOBE.latitude],
            zoom: VIEW_ZOOM[view],
            duration: 700,
            essential: true
        });
        scheduleMapResize(map);
    }, [refreshAtlasSun]);

    const handleMapViewChange = useCallback(
        (view: ViagensMapView) => {
            setMapView(view);
            mapViewRef.current = view;
            persistViagensMapView(view);
            setMapStyle(mapStyleForAtlasView(view));
            applyMapView(view);
        },
        [applyMapView]
    );

    const handleError = useCallback((e: { error?: Error }) => {
        const msg = String(e.error?.message ?? '');
        if (msg.includes('sprite')) return;
        if (styleFallbackRef.current) return;
        styleFallbackRef.current = true;
        console.warn('[viagens-map]', e.error ?? e);
    }, []);

    const zoomToCluster = useCallback((latitude: number, longitude: number) => {
        const map = mapRef.current?.getMap();
        if (!map) return;
        const next = Math.max(spanLat * 0.34, 0.3);
        map.flyTo({ center: [longitude, latitude], zoom: map.getZoom() + 1.8, duration: 700 });
        setSpanLat(next);
        setHovered(null);
    }, [spanLat]);

    const singlePins = useMemo(() => {
        const out: { visit: MapVisit; lat: number; lng: number }[] = [];
        clusters.forEach((c) => {
            if (!c || c.visits.length !== 1) return;
            const visit = c.visits[0];
            const coord = displayCoordinate(visit, visits);
            out.push({ visit, lat: coord.lat, lng: coord.lng });
        });
        return out;
    }, [clusters, visits]);

    const visitCoordKeys = useMemo(
        () =>
            new Set(
                visits.map((v) => `${Math.round(v.destination.longitude * 100)}:${Math.round(v.destination.latitude * 100)}`)
            ),
        [visits]
    );

    const flightArrivals = useMemo(() => {
        return flightArrivalPoints(trips).filter((arrival) => {
            const key = `${Math.round(arrival.lng * 100)}:${Math.round(arrival.lat * 100)}`;
            return !visitCoordKeys.has(key);
        });
    }, [trips, visitCoordKeys]);

    return (
        <div
            ref={frameRef}
            className={`viagens-map-frame${mapView === 'globe' ? ' viagens-map-frame--globe' : ''}`}
            aria-label="Mapa de viagens"
        >
            {mapView === 'globe' ? <div className="viagens-map-frame__space" aria-hidden /> : null}
            <div className="viagens-map-frame__wash" aria-hidden="true" />
            <p className="viagens-map-sun-legend" aria-live="polite">
                Satélite Esri · sombra solar ao vivo (1 min)
            </p>
            <ViagensMapViewToggle value={mapView} onChange={handleMapViewChange} />
            <Map
                id="viagens-map-canvas"
                ref={mapRef}
                initialViewState={{
                    longitude: VIAGENS_GLOBE.longitude,
                    latitude: VIAGENS_GLOBE.latitude,
                    zoom: VIEW_ZOOM[mapView]
                }}
                projection={projectionForView(mapView)}
                sky={mapView === 'globe' ? GLOBE_SPACE_SKY : undefined}
                light={mapView === 'globe' ? sunOverlay.light : undefined}
                mapStyle={mapStyle}
                style={{ width: '100%', height: '100%' }}
                attributionControl={false}
                fadeDuration={0}
                onLoad={handleLoad}
                onError={handleError}
            >
                <NavigationControl position="top-left" showCompass={false} />
                <Source
                    id="viagens-earth-raster"
                    type="raster"
                    tiles={GLOBE_EARTH_RASTER_TILES}
                    tileSize={256}
                    attribution="© Esri · World Imagery"
                >
                    <Layer
                        id="viagens-earth-raster-layer"
                        type="raster"
                        beforeId={GLOBE_RASTER_BEFORE_ID}
                        paint={{
                            'raster-opacity': 1,
                            'raster-fade-duration': 0,
                            'raster-saturation': 0
                        }}
                    />
                </Source>
                {nightShadeUrl ? (
                    <Source
                        id="viagens-night-shade"
                        type="image"
                        url={nightShadeUrl}
                        coordinates={NIGHT_SHADE_IMAGE_COORDINATES}
                    >
                        <Layer
                            id="viagens-night-shade-layer"
                            type="raster"
                            beforeId={GLOBE_RASTER_BEFORE_ID}
                            paint={{
                                'raster-opacity': 1,
                                'raster-fade-duration': 0
                            }}
                        />
                    </Source>
                ) : null}
                {countryGeo.features.length > 0 ? (
                    <Source id="viagens-countries" type="geojson" data={countryGeo}>
                        <Layer
                            id="viagens-countries-fill"
                            type="fill"
                            paint={{
                                'fill-color': 'rgba(46, 196, 182, 0.38)',
                                'fill-opacity': 0.42,
                                'fill-outline-color': 'rgba(46, 196, 182, 0.45)'
                            }}
                        />
                    </Source>
                ) : null}
                {routeLegs.ida.features.length > 0 ? (
                    <Source id="viagens-routes-ida" type="geojson" data={routeLegs.ida}>
                        <Layer
                            id="viagens-routes-ida-glow"
                            type="line"
                            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                            paint={mapRoutePaint.idaGlow}
                        />
                        <Layer
                            id="viagens-routes-ida-core"
                            type="line"
                            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                            paint={mapRoutePaint.idaCore}
                        />
                    </Source>
                ) : null}
                {routeLegs.volta.features.length > 0 ? (
                    <Source id="viagens-routes-volta" type="geojson" data={routeLegs.volta}>
                        <Layer
                            id="viagens-routes-volta-glow"
                            type="line"
                            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                            paint={mapRoutePaint.voltaGlow}
                        />
                        <Layer
                            id="viagens-routes-volta-core"
                            type="line"
                            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                            paint={mapRoutePaint.voltaCore}
                        />
                    </Source>
                ) : null}
                <Marker longitude={VIAGENS_HOME.longitude} latitude={VIAGENS_HOME.latitude} anchor="center">
                    <div className="viagens-home-badge">
                        <ViagensPlaceBadge name={VIAGENS_HOME.name} />
                    </div>
                </Marker>
                {clusters.map((c, ci) => {
                    if (!c || c.visits.length === 1) return null;
                    return (
                        <Marker key={`cluster-${ci}`} longitude={c.longitude} latitude={c.latitude} anchor="center">
                            <button
                                type="button"
                                className="viagens-cluster-badge"
                                onClick={() => zoomToCluster(c.latitude, c.longitude)}
                                aria-label={`${c.visits.length} visitas`}
                            >
                                {c.visits.length}
                            </button>
                        </Marker>
                    );
                })}
                {singlePins.map(({ visit, lat, lng }) => {
                    const isHov = hovered?.visit.id === visit.id;
                    const cityName = mapAirportBadgeLabel(visit.destination.name, visit.hover.placeName);
                    return (
                        <Marker key={visit.id} longitude={lng} latitude={lat} anchor="center">
                            <div className="viagens-pin-marker">
                                {isHov ? <HoverTicket hover={visit.hover} /> : null}
                                <button
                                    type="button"
                                    className="viagens-place-marker viagens-place-marker--interactive"
                                    onMouseEnter={() => setHovered({ visit })}
                                    onMouseLeave={() => setHovered((h) => (h?.visit.id === visit.id ? null : h))}
                                    onClick={() => onOpenTrip(visit.tripId)}
                                    aria-label={`${cityName}, ${visit.tripTitle}`}
                                >
                                    <ViagensPlaceBadge name={cityName} />
                                </button>
                            </div>
                        </Marker>
                    );
                })}
                {flightArrivals.map((arrival) => (
                    <Marker
                        key={`${arrival.tripId}-${arrival.lng}-${arrival.lat}-${arrival.label}`}
                        longitude={arrival.lng}
                        latitude={arrival.lat}
                        anchor="center"
                    >
                        <button
                            type="button"
                            className="viagens-place-marker viagens-place-marker--interactive"
                            onClick={() => onOpenTrip(arrival.tripId)}
                            aria-label={`Destino ${arrival.label}`}
                        >
                            <ViagensPlaceBadge name={arrival.label} />
                        </button>
                    </Marker>
                ))}
            </Map>
        </div>
    );
}