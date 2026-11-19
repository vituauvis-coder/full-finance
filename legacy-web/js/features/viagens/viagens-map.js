import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreglWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

maplibregl.setWorkerUrl(maplibreglWorker);
import { cluster as clusterVisits } from '../../../../motor/viagens/trips-engine.js';
import { VIAGENS_GLOBE, VIAGENS_HOME } from '../../../../motor/viagens/viagens-atlas.js';
import { hopLineFeatures } from './map-routes.js';
import { displayCoordinate } from './map-utils.js';
import { renderViagensPinHtml } from './viagens-pin.js';
import { renderHoverTicketHtml } from './hover-ticket.js';

const PT_BR_LABEL_FIELD = ['coalesce', ['get', 'name:pt-BR'], ['get', 'name:pt'], ['get', 'name_pt'], ['get', 'name']];

function applyMapLabelsPtBr(map) {
    for (const layer of map.getStyle()?.layers ?? []) {
        if (layer.type !== 'symbol') continue;
        if (layer.layout?.['text-field'] == null) continue;
        try {
            map.setLayoutProperty(layer.id, 'text-field', PT_BR_LABEL_FIELD);
        } catch {
            /* ignore */
        }
    }
}

const CARTO_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const CARTO_LIGHT = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const DEMO_STYLE = 'https://demotiles.maplibre.org/style.json';

function mapStyleForTheme() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark ? CARTO_DARK : CARTO_LIGHT;
}

let mapInstance = null;

export function destroyViagensMap() {
    if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
    }
}

export function mountViagensMap(container, { trips, visits, onOpenTrip }) {
    destroyViagensMap();
    container.innerHTML = `
        <div class="viagens-map-frame" aria-label="Mapa de viagens">
            <div id="viagens-map-canvas" style="width:100%;height:100%;"></div>
            <div class="viagens-map-frame__wash" aria-hidden="true"></div>
            <div id="viagens-map-overlay" class="viagens-map-overlay"></div>
        </div>`;

    const canvas = container.querySelector('#viagens-map-canvas');
    const overlay = container.querySelector('#viagens-map-overlay');

    mapInstance = new maplibregl.Map({
        container: canvas,
        style: mapStyleForTheme(),
        center: [VIAGENS_GLOBE.longitude, VIAGENS_GLOBE.latitude],
        zoom: 1.85,
        attributionControl: false,
        fadeDuration: 0
    });

    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

    function attachRoutesAndMarkers() {
        const hopGeo = hopLineFeatures(trips, visits);
        if (!mapInstance.getSource('viagens-routes')) {
            mapInstance.addSource('viagens-routes', { type: 'geojson', data: hopGeo });
            mapInstance.addLayer({
                id: 'viagens-routes-line',
                type: 'line',
                source: 'viagens-routes',
                paint: {
                    'line-color': 'rgba(46, 196, 182, 0.85)',
                    'line-width': 1.8,
                    'line-dasharray': [2, 1.5]
                }
            });
        } else {
            mapInstance.getSource('viagens-routes').setData(hopGeo);
        }
        renderMarkers(overlay, visits, onOpenTrip, mapInstance, VIAGENS_GLOBE.latitudeDelta);
        scheduleMapResize(mapInstance);
    }

    mapInstance.on('style.load', () => applyMapLabelsPtBr(mapInstance));
    mapInstance.on('load', attachRoutesAndMarkers);

    mapInstance.on('error', (e) => {
        const msg = String(e?.error?.message ?? e?.message ?? '');
        if (msg.includes('sprite')) return;
        if (mapInstance._viagensStyleFallback) return;
        console.warn('[viagens-map]', e?.error ?? e);
        mapInstance._viagensStyleFallback = true;
        mapInstance.setStyle(DEMO_STYLE);
    });
}

function scheduleMapResize(map) {
    const run = () => {
        try {
            map.resize();
        } catch {
            /* ignore */
        }
    };
    requestAnimationFrame(run);
    setTimeout(run, 120);
    setTimeout(run, 400);
}

function renderMarkers(overlay, visits, onOpenTrip, map, spanLat = VIAGENS_GLOBE.latitudeDelta) {
    if (!map) return;
    const clusters = clusterVisits(visits, spanLat);
    overlay.innerHTML = '';

    const homeEl = document.createElement('div');
    homeEl.className = 'viagens-home-badge';
    homeEl.innerHTML = `
        <span class="viagens-home-badge__label">${VIAGENS_HOME.name}</span>`;
    const homeMarker = new maplibregl.Marker({ element: homeEl, anchor: 'center' })
        .setLngLat([VIAGENS_HOME.longitude, VIAGENS_HOME.latitude])
        .addTo(map);

    const markers = [homeMarker];

    clusters.forEach((c, ci) => {
        if (!c) return;
        if (c.visits.length > 1) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'viagens-cluster-badge';
            btn.textContent = String(c.visits.length);
            btn.addEventListener('click', () => {
                map.flyTo({ center: [c.longitude, c.latitude], zoom: map.getZoom() + 1.8, duration: 700 });
            });
            markers.push(new maplibregl.Marker({ element: btn, anchor: 'center' }).setLngLat([c.longitude, c.latitude]).addTo(map));
            return;
        }
        const visit = c.visits[0];
        const coord = displayCoordinate(visit, visits);
        const index = visits.findIndex((v) => v.id === visit.id);
        const wrap = document.createElement('div');
        wrap.className = 'viagens-pin-marker';
        const ticketHost = document.createElement('div');
        wrap.appendChild(ticketHost);
        const pinSlot = document.createElement('div');
        pinSlot.innerHTML = renderViagensPinHtml(visit.status, {
            index: index >= 0 ? index : 0,
            isPrincipal: visit.destination.isPrincipal
        });
        wrap.appendChild(pinSlot.firstElementChild || pinSlot);
        wrap.onmouseenter = () => {
            ticketHost.innerHTML = renderHoverTicketHtml(visit.hover);
        };
        wrap.onmouseleave = () => {
            ticketHost.innerHTML = '';
        };
        wrap.addEventListener('click', (e) => {
            e.stopPropagation();
            onOpenTrip(visit.tripId);
        });
        markers.push(
            new maplibregl.Marker({ element: wrap, anchor: 'bottom' }).setLngLat([coord.lng, coord.lat]).addTo(map)
        );
    });

    overlay._markers = markers;
}