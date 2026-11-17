import * as maplibregl from 'maplibre-gl';
import type { ExpressionSpecification, Map, SkySpecification } from 'maplibre-gl';
import maplibreglWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { placeGlobeNightShadeLayer } from './nightShadeImage';

let configured = false;

export function ensureMapLibreWorker(): void {
    if (configured) return;
    maplibregl.setWorkerUrl(maplibreglWorker);
    configured = true;
}

export const CARTO_LIGHT = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
export const CARTO_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
export const MAP_STYLE_DEMO = 'https://demotiles.maplibre.org/style.json';

/** Céu ao redor do globo — azul profundo com leve atmosfera. */
export const GLOBE_SPACE_SKY: SkySpecification = {
    'sky-color': '#020818',
    'horizon-color': '#0a1f45',
    'fog-color': '#01040c',
    'sky-horizon-blend': 0.12,
    'horizon-fog-blend': 0.08,
    'fog-ground-blend': 0.05,
    'atmosphere-blend': 0.48
};

export type ViagensAtlasMapView = 'flat' | 'globe';

export function mapStyleForTheme(): string {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark ? CARTO_DARK : CARTO_LIGHT;
}

/** Atlas (mapa + globo): Voyager com rótulos; satélite e noite vêm das camadas Esri/sombra. */
export function mapStyleForAtlasView(_view: ViagensAtlasMapView): string {
    return CARTO_LIGHT;
}

/** Rótulos do basemap CARTO/OSM em pt-BR (fallback pt → nome local). */
export const VIAGENS_MAP_LABEL_TEXT_FIELD: ExpressionSpecification = [
    'coalesce',
    ['get', 'name:pt-BR'],
    ['get', 'name:pt'],
    ['get', 'name_pt'],
    ['get', 'name']
];

export function applyMapLabelsPtBr(map: Map): void {
    if (!map.isStyleLoaded()) return;
    for (const layer of map.getStyle()?.layers ?? []) {
        if (layer.type !== 'symbol') continue;
        const layout = layer.layout as { 'text-field'?: unknown } | undefined;
        if (layout?.['text-field'] == null) continue;
        try {
            map.setLayoutProperty(layer.id, 'text-field', VIAGENS_MAP_LABEL_TEXT_FIELD);
        } catch {
            /* camada sem dados de nome neste zoom */
        }
    }
}

export function bindMapLabelsPtBr(map: Map): void {
    const run = () => applyMapLabelsPtBr(map);
    map.on('style.load', run);
    run();
}

/** Skin do globo: `esri-imagery` — satélite Esri World Imagery, sem chave de API. */
export const GLOBE_EARTH_SKIN = 'esri-imagery' as const;
export const GLOBE_EARTH_RASTER_TILES = [
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
];

const GLOBE_OCEAN = '#0b4f94';
const GLOBE_WATER = '#1a85cf';
const GLOBE_WATER_SHADE = '#0a3d6e';
const GLOBE_LAND_GREEN: ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    0,
    '#4a9d5c',
    3,
    '#449658',
    6,
    '#3f8f54',
    9,
    'rgba(58, 142, 74, 0.9)',
    12,
    '#3d9456'
];

const VECTOR_LAND_FILLS = [
    'water',
    'water_shadow',
    'landcover',
    'landuse',
    'park_national_park',
    'park_nature_reserve'
] as const;

export function applyGlobeVectorEarthColors(map: Map): void {
    if (!map.isStyleLoaded()) return;

    if (GLOBE_EARTH_SKIN === 'esri-imagery') {
        try {
            map.setPaintProperty('background', 'background-color', '#020818');
        } catch {
            /* ignore */
        }
        for (const id of VECTOR_LAND_FILLS) {
            if (!map.getLayer(id)) continue;
            try {
                map.setPaintProperty(id, 'fill-opacity', 0);
            } catch {
                /* ignore */
            }
        }
        for (const id of ['building', 'building-top', 'landuse_residential'] as const) {
            if (!map.getLayer(id)) continue;
            try {
                map.setPaintProperty(id, 'fill-opacity', 0);
            } catch {
                /* ignore */
            }
        }
        return;
    }

    try {
        map.setPaintProperty('background', 'background-color', GLOBE_OCEAN);
    } catch {
        /* ignore */
    }
    try {
        map.setPaintProperty('water', 'fill-color', GLOBE_WATER);
        map.setPaintProperty('water', 'fill-opacity', 1);
    } catch {
        /* ignore */
    }
    try {
        map.setPaintProperty('water_shadow', 'fill-color', GLOBE_WATER_SHADE);
        map.setPaintProperty('water_shadow', 'fill-opacity', 0.85);
    } catch {
        /* ignore */
    }
    for (const id of ['landcover', 'landuse', 'park_national_park', 'park_nature_reserve'] as const) {
        if (!map.getLayer(id)) continue;
        try {
            map.setLayerZoomRange(id, 0, 24);
            map.setPaintProperty(id, 'fill-color', GLOBE_LAND_GREEN);
            map.setPaintProperty(id, 'fill-opacity', 0.92);
        } catch {
            /* ignore */
        }
    }
    for (const id of ['building', 'building-top', 'landuse_residential'] as const) {
        if (!map.getLayer(id)) continue;
        try {
            map.setPaintProperty(id, 'fill-opacity', 0);
        } catch {
            /* ignore */
        }
    }
}

const ATLAS_COUNTRY_BOUNDARIES = ['boundary_country_outline', 'boundary_country_inner'] as const;

const BOUNDARY_INNER_WIDTH: ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    0,
    0.75,
    2.5,
    1.35,
    5,
    2.2
];

const BOUNDARY_OUTLINE_WIDTH: ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    0,
    2.5,
    3,
    4.5,
    6,
    7
];

/** Fronteiras nacionais e nomes (pt-BR) legíveis sobre satélite e sombra noturna. */
export function applyAtlasCountryBoundariesAndLabels(map: Map): void {
    if (!map.isStyleLoaded()) return;

    for (const id of ATLAS_COUNTRY_BOUNDARIES) {
        if (!map.getLayer(id)) continue;
        try {
            map.setLayerZoomRange(id, 0, 24);
        } catch {
            /* ignore */
        }
    }
    try {
        map.setPaintProperty('boundary_country_inner', 'line-color', '#eef3fb');
        map.setPaintProperty('boundary_country_inner', 'line-opacity', 0.95);
        map.setPaintProperty('boundary_country_inner', 'line-width', BOUNDARY_INNER_WIDTH);
    } catch {
        /* ignore */
    }
    try {
        map.setPaintProperty('boundary_country_outline', 'line-color', '#0a1020');
        map.setPaintProperty('boundary_country_outline', 'line-opacity', 0.72);
        map.setPaintProperty('boundary_country_outline', 'line-width', BOUNDARY_OUTLINE_WIDTH);
    } catch {
        /* ignore */
    }

    for (const layer of map.getStyle()?.layers ?? []) {
        if (layer.type !== 'symbol' || !layer.id.startsWith('place_')) continue;
        try {
            map.setLayerZoomRange(layer.id, 0, 24);
            map.setPaintProperty(layer.id, 'text-color', '#ffffff');
            map.setPaintProperty(layer.id, 'text-halo-color', 'rgba(2, 10, 28, 0.92)');
            map.setPaintProperty(layer.id, 'text-halo-width', 1.65);
        } catch {
            /* ignore */
        }
    }

}

/** Ordem final: satélite → noite → fronteiras → rótulos. */
export function syncAtlasMapLayerStack(map: Map): void {
    placeGlobeNightShadeLayer(map);
    applyAtlasCountryBoundariesAndLabels(map);
}

/** Ajusta cores vetoriais do Voyager no globo (fallback se o raster atrasar). */
export function applyGlobeRealisticEarth(map: Map): void {
    if (!map.isStyleLoaded()) return;
    applyGlobeVectorEarthColors(map);
}

/** @deprecated nome legado — use applyGlobeRealisticEarth */
export function applyGlobeVividBasemap(map: Map): void {
    applyGlobeRealisticEarth(map);
}

export function bindAtlasStyleTuning(map: Map, _getView: () => ViagensAtlasMapView): void {
    const tune = () => {
        applyMapLabelsPtBr(map);
        applyGlobeRealisticEarth(map);
        syncAtlasMapLayerStack(map);
    };
    map.on('style.load', tune);
    tune();
}

/** MapLibre precisa de resize depois que o flex/grid do portal estabiliza. */
export function scheduleMapResize(map: Map): void {
    const run = () => {
        try {
            map.resize();
        } catch {
            /* ignore */
        }
    };
    requestAnimationFrame(run);
    window.setTimeout(run, 120);
    window.setTimeout(run, 400);
}