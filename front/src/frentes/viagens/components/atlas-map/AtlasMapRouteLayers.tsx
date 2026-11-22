import { Layer, Source } from 'react-map-gl/maplibre';
import { mapRoutePaint } from '../../utils/map-route-paint';
import type { AtlasMapLayerBundle } from '../../utils/map-routes';

type LayerVisibility = {
    flights: boolean;
    roteiro: boolean;
};

type Props = {
    idPrefix: string;
    routeLegs: AtlasMapLayerBundle;
    visibility: LayerVisibility;
    flightsGlow?: boolean;
};

export function AtlasMapRouteLayers({
    idPrefix,
    routeLegs,
    visibility,
    flightsGlow = true
}: Props) {
    return (
        <>
            {visibility.flights && routeLegs.ida.features.length > 0 ? (
                <Source id={`${idPrefix}-routes-ida`} type="geojson" data={routeLegs.ida}>
                    {flightsGlow ? (
                        <Layer
                            id={`${idPrefix}-routes-ida-glow`}
                            type="line"
                            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                            paint={mapRoutePaint.idaGlow}
                        />
                    ) : null}
                    <Layer
                        id={`${idPrefix}-routes-ida-core`}
                        type="line"
                        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                        paint={mapRoutePaint.idaCore}
                    />
                </Source>
            ) : null}
            {visibility.flights && routeLegs.volta.features.length > 0 ? (
                <Source id={`${idPrefix}-routes-volta`} type="geojson" data={routeLegs.volta}>
                    {flightsGlow ? (
                        <Layer
                            id={`${idPrefix}-routes-volta-glow`}
                            type="line"
                            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                            paint={mapRoutePaint.voltaGlow}
                        />
                    ) : null}
                    <Layer
                        id={`${idPrefix}-routes-volta-core`}
                        type="line"
                        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                        paint={mapRoutePaint.voltaCore}
                    />
                </Source>
            ) : null}
            {visibility.roteiro && routeLegs.ground.features.length > 0 ? (
                <Source id={`${idPrefix}-routes-ground`} type="geojson" data={routeLegs.ground}>
                    <Layer
                        id={`${idPrefix}-routes-ground-glow`}
                        type="line"
                        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                        paint={mapRoutePaint.groundGlow}
                    />
                    <Layer
                        id={`${idPrefix}-routes-ground-core`}
                        type="line"
                        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                        paint={mapRoutePaint.groundCore}
                    />
                </Source>
            ) : null}
            {visibility.roteiro && routeLegs.walk.features.length > 0 ? (
                <Source id={`${idPrefix}-routes-walk`} type="geojson" data={routeLegs.walk}>
                    <Layer
                        id={`${idPrefix}-routes-walk-glow`}
                        type="line"
                        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                        paint={mapRoutePaint.walkGlow}
                    />
                    <Layer
                        id={`${idPrefix}-routes-walk-core`}
                        type="line"
                        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                        paint={mapRoutePaint.walkCore}
                    />
                </Source>
            ) : null}
            {visibility.roteiro && routeLegs.itineraryFlight.features.length > 0 ? (
                <Source
                    id={`${idPrefix}-routes-itinerary-flight`}
                    type="geojson"
                    data={routeLegs.itineraryFlight}
                >
                    <Layer
                        id={`${idPrefix}-routes-itinerary-flight-core`}
                        type="line"
                        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                        paint={mapRoutePaint.itineraryFlightCore}
                    />
                </Source>
            ) : null}
        </>
    );
}