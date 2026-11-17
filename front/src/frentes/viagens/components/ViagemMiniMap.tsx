import { useCallback, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, Source, type MapRef } from 'react-map-gl/maplibre';
import { routeStops } from '@motor/viagens/trip-places.js';
import { VIAGENS_HOME } from '@motor/viagens/viagens-atlas.js';
import type { TripDestination, TripStatus } from '../types';
import { bindMapLabelsPtBr, ensureMapLibreWorker, mapStyleForTheme } from '../utils/maplibre-setup';
import { ViagensPin } from './ViagensPin';
import 'maplibre-gl/dist/maplibre-gl.css';

ensureMapLibreWorker();

type Props = {
    destinations: TripDestination[];
    status?: TripStatus;
    onTapCoord?: (lat: number, lng: number) => void;
};

export function ViagemMiniMap({ destinations, status = 'planejada', onTapCoord }: Props) {
    const mapRef = useRef<MapRef>(null);
    const labelsBoundRef = useRef(false);
    const [mapStyle] = useState(mapStyleForTheme);
    const stops = useMemo(() => routeStops(destinations), [destinations]);

    const hopGeo = useMemo(() => {
        const coords: [number, number][] = [[VIAGENS_HOME.longitude, VIAGENS_HOME.latitude]];
        for (const d of stops) coords.push([d.longitude, d.latitude]);
        coords.push([VIAGENS_HOME.longitude, VIAGENS_HOME.latitude]);
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

    const center = useMemo(() => {
        if (!stops.length) return { lng: VIAGENS_HOME.longitude, lat: VIAGENS_HOME.latitude, zoom: 3 };
        const lat = stops.reduce((s, d) => s + d.latitude, 0) / stops.length;
        const lng = stops.reduce((s, d) => s + d.longitude, 0) / stops.length;
        return { lng, lat, zoom: stops.length === 1 ? 5 : 4 };
    }, [stops]);

    const onMapClick = useCallback(
        (ev: { lngLat: { lat: number; lng: number } }) => {
            onTapCoord?.(ev.lngLat.lat, ev.lngLat.lng);
        },
        [onTapCoord]
    );

    return (
        <div className="viagens-mini-map" aria-label="Mini-mapa da viagem">
            <Map
                ref={mapRef}
                initialViewState={{ ...center, zoom: center.zoom }}
                mapStyle={mapStyle}
                style={{ width: '100%', height: '100%' }}
                attributionControl={false}
                onLoad={() => {
                    const map = mapRef.current?.getMap();
                    if (!map || labelsBoundRef.current) return;
                    labelsBoundRef.current = true;
                    bindMapLabelsPtBr(map);
                }}
                onClick={(e) => onMapClick({ lngLat: e.lngLat })}
                cursor={onTapCoord ? 'crosshair' : 'default'}
            >
                <Source id="mini-routes" type="geojson" data={hopGeo}>
                    <Layer
                        id="mini-routes-line"
                        type="line"
                        paint={{ 'line-color': 'rgba(46, 196, 182, 1)', 'line-width': 2, 'line-dasharray': [1.8, 1.2] }}
                    />
                </Source>
                <Marker longitude={VIAGENS_HOME.longitude} latitude={VIAGENS_HOME.latitude} anchor="center">
                    <span className="viagens-home-badge__icon">🧳</span>
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