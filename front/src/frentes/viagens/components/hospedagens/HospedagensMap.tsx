import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/maplibre';
import { chosenArrivalAirports } from '@motor/viagens/stay-logistics.js';
import type { TripDestination, TripPayload, TripStay } from '../../types';
import {
    applyHospedagensImageryTheme,
    bindHospedagensStreetView,
    CARTO_DARK,
    CARTO_LIGHT,
    ensureMapLibreWorker,
    GLOBE_EARTH_RASTER_TILES,
    HOSP_ESRI_HILLSHADE_TILES,
    HOSP_STREET_SKY,
    mapStyleForHospedagens,
    readHospedagensBasemap,
    scheduleMapResize,
    writeHospedagensBasemap,
    type HospedagensBasemap
} from '../../utils/maplibre-setup';
import { applyRealtimeSunToMap, realtimeSunSnapshot } from '../../utils/realtimeSun';
import { pickPlaceDisplayName } from '../../utils/place-display';
import { ViagensPlaceBadge } from '../ViagensPlaceBadge';
import 'maplibre-gl/dist/maplibre-gl.css';

ensureMapLibreWorker();

const STREET_ZOOM_DEST = 15;
const STREET_ZOOM_FOCUS = 18;
const STREET_PITCH_AREA = 42;
const STREET_PITCH_FOCUS = 58;
const HOSP_RASTER_BEFORE = 'landcover';

type Props = {
    payload: TripPayload;
    destinations: TripDestination[];
    stays: TripStay[];
    focusStayId?: string | null;
    onTapCoord?: (lat: number, lng: number) => void;
};

function stayLatLng(stay: TripStay) {
    const lat = stay.latitude ?? stay.lat;
    const lng = stay.longitude ?? stay.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat: lat as number, lng: lng as number };
}

export function HospedagensMap({ payload, destinations, stays, focusStayId, onTapCoord }: Props) {
    const mapRef = useRef<MapRef>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const basemapRef = useRef<HospedagensBasemap>(readHospedagensBasemap());
    const [mapReady, setMapReady] = useState(false);
    const [basemap, setBasemap] = useState<HospedagensBasemap>(() => readHospedagensBasemap());
    const [mapStyle, setMapStyle] = useState(() => mapStyleForHospedagens(readHospedagensBasemap()));
    const sunLight = useMemo(() => realtimeSunSnapshot().light, []);
    const airports = useMemo(() => chosenArrivalAirports({ payload }), [payload]);

    const markers = useMemo(() => {
        return stays
            .map((s) => {
                const pt = stayLatLng(s);
                if (!pt) return null;
                const name =
                    pickPlaceDisplayName({ name: s.name, countryName: s.country ?? s.city }) || 'Hospedagem';
                return { id: s.id, name, ...pt };
            })
            .filter(Boolean) as { id: string; name: string; lat: number; lng: number }[];
    }, [stays]);

    const defaultView = useMemo(() => {
        if (markers.length) {
            const lat = markers.reduce((s, m) => s + m.lat, 0) / markers.length;
            const lng = markers.reduce((s, m) => s + m.lng, 0) / markers.length;
            return {
                lng,
                lat,
                zoom: markers.length === 1 ? STREET_ZOOM_FOCUS - 1 : STREET_ZOOM_DEST
            };
        }
        if (destinations.length) {
            const lat = destinations.reduce((s, d) => s + d.latitude, 0) / destinations.length;
            const lng = destinations.reduce((s, d) => s + d.longitude, 0) / destinations.length;
            return { lng, lat, zoom: STREET_ZOOM_DEST };
        }
        if (airports[0]) return { lng: airports[0].lng, lat: airports[0].lat, zoom: STREET_ZOOM_DEST };
        return { lng: -34.87, lat: -8.05, zoom: 12 };
    }, [markers, destinations, airports]);

    useEffect(() => {
        basemapRef.current = basemap;
    }, [basemap]);

    useEffect(() => {
        const sync = () => {
            setMapStyle(mapStyleForHospedagens(basemap));
            const map = mapRef.current?.getMap();
            if (map && mapReady) {
                bindHospedagensStreetView(map, () => basemapRef.current);
                applyHospedagensImageryTheme(map, basemapRef.current);
            }
        };
        sync();
        const obs = new MutationObserver(sync);
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => obs.disconnect();
    }, [basemap, mapReady]);

    const setBasemapMode = useCallback((mode: HospedagensBasemap) => {
        writeHospedagensBasemap(mode);
        setBasemap(mode);
        setMapStyle(mapStyleForHospedagens(mode));
    }, []);

    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map || !mapReady) return;
        bindHospedagensStreetView(map, () => basemapRef.current);
    }, [basemap, mapReady, mapStyle]);

    const bindResize = useCallback(() => {
        const map = mapRef.current?.getMap();
        if (map) scheduleMapResize(map);
    }, []);

    useEffect(() => {
        const el = frameRef.current;
        if (!el || !mapReady) return;
        bindResize();
        const ro = new ResizeObserver(() => bindResize());
        ro.observe(el);
        return () => ro.disconnect();
    }, [mapReady, bindResize]);

    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map || !mapReady) return;
        const focus = focusStayId ? markers.find((m) => m.id === focusStayId) : null;
        if (basemapRef.current === 'real') applyRealtimeSunToMap(map);
        if (focus) {
            map.flyTo({
                center: [focus.lng, focus.lat],
                zoom: STREET_ZOOM_FOCUS,
                pitch: STREET_PITCH_FOCUS,
                bearing: basemapRef.current === 'real' ? -12 : 0,
                duration: 900,
                essential: true
            });
            return;
        }
        const areaPitch = markers.length > 0 ? STREET_PITCH_AREA : basemapRef.current === 'real' ? 25 : 0;
        map.flyTo({
            center: [defaultView.lng, defaultView.lat],
            zoom: defaultView.zoom,
            pitch: areaPitch,
            bearing: 0,
            duration: 500
        });
    }, [focusStayId, markers, defaultView, mapReady]);

    const airportGeo = useMemo(() => {
        const features = airports.map((a) => ({
            type: 'Feature' as const,
            properties: { label: a.label },
            geometry: { type: 'Point' as const, coordinates: [a.lng, a.lat] }
        }));
        return { type: 'FeatureCollection' as const, features };
    }, [airports]);

    const destinationGeo = useMemo(() => {
        const features = destinations
            .filter((d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude))
            .map((d) => ({
                type: 'Feature' as const,
                properties: { name: d.name },
                geometry: { type: 'Point' as const, coordinates: [d.longitude, d.latitude] }
            }));
        return { type: 'FeatureCollection' as const, features };
    }, [destinations]);

    const onStyleFallback = useCallback(() => {
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        setMapStyle(dark ? CARTO_DARK : CARTO_LIGHT);
        setBasemap('carto');
        basemapRef.current = 'carto';
    }, []);

    const showSky = basemap === 'real';

    return (
        <div className="hosp-map-frame" ref={frameRef}>
            <div className="hosp-map__basemap" role="group" aria-label="Estilo do mapa">
                <button
                    type="button"
                    className={basemap === 'real' ? 'is-on' : undefined}
                    onClick={() => setBasemapMode('real')}
                >
                    Realista
                </button>
                <button
                    type="button"
                    className={basemap === 'carto' ? 'is-on' : undefined}
                    onClick={() => setBasemapMode('carto')}
                >
                    Ruas
                </button>
                <button
                    type="button"
                    className={basemap === 'osm' ? 'is-on' : undefined}
                    onClick={() => setBasemapMode('osm')}
                >
                    OSM
                </button>
            </div>
            <Map
                ref={mapRef}
                initialViewState={{
                    longitude: defaultView.lng,
                    latitude: defaultView.lat,
                    zoom: defaultView.zoom,
                    pitch: 0,
                    bearing: 0
                }}
                mapStyle={mapStyle}
                style={{ position: 'absolute', inset: 0 }}
                sky={showSky ? HOSP_STREET_SKY : undefined}
                light={showSky ? sunLight : undefined}
                antialias
                attributionControl={{ compact: true }}
                reuseMaps
                onLoad={() => {
                    const map = mapRef.current?.getMap();
                    if (!map) return;
                    bindHospedagensStreetView(map, () => basemapRef.current);
                    scheduleMapResize(map);
                    setMapReady(true);
                }}
                onError={onStyleFallback}
                onClick={(e) => onTapCoord?.(e.lngLat.lat, e.lngLat.lng)}
                cursor={onTapCoord ? 'crosshair' : 'default'}
            >
                <NavigationControl position="top-right" showCompass visualizePitch />
                {basemap === 'real' ? (
                    <>
                        <Source
                            id="hosp-earth"
                            type="raster"
                            tiles={GLOBE_EARTH_RASTER_TILES}
                            tileSize={256}
                            attribution="© Esri · World Imagery"
                        >
                            <Layer
                                id="hosp-earth-layer"
                                type="raster"
                                beforeId={HOSP_RASTER_BEFORE}
                                paint={{
                                    'raster-opacity': 1,
                                    'raster-fade-duration': 0,
                                    'raster-saturation': 0.05
                                }}
                            />
                        </Source>
                        <Source
                            id="hosp-hillshade"
                            type="raster"
                            tiles={HOSP_ESRI_HILLSHADE_TILES}
                            tileSize={256}
                            attribution="© Esri · Hillshade"
                        >
                            <Layer
                                id="hosp-hillshade-layer"
                                type="raster"
                                beforeId={HOSP_RASTER_BEFORE}
                                paint={{ 'raster-opacity': 0.42, 'raster-fade-duration': 0 }}
                            />
                        </Source>
                    </>
                ) : null}
                {destinationGeo.features.length > 0 ? (
                    <Source id="hosp-destinations" type="geojson" data={destinationGeo}>
                        <Layer
                            id="hosp-destinations-circle"
                            type="circle"
                            paint={{
                                'circle-radius': 10,
                                'circle-color': 'rgba(242, 201, 76, 0.2)',
                                'circle-stroke-width': 2,
                                'circle-stroke-color': 'rgba(242, 201, 76, 0.85)'
                            }}
                        />
                    </Source>
                ) : null}
                {airportGeo.features.length > 0 ? (
                    <Source id="hosp-airports" type="geojson" data={airportGeo}>
                        <Layer
                            id="hosp-airports-ring"
                            type="circle"
                            paint={{
                                'circle-radius': 16,
                                'circle-color': 'rgba(46, 196, 182, 0.12)',
                                'circle-stroke-width': 2,
                                'circle-stroke-color': 'rgba(46, 196, 182, 0.75)'
                            }}
                        />
                    </Source>
                ) : null}
                {destinations.map((d) =>
                    Number.isFinite(d.latitude) && Number.isFinite(d.longitude) ? (
                        <Marker key={d.id} longitude={d.longitude} latitude={d.latitude} anchor="center">
                            <span className="hosp-map__dest" title={d.name}>
                                {pickPlaceDisplayName({ name: d.name, countryName: d.country ?? undefined })
                                    .slice(0, 3)
                                    .toUpperCase()}
                            </span>
                        </Marker>
                    ) : null
                )}
                {airports.map((a) => (
                    <Marker key={`${a.iata}-${a.lng}`} longitude={a.lng} latitude={a.lat} anchor="center">
                        <span className="hosp-map__airport" title={a.label}>
                            {a.iata || '✈'}
                        </span>
                    </Marker>
                ))}
                {markers.map((m) => (
                    <Marker key={m.id} longitude={m.lng} latitude={m.lat} anchor="bottom">
                        <ViagensPlaceBadge
                            name={m.name}
                            className={focusStayId === m.id ? 'hosp-map__stay--focus' : undefined}
                        />
                    </Marker>
                ))}
            </Map>
        </div>
    );
}