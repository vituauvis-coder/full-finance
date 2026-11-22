import type { Map as MapLibreMap } from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import Map, { type MapRef } from 'react-map-gl/maplibre';
import { VIAGENS_GLOBE } from '@motor/viagens/viagens-atlas.js';
import type { MapVisit, Trip } from '../types';
import { applyMapRoutePaint, bindMapRoutePaint } from '../utils/map-route-paint';
import {
    loadViagensMapView,
    persistViagensMapView,
    projectionForView,
    type ViagensMapView
} from '../domain/viagensMapView';
import {
    loadViagensMapLayers,
    persistViagensMapLayers,
    type ViagensMapLayersState
} from '../domain/viagensMapLayers';
import {
    applyGlobeRealisticEarth,
    bindAtlasStyleTuning,
    ensureMapLibreWorker,
    GLOBE_SPACE_SKY,
    mapStyleForAtlasView,
    scheduleMapResize,
    syncAtlasMapLayerStack
} from '../utils/maplibre-setup';
import { useAtlasCountryHighlights } from '../hooks/useAtlasCountryHighlights';
import { useAtlasGlobeSun } from '../hooks/useAtlasGlobeSun';
import { useAtlasMapModel } from '../hooks/useAtlasMapModel';
import { AtlasMapRouteLayers } from './atlas-map/AtlasMapRouteLayers';
import { ViagensMapGlobeLayers } from './atlas-map/ViagensMapGlobeLayers';
import { ViagensMapHud } from './atlas-map/ViagensMapHud';
import { ViagensMapMarkers } from './atlas-map/ViagensMapMarkers';
import 'maplibre-gl/dist/maplibre-gl.css';

ensureMapLibreWorker();

const VIEW_ZOOM: Record<ViagensMapView, number> = {
    flat: 1.85,
    globe: 2.85
};

type Props = {
    trips: Trip[];
    visits: MapVisit[];
    onOpenTrip: (tripId: string) => void;
    focusedTripId?: string | null;
    onFocusedTripIdChange?: (tripId: string | null) => void;
};

type HoverState = {
    pinKey: string;
    visit: MapVisit | null;
    tripId: string;
};

export function ViagensMap({
    trips,
    visits,
    onOpenTrip,
    focusedTripId = null,
    onFocusedTripIdChange
}: Props) {
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
    const [hoveredCluster, setHoveredCluster] = useState<number | null>(null);
    const [mapLayers, setMapLayers] = useState<ViagensMapLayersState>(() => loadViagensMapLayers());

    const { routeLegs, hasRoteiroLayers, clusters, renderPins, tripsById, highlightCountryLabels } =
        useAtlasMapModel(trips, visits, spanLat);
    const countryGeo = useAtlasCountryHighlights(highlightCountryLabels);
    const { sunOverlay, nightShadeUrl, refreshAtlasSun } = useAtlasGlobeSun(mapRef);

    const handleMapLayersChange = useCallback((next: ViagensMapLayersState) => {
        setMapLayers(next);
        persistViagensMapLayers(next);
    }, []);

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

    const flyToAtlasHome = useCallback((view: ViagensMapView = mapViewRef.current) => {
        const map = mapRef.current?.getMap();
        if (!map) return;
        map.flyTo({
            center: [VIAGENS_GLOBE.longitude, VIAGENS_GLOBE.latitude],
            zoom: VIEW_ZOOM[view],
            bearing: 0,
            pitch: 0,
            duration: 700,
            essential: true
        });
        scheduleMapResize(map);
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

    const applyMapView = useCallback(
        (view: ViagensMapView) => {
            const map = mapRef.current?.getMap();
            if (!map) return;
            map.setProjection?.({ type: projectionForView(view) });
            applyGlobeRealisticEarth(map);
            void refreshAtlasSun();
            flyToAtlasHome(view);
        },
        [flyToAtlasHome, refreshAtlasSun]
    );

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
        onFocusedTripIdChange?.(null);
    }, [spanLat, onFocusedTripIdChange]);

    const focusTrip = useCallback(
        (tripId: string | null) => {
            onFocusedTripIdChange?.(tripId);
        },
        [onFocusedTripIdChange]
    );

    const activatePin = useCallback(
        (pinKey: string, tripId: string, visit: MapVisit | null) => {
            setHovered({ pinKey, tripId, visit });
            focusTrip(tripId);
        },
        [focusTrip]
    );

    const deactivatePin = useCallback(
        (pinKey: string) => {
            setHovered((h) => (h?.pinKey === pinKey ? null : h));
            focusTrip(null);
        },
        [focusTrip]
    );

    const handleZoomIn = useCallback(() => {
        mapRef.current?.getMap()?.zoomIn({ duration: 250 });
    }, []);

    const handleZoomOut = useCallback(() => {
        mapRef.current?.getMap()?.zoomOut({ duration: 250 });
    }, []);

    return (
        <div
            ref={frameRef}
            className={`viagens-map-frame${mapView === 'globe' ? ' viagens-map-frame--globe' : ''}`}
            aria-label="Mapa de viagens"
        >
            {mapView === 'globe' ? <div className="viagens-map-frame__space" aria-hidden /> : null}
            <div className="viagens-map-frame__wash" aria-hidden="true" />
            <ViagensMapHud
                mapView={mapView}
                onMapViewChange={handleMapViewChange}
                mapLayers={mapLayers}
                onMapLayersChange={handleMapLayersChange}
                hasRoteiro={hasRoteiroLayers}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onOrientReset={() => flyToAtlasHome()}
            />
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
                <ViagensMapGlobeLayers
                    nightShadeUrl={nightShadeUrl}
                    countryGeo={countryGeo}
                    showCountries={mapLayers.countries}
                />
                <AtlasMapRouteLayers
                    idPrefix="viagens"
                    routeLegs={routeLegs}
                    visibility={{
                        flights: mapLayers.flights,
                        roteiro: mapLayers.roteiro
                    }}
                />
                <ViagensMapMarkers
                    clusters={clusters}
                    hoveredCluster={hoveredCluster}
                    onClusterHover={setHoveredCluster}
                    onZoomCluster={zoomToCluster}
                    pins={renderPins}
                    hovered={hovered}
                    tripsById={tripsById}
                    focusedTripId={focusedTripId}
                    onOpenTrip={onOpenTrip}
                    onActivatePin={activatePin}
                    onDeactivatePin={deactivatePin}
                />
            </Map>
        </div>
    );
}