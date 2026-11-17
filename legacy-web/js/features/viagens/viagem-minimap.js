import * as maplibregl from 'maplibre-gl';
import { VIAGENS_GLOBE } from '../../../../motor/viagens/viagens-atlas.js';
import { renderViagensPinHtml } from './viagens-pin.js';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
let miniMap = null;

export function destroyViagensMiniMap() {
    if (miniMap) {
        miniMap.remove();
        miniMap = null;
    }
}

export function mountViagensMiniMap(container, { destinations, onTap }) {
    if (!container) return;
    destroyViagensMiniMap();
    container.innerHTML = '<div class="viagens-minimap-canvas" style="width:100%;height:220px;border-radius:12px;overflow:hidden"></div>';
    const el = container.querySelector('.viagens-minimap-canvas');
    miniMap = new maplibregl.Map({
        container: el,
        style: MAP_STYLE,
        center: [VIAGENS_GLOBE.longitude, VIAGENS_GLOBE.latitude],
        zoom: 1.2,
        attributionControl: false
    });
    miniMap.on('load', () => {
        (destinations ?? []).forEach((d, i) => {
            const pin = document.createElement('div');
            pin.innerHTML = renderViagensPinHtml('planejada', { size: 'sm', index: i });
            new maplibregl.Marker({ element: pin, anchor: 'bottom' })
                .setLngLat([d.longitude, d.latitude])
                .addTo(miniMap);
        });
    });
    miniMap.on('click', (e) => onTap?.(e.lngLat.lat, e.lngLat.lng));
}