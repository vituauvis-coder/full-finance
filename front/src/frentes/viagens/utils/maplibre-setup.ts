import * as maplibregl from 'maplibre-gl';
import type { ExpressionSpecification, Map, SkySpecification } from 'maplibre-gl';
import maplibreglWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { placeGlobeNightShadeLayer } from './nightShadeImage';
import { applyRealtimeSunToMap } from './realtimeSun';

let configured = false;

export function ensureMapLibreWorker(): void {
    if (configured) return;
    maplibregl.setWorkerUrl(maplibreglWorker);
    configured = true;
}

export const CARTO_LIGHT = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
export const CARTO_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
export const CARTO_POSITRON = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
export const MAP_STYLE_DEMO = 'https://demotiles.maplibre.org/style.json';
/** OSM detalhado — ruas, quadras e nomes (ideal para pin de hospedagem). */
export const OPENFREEMAP_LIBERTY = 'https://tiles.openfreemap.org/styles/liberty';
export const OPENFREEMAP_DARK = 'https://tiles.openfreemap.org/styles/dark';

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

/** Mapa claro (Voyager) — sempre fundo claro no roteiro. */
export function mapStyleForRoteiros(): string {
    return CARTO_LIGHT;
}

/** China / han → pt → en → latim (evita rótulo só em mandarim quando há tradução). */
export const VIAGENS_MAP_LABEL_ROTEIROS_FIELD: ExpressionSpecification = [
    'case',
    [
        'any',
        ['==', ['get', 'iso_a2'], 'CN'],
        ['==', ['get', 'country_code'], 'CN'],
        ['==', ['get', 'country_code'], 'cn'],
        ['==', ['get', 'addr:country'], 'CN']
    ],
    [
        'coalesce',
        ['get', 'name:pt-BR'],
        ['get', 'name:pt'],
        ['get', 'name_en'],
        ['get', 'name:en'],
        ['get', 'name:latin'],
        ['get', 'int_name'],
        ['get', 'name']
    ],
    [
        'coalesce',
        ['get', 'name:pt-BR'],
        ['get', 'name:pt'],
        ['get', 'name_en'],
        ['get', 'name:en'],
        ['get', 'name:latin'],
        ['get', 'int_name'],
        ['get', 'name']
    ]
];

export function applyRoteirosMapLabels(map: Map): void {
    if (!map.isStyleLoaded()) return;
    for (const layer of map.getStyle()?.layers ?? []) {
        if (layer.type !== 'symbol') continue;
        const layout = layer.layout as { 'text-field'?: unknown } | undefined;
        if (layout?.['text-field'] == null) continue;
        try {
            map.setLayoutProperty(layer.id, 'text-field', VIAGENS_MAP_LABEL_ROTEIROS_FIELD);
        } catch {
            /* ignore */
        }
    }
}

export function bindRoteirosMapLabels(map: Map): void {
    const run = () => applyRoteirosMapLabels(map);
    map.on('style.load', run);
    run();
}

/** Cores de rótulo no tema claro (fundo claro do Voyager). */
export function applyRoteirosRoadmapStyle(map: Map): void {
    if (!map.isStyleLoaded()) return;
    const text = '#4a4a4a';
    const halo = 'rgba(255, 255, 255, 0.94)';
    for (const layer of map.getStyle()?.layers ?? []) {
        if (layer.type !== 'symbol') continue;
        try {
            map.setPaintProperty(layer.id, 'text-color', text);
            map.setPaintProperty(layer.id, 'text-halo-color', halo);
            map.setPaintProperty(layer.id, 'text-halo-width', 1.4);
        } catch {
            /* ignore */
        }
    }
    try {
        map.setPaintProperty('background', 'background-color', '#f5f3f0');
    } catch {
        /* ignore */
    }
    try {
        map.setPaintProperty('water', 'fill-color', '#c8e4f8');
    } catch {
        /* ignore */
    }
    try {
        map.setPaintProperty('water_shadow', 'fill-color', '#b5d9f2');
    } catch {
        /* ignore */
    }
    try {
        map.setPaintProperty('landcover', 'fill-color', '#e8f0e4');
    } catch {
        /* ignore */
    }
}

export type HospedagensBasemap = 'real' | 'carto' | 'osm';

const HOSP_BASEMAP_STORAGE = 'viagens-hosp-basemap';

export function readHospedagensBasemap(): HospedagensBasemap {
    try {
        const v = localStorage.getItem(HOSP_BASEMAP_STORAGE);
        if (v === 'carto' || v === 'osm' || v === 'real') return v;
        return 'real';
    } catch {
        return 'real';
    }
}

export function writeHospedagensBasemap(mode: HospedagensBasemap): void {
    try {
        localStorage.setItem(HOSP_BASEMAP_STORAGE, mode);
    } catch {
        /* ignore */
    }
}

/** Real = satélite Esri + ruas Voyager; osm = Liberty 3D; carto = mapa ilustrado. */
export function mapStyleForHospedagens(mode: HospedagensBasemap = readHospedagensBasemap()): string {
    if (mode === 'real') return CARTO_LIGHT;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (mode === 'osm') {
        return dark ? OPENFREEMAP_DARK : OPENFREEMAP_LIBERTY;
    }
    return dark ? CARTO_DARK : CARTO_LIGHT;
}

export const HOSP_ESRI_HILLSHADE_TILES = [
    'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}'
];

/** Céu leve para vista inclinada perto do chão (hospedagens). */
export const HOSP_STREET_SKY: SkySpecification = {
    'sky-color': '#5a9fd4',
    'horizon-color': '#d8ebe8',
    'fog-color': '#b8d4e8',
    'sky-horizon-blend': 0.35,
    'horizon-fog-blend': 0.25,
    'fog-ground-blend': 0.55,
    'atmosphere-blend': 0.72
};

const HOSP_VECTOR_LAND_HIDES = [
    'water',
    'water_shadow',
    'landcover',
    'landuse',
    'park_national_park',
    'park_nature_reserve',
    'landuse_residential'
] as const;

/** Foto de satélite visível; mantém ruas, nomes e extrusão 3D. */
export function applyHospedagensSatelliteHybrid(map: Map): void {
    if (!map.isStyleLoaded()) return;
    try {
        map.setPaintProperty('background', 'background-color', '#1a2634');
    } catch {
        /* ignore */
    }
    for (const id of HOSP_VECTOR_LAND_HIDES) {
        if (!map.getLayer(id)) continue;
        try {
            map.setPaintProperty(id, 'fill-opacity', 0);
        } catch {
            /* ignore */
        }
    }
    for (const id of ['building', 'building-top'] as const) {
        if (!map.getLayer(id)) continue;
        try {
            map.setPaintProperty(id, 'fill-opacity', 0);
        } catch {
            /* ignore */
        }
    }
}

function firstSymbolLayerId(map: Map): string | undefined {
    return map.getStyle()?.layers?.find((layer) => layer.type === 'symbol')?.id;
}

/** Imagens Esri ficam abaixo dos rótulos de rua. */
export function placeHospImageryLayers(map: Map): void {
    const belowLabels = firstSymbolLayerId(map);
    if (!belowLabels) return;
    try {
        if (map.getLayer('hosp-hillshade-layer')) {
            map.moveLayer('hosp-hillshade-layer', belowLabels);
        }
        if (map.getLayer('hosp-earth-layer')) {
            map.moveLayer('hosp-earth-layer', belowLabels);
            if (map.getLayer('hosp-hillshade-layer')) {
                map.moveLayer('hosp-earth-layer', 'hosp-hillshade-layer');
            }
        }
    } catch {
        /* estilo ainda montando */
    }
}

export function applyHospedagensImageryTheme(map: Map, mode: HospedagensBasemap): void {
    if (mode !== 'real' || !map.getLayer('hosp-earth-layer')) return;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    try {
        map.setPaintProperty('hosp-earth-layer', 'raster-brightness-max', dark ? 0.7 : 1);
        map.setPaintProperty('hosp-earth-layer', 'raster-saturation', dark ? -0.12 : 0.05);
        map.setPaintProperty('hosp-hillshade-layer', 'raster-opacity', dark ? 0.28 : 0.42);
    } catch {
        /* ignore */
    }
}

const HOSP_BUILDING_HEIGHT: ExpressionSpecification = [
    'coalesce',
    ['get', 'height'],
    ['get', 'render_height'],
    ['*', ['coalesce', ['get', 'levels'], ['get', 'level'], 3], 3],
    10
];

/** Ruas + prédios 3D no zoom de pin (Carto Voyager e OpenFreeMap Liberty). */
export function applyHospedagensStreetView3D(map: Map, realistic = false): void {
    if (!map.isStyleLoaded()) return;

    const extrusionColor = realistic
        ? ([
              'interpolate',
              ['linear'],
              ['zoom'],
              14,
              'rgba(220, 212, 200, 0.92)',
              17,
              'rgba(200, 190, 178, 0.88)'
          ] as ExpressionSpecification)
        : ([
              'interpolate',
              ['linear'],
              ['zoom'],
              14,
              '#ebe3d7',
              17,
              '#d8cfc3'
          ] as ExpressionSpecification);

    if (map.getLayer('building-3d')) {
        try {
            map.setLayerZoomRange('building-3d', 13, 24);
            map.setPaintProperty('building-3d', 'fill-extrusion-opacity', realistic ? 0.94 : 0.9);
            if (realistic) {
                map.setPaintProperty('building-3d', 'fill-extrusion-color', '#ddd4c8');
            }
        } catch {
            /* ignore */
        }
        if (map.getLayer('building')) {
            try {
                map.setPaintProperty('building', 'fill-opacity', [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14,
                    0.85,
                    15.5,
                    0.25,
                    17,
                    0.08
                ]);
            } catch {
                /* ignore */
            }
        }
    }

    if (map.getLayer('hosp-building-3d')) {
        try {
            map.setPaintProperty('hosp-building-3d', 'fill-extrusion-color', extrusionColor);
            map.setPaintProperty('hosp-building-3d', 'fill-extrusion-opacity', realistic ? 0.9 : 0.78);
        } catch {
            /* ignore */
        }
    } else if (map.getSource('protomaps')) {
        const anchor = map.getLayer('building-top') ? 'building-top' : map.getLayer('building') ? 'building' : undefined;
        try {
            map.addLayer(
                {
                    id: 'hosp-building-3d',
                    type: 'fill-extrusion',
                    source: 'protomaps',
                    'source-layer': 'buildings',
                    minzoom: 13,
                    filter: ['>=', ['coalesce', ['get', 'layer'], 0], 0],
                    paint: {
                        'fill-extrusion-color': extrusionColor,
                        'fill-extrusion-height': HOSP_BUILDING_HEIGHT,
                        'fill-extrusion-opacity': realistic ? 0.9 : 0.78
                    }
                },
                anchor
            );
        } catch {
            /* style ainda carregando ou camada duplicada */
        }
    }
}

const HOSP_STREET_BOUND = Symbol('hospStreetViewBound');

export function bindHospedagensStreetView(map: Map, getMode: () => HospedagensBasemap): void {
    const tune = () => {
        const mode = getMode();
        const realistic = mode === 'real';
        applyMapLabelsLocal(map);
        if (realistic) applyHospedagensSatelliteHybrid(map);
        applyHospedagensStreetView3D(map, realistic);
        if (realistic) {
            applyRealtimeSunToMap(map);
            placeHospImageryLayers(map);
            applyHospedagensImageryTheme(map, mode);
        }
    };

    const tagged = map as Map & { [HOSP_STREET_BOUND]?: boolean };
    if (tagged[HOSP_STREET_BOUND]) {
        tune();
        return;
    }
    tagged[HOSP_STREET_BOUND] = true;
    map.on('style.load', tune);
    tune();
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

/** Nome local no mapa; China → latim (en/romanização), sem forçar pt-BR. */
export const VIAGENS_MAP_LABEL_LOCAL_FIELD: ExpressionSpecification = [
    'case',
    [
        'any',
        ['==', ['get', 'iso_a2'], 'CN'],
        ['==', ['get', 'country_code'], 'CN'],
        ['==', ['get', 'country_code'], 'cn'],
        ['==', ['get', 'addr:country'], 'CN']
    ],
    ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'int_name'], ['get', 'name:nonlatin'], ['get', 'name']],
    ['coalesce', ['get', 'name:local'], ['get', 'local_name'], ['get', 'name'], ['get', 'name:en']]
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

export function applyMapLabelsLocal(map: Map): void {
    if (!map.isStyleLoaded()) return;
    for (const layer of map.getStyle()?.layers ?? []) {
        if (layer.type !== 'symbol') continue;
        const layout = layer.layout as { 'text-field'?: unknown } | undefined;
        if (layout?.['text-field'] == null) continue;
        try {
            map.setLayoutProperty(layer.id, 'text-field', VIAGENS_MAP_LABEL_LOCAL_FIELD);
        } catch {
            /* ignore */
        }
    }
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