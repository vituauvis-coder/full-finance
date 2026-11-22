import type { ExpressionSpecification, Map } from 'maplibre-gl';

/** Bump quando mudar cores — facilita validar no devtools (layer ids estáveis). */
export const MAP_ROUTE_STYLE_KEY = 'v9-lines-curvas-glow';

const IDA_CORE = '#e8c9a0';
const VOLTA_CORE = '#e8c9a0';
const ROUTE_GLOW_COLOR = '#b8a078';
const WAYPOINT_FILL = '#ffffff';
const WAYPOINT_STROKE = '#2ec4b6';

const ROUTE_DASH = [1.6, 2.4] as const;
const ROUTE_GLOW_WIDTH: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 1, 2.8, 6, 5.8];
const ROUTE_CORE_WIDTH: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 1, 1.05, 6, 1.85];
const WAYPOINT_RADIUS: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 1, 4.5, 6, 7];

/** Glow contínuo (blur em dash “cola” os traços); tracejado só no core — igual ida e volta. */
const routeGlowPaint = {
    'line-color': ROUTE_GLOW_COLOR,
    'line-width': ROUTE_GLOW_WIDTH,
    'line-opacity': 0.14,
    'line-blur': 0.45
} as const;

function routeCorePaint(coreColor: string) {
    return {
        'line-color': coreColor,
        'line-width': ROUTE_CORE_WIDTH,
        'line-opacity': 0.78,
        'line-dasharray': [...ROUTE_DASH]
    } as const;
}

const GROUND_CORE = '#2ec4b6';
const WALK_CORE = '#c9a227';
const ITIN_FLIGHT_CORE = '#7ec8e8';

const GROUND_WIDTH: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 1, 1.1, 6, 2.2];
const WALK_WIDTH: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 1, 1, 6, 1.8];
const ITIN_FLIGHT_WIDTH: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 1, 1.15, 6, 2];

const groundGlowPaint = {
    'line-color': GROUND_CORE,
    'line-width': ['interpolate', ['linear'], ['zoom'], 1, 3.4, 6, 6] as ExpressionSpecification,
    'line-opacity': 0.16,
    'line-blur': 0.55
} as const;

const walkGlowPaint = {
    'line-color': WALK_CORE,
    'line-width': ['interpolate', ['linear'], ['zoom'], 1, 2.6, 6, 5] as ExpressionSpecification,
    'line-opacity': 0.14,
    'line-blur': 0.45
} as const;

const itineraryGroundCore = {
    'line-color': GROUND_CORE,
    'line-width': GROUND_WIDTH,
    'line-opacity': 0.82,
    'line-dasharray': [1.4, 1.1]
} as const;

const itineraryWalkCore = {
    'line-color': WALK_CORE,
    'line-width': WALK_WIDTH,
    'line-opacity': 0.78,
    'line-dasharray': [0.45, 0.65, 0.2, 0.65]
} as const;

const itineraryFlightCore = {
    'line-color': ITIN_FLIGHT_CORE,
    'line-width': ITIN_FLIGHT_WIDTH,
    'line-opacity': 0.8
} as const;

export const mapRoutePaint = {
    idaGlow: routeGlowPaint,
    idaCore: routeCorePaint(IDA_CORE),
    voltaGlow: routeGlowPaint,
    voltaCore: routeCorePaint(VOLTA_CORE),
    groundGlow: groundGlowPaint,
    groundCore: itineraryGroundCore,
    walkGlow: walkGlowPaint,
    walkCore: itineraryWalkCore,
    itineraryFlightCore,
    waypoint: {
        'circle-radius': WAYPOINT_RADIUS,
        'circle-color': WAYPOINT_FILL,
        'circle-stroke-color': WAYPOINT_STROKE,
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.95
    }
} as const;

export type MapRouteLayerPrefix = 'viagens' | 'destino' | 'mini';

const LAYER_SUFFIXES = [
    'routes-ida-glow',
    'routes-ida-core',
    'routes-volta-glow',
    'routes-volta-core',
    'routes-ground-glow',
    'routes-ground-core',
    'routes-walk-glow',
    'routes-walk-core',
    'routes-itinerary-flight-core',
    'route-waypoints-ring'
] as const;

const PAINT_BY_SUFFIX: Record<(typeof LAYER_SUFFIXES)[number], Record<string, unknown>> = {
    'routes-ida-glow': mapRoutePaint.idaGlow,
    'routes-ida-core': mapRoutePaint.idaCore,
    'routes-volta-glow': mapRoutePaint.voltaGlow,
    'routes-volta-core': mapRoutePaint.voltaCore,
    'routes-ground-glow': mapRoutePaint.groundGlow,
    'routes-ground-core': mapRoutePaint.groundCore,
    'routes-walk-glow': mapRoutePaint.walkGlow,
    'routes-walk-core': mapRoutePaint.walkCore,
    'routes-itinerary-flight-core': mapRoutePaint.itineraryFlightCore,
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
                map.setPaintProperty(id, 'line-cap', 'round');
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