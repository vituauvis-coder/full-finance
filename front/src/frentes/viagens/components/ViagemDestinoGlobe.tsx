import type { Map as MapLibreMap } from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/maplibre';
import { routeStops } from '@motor/viagens/trip-places.js';
import { VIAGENS_GLOBE, VIAGENS_HOME } from '@motor/viagens/viagens-atlas.js';
import type { Trip, TripDestination, TripPayload, TripStatus } from '../types';
import { applyMapRoutePaint, bindMapRoutePaint, mapRoutePaint } from '../utils/map-route-paint';
import { flightRoutesForMap } from '../utils/map-routes';
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
import { ViagensPlaceBadge } from './ViagensPlaceBadge';
import { mapAirportBadgeLabel } from '../utils/map-utils';
import 'maplibre-gl/dist/maplibre-gl.css';

ensureMapLibreWorker();

const GLOBE_ZOOM = 2.85;

type Props = {
    destinations: TripDestination[];
    tripPayload?: TripPayload;
    status?: TripStatus;
    onTapCoord?: (lat: number, lng: number) => void;
};

export function ViagemDestinoGlobe({ destinations, tripPayload, status = 'planejada', onTapCoord }: Props) {
    const mapRef = useRef<MapRef>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const tunedRef = useRef(false);
    const [mapStyle] = useState(() => mapStyleForAtlasView('globe'));
    const [sunOverlay] = useState(() => realtimeSunSnapshot());
    const stops = useMemo(() => routeStops(destinations), [destinations]);

    const routeLegs = useMemo(() => {
        if (tripPayload?.flight_segments?.length || tripPayload?.flightSegments?.length) {
            const trip = { id: 'local', payload: tripPayload } as Trip;
            return flightRoutesForMap([trip], []);
        }
        const coords: [number, number][] = [[VIAGENS_HOME.longitude, VIAGENS_HOME.latitude]];
        for (const d of stops) coords.push([d.longitude, d.latitude]);
        if (stops.length > 0) coords.push([VIAGENS_HOME.longitude, VIAGENS_HOME.latitude]);
        const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
        for (let i = 0; i < coords.length - 1; i++) {
            features.push({
                type: 'Feature',
                properties: { leg: 'ida' },
                geometry: { type: 'LineString', coordinates: [coords[i], coords[i + 1]] }
            });
        }
        return {
            ida: { type: 'FeatureCollection' as const, features },
            volta: { type: 'FeatureCollection' as const, features: [] }
        };
    }, [stops, tripPayload]);

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
        applyMapRoutePaint(map, 'destino');
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

    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map) return;
        return bindMapRoutePaint(map, 'destino');
    }, [routeLegs, mapStyle]);

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
                {routeLegs.ida.features.length > 0 ? (
                    <Source id="destino-routes-ida" type="geojson" data={routeLegs.ida}>
                        <Layer
                            id="destino-routes-ida-glow"
                            type="line"
                            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                            paint={mapRoutePaint.idaGlow}
                        />
                        <Layer
                            id="destino-routes-ida-core"
                            type="line"
                            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                            paint={mapRoutePaint.idaCore}
                        />
                    </Source>
                ) : null}
                {routeLegs.volta.features.length > 0 ? (
                    <Source id="destino-routes-volta" type="geojson" data={routeLegs.volta}>
                        <Layer
                            id="destino-routes-volta-glow"
                            type="line"
                            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                            paint={mapRoutePaint.voltaGlow}
                        />
                        <Layer
                            id="destino-routes-volta-core"
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
                {stops.map((d) => (
                    <Marker key={d.id} longitude={d.longitude} latitude={d.latitude} anchor="center">
                        <ViagensPlaceBadge name={mapAirportBadgeLabel(d.name)} />
                    </Marker>
                ))}
            </Map>
        </div>
    );
}