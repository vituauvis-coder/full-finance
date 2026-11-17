import type { Map as MapLibreMap } from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/maplibre';
import { routeStops } from '@motor/viagens/trip-places.js';
import { VIAGENS_GLOBE, VIAGENS_HOME } from '@motor/viagens/viagens-atlas.js';
import type { TripDestination, TripStatus } from '../types';
import {
    applyGlobeRealisticEarth,
    bindAtlasStyleTuning,
    ensureMapLibreWorker,
    GLOBE_EARTH_RASTER_TILES,
    GLOBE_SPACE_SKY,
    mapStyleForAtlasView,
    scheduleMapResize
} from '../utils/maplibre-setup';
import { realtimeSunSnapshot } from '../utils/realtimeSun';
import { GLOBE_RASTER_BEFORE_ID } from '../utils/nightShadeImage';
import { ViagensPin } from './ViagensPin';
import 'maplibre-gl/dist/maplibre-gl.css';

ensureMapLibreWorker();

const GLOBE_ZOOM = 2.85;

type Props = {
    destinations: TripDestination[];
    status?: TripStatus;
    onTapCoord?: (lat: number, lng: number) => void;
};

export function ViagemDestinoGlobe({ destinations, status = 'planejada', onTapCoord }: Props) {
    const mapRef = useRef<MapRef>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const tunedRef = useRef(false);
    const [mapStyle] = useState(() => mapStyleForAtlasView('globe'));
    const [sunOverlay] = useState(() => realtimeSunSnapshot());
    const stops = useMemo(() => routeStops(destinations), [destinations]);

    const hopGeo = useMemo(() => {
        const coords: [number, number][] = [[VIAGENS_HOME.longitude, VIAGENS_HOME.latitude]];
        for (const d of stops) coords.push([d.longitude, d.latitude]);
        if (stops.length > 0) coords.push([VIAGENS_HOME.longitude, VIAGENS_HOME.latitude]);
        const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
        for (let i = 0; i < coords.length - 1; i++) {
            features.push({
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: [coords[i], coords[i + 1]] }
            });
        }
        return { type: 'FeatureCollection' as const, features };
    }, [stops]);

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

    const handleLoad = useCallback(() => {
        const map = mapRef.current?.getMap();
        if (!map) return;
        map.setProjection?.({ type: 'globe' });
        applyGlobeRealisticEarth(map);
        if (!tunedRef.current) {
            tunedRef.current = true;
            bindAtlasStyleTuning(map, () => 'globe');
        }
        scheduleMapResize(map);
    }, []);

    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map || stops.length === 0) return;
        const lat = stops.reduce((s, d) => s + d.latitude, 0) / stops.length;
        const lng = stops.reduce((s, d) => s + d.longitude, 0) / stops.length;
        map.flyTo({
            center: [lng, lat],
            zoom: stops.length === 1 ? 4.2 : 3.4,
            duration: 900,
            essential: true
        });
    }, [stops]);

  const onMapClick = useCallback(
        (ev: { lngLat: { lat: number; lng: number } }) => {
            onTapCoord?.(ev.lngLat.lat, ev.lngLat.lng);
        },
        [onTapCoord]
    );

    const bindMove = useCallback((map: MapLibreMap) => {
        const run = () => scheduleMapResize(map);
        map.on('moveend', run);
    }, []);

    return (
        <div ref={frameRef} className="viagens-destino-globe" aria-label="Globo — escolha o destino">
            <Map
                ref={mapRef}
                initialViewState={{
                    longitude: VIAGENS_GLOBE.longitude,
                    latitude: VIAGENS_GLOBE.latitude,
                    zoom: GLOBE_ZOOM
                }}
                projection={{ type: 'globe' }}
                sky={GLOBE_SPACE_SKY}
                light={sunOverlay.light}
                mapStyle={mapStyle}
                style={{ width: '100%', height: '100%' }}
                attributionControl={false}
                fadeDuration={0}
                onLoad={() => {
                    handleLoad();
                    const map = mapRef.current?.getMap();
                    if (map) bindMove(map);
                }}
                onClick={(e) => onMapClick({ lngLat: e.lngLat })}
                cursor={onTapCoord ? 'crosshair' : 'default'}
            >
                <NavigationControl position="top-left" showCompass={false} />
                <Source
                    id="destino-earth-raster"
                    type="raster"
                    tiles={GLOBE_EARTH_RASTER_TILES}
                    tileSize={256}
                    attribution="© Esri"
                >
                    <Layer
                        id="destino-earth-raster-layer"
                        type="raster"
                        beforeId={GLOBE_RASTER_BEFORE_ID}
                        paint={{ 'raster-opacity': 1, 'raster-fade-duration': 0 }}
                    />
                </Source>
                {hopGeo.features.length > 0 ? (
                    <Source id="destino-routes" type="geojson" data={hopGeo}>
                        <Layer
                            id="destino-routes-line"
                            type="line"
                            paint={{
                                'line-color': 'rgba(46, 196, 182, 0.95)',
                                'line-width': 2.5,
                                'line-dasharray': [1.6, 1.1]
                            }}
                        />
                    </Source>
                ) : null}
                <Marker longitude={VIAGENS_HOME.longitude} latitude={VIAGENS_HOME.latitude} anchor="center">
                    <span className="viagens-home-badge__icon" title="Recife">
                        🧳
                    </span>
                </Marker>
                {stops.map((d, i) => (
                    <Marker key={d.id} longitude={d.longitude} latitude={d.latitude} anchor="bottom">
                        <ViagensPin status={status} size="sm" index={i} isPrincipal={d.isPrincipal} />
                    </Marker>
                ))}
            </Map>
        </div>
    );
}