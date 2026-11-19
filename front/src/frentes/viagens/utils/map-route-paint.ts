import type { ExpressionSpecification, Map } from 'maplibre-gl';

/** Bump quando mudar cores — facilita validar no devtools (layer ids estáveis). */
export const MAP_ROUTE_STYLE_KEY = 'v7-glow-solido-core-tracejado';

const IDA_CORE = '#ffd4a8';
const VOLTA_CORE = '#ffd4a8';
const ROUTE_GLOW_COLOR = '#c9955e';
const WAYPOINT_FILL = '#ffffff';
const WAYPOINT_STROKE = '#2ec4b6';

const ROUTE_DASH = [1.6, 2.4] as const;
const ROUTE_GLOW_WIDTH: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 1, 3.2, 6, 6.5];
const ROUTE_CORE_WIDTH: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 1, 1.25, 6, 2.1];
const WAYPOINT_RADIUS: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 1, 4.5, 6, 7];

/** Glow contínuo (blur em dash “cola” os traços); tracejado só no core — igual ida e volta. */
const routeGlowPaint = {
    'line-color': ROUTE_GLOW_COLOR,
    'line-width': ROUTE_GLOW_WIDTH,
    'line-opacity': 0.2,
    'line-blur': 0.6
} as const;

function routeCorePaint(coreColor: string) {
    return {
        'line-color': coreColor,
        'line-width': ROUTE_CORE_WIDTH,
        'line-opacity': 0.82,
        'line-dasharray': [...ROUTE_DASH]
    } as const;
}

export const mapRoutePaint = {
    idaGlow: routeGlowPaint,
    idaCore: routeCorePaint(IDA_CORE),
    voltaGlow: routeGlowPaint,
    voltaCore: routeCorePaint(VOLTA_CORE),
    waypoint: {
        'circle-radius': WAYPOINT_RADIUS,
        'circle-color': WAYPOINT_FILL,
        'circle-stroke-color': WAYPOINT_STROKE,
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.95
    }
} as const;

export type MapRouteLayerPrefix = 'viagens' | 'destino';

const LAYER_SUFFIXES = [
    'routes-ida-glow',
    'routes-ida-core',
    'routes-volta-glow',
    'routes-volta-core',
    'route-waypoints-ring'
] as const;

const PAINT_BY_SUFFIX: Record<(typeof LAYER_SUFFIXES)[number], Record<string, unknown>> = {
    'routes-ida-glow': mapRoutePaint.idaGlow,
    'routes-ida-core': mapRoutePaint.idaCore,
    'routes-volta-glow': mapRoutePaint.voltaGlow,
    'routes-volta-core': mapRoutePaint.voltaCore,
    'route-waypoints-ring': mapRoutePaint.waypoint
};

function layerId(prefix: MapRouteLayerPrefix, suffix: (typeof LAYER_SUFFIXES)[number]) {
    return `${prefix}-${suffix}`;
}

/** Força paint no MapLibre (react-map-gl nem sempre reaplica paint no hot reload). */
export function applyMapRoutePaint(map: Map, prefix: MapRouteLayerPrefix): void {
    if (!map.isStyleLoaded()) return;
    for (const suffix of LAYER_SUFFIXES) {
        const id = layerId(prefix, suffix);
        if (!map.getLayer(id)) continue;
        const paint = PAINT_BY_SUFFIX[suffix];
        for (const [key, value] of Object.entries(paint)) {
            try {
                map.setPaintProperty(id, key, value);
            } catch {
                /* camada ainda montando */
            }
        }
        if (suffix.endsWith('glow')) {
            try {
                map.setPaintProperty(id, 'line-dasharray', null);
            } catch {
                /* camada ainda montando */
            }
        }
    }
}

export function bindMapRoutePaint(map: Map, prefix: MapRouteLayerPrefix): () => void {
    const run = () => applyMapRoutePaint(map, prefix);
    run();
    map.on('styledata', run);
    map.on('idle', run);
    return () => {
        map.off('styledata', run);
        map.off('idle', run);
    };
}