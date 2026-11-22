import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildAtlasMapModel,
    itineraryLegFeatures,
    itineraryMapStops
} from '../../../../motor/viagens/atlas-map-model.js';
import { tripHasFlightRoute } from '../../../../motor/viagens/flight-route-geo.js';

const now = new Date('2026-06-15T12:00:00-03:00');

test('itineraryMapStops ignora itens sem coordenadas', () => {
    const trip = {
        id: 't1',
        title: 'Teste',
        payload: {
            destinations: [
                { id: 'd1', name: 'Xangai', latitude: 31.23, longitude: 121.47, kind: 'city' },
                { id: 'd2', name: 'Sem mapa' }
            ],
            itinerary: [
                {
                    id: 'day1',
                    dayKey: '2026-07-01',
                    items: [
                        { id: 'i1', title: 'Chegada', destinationId: 'd1' },
                        { id: 'i2', title: 'Fantasma', destinationId: 'd2' }
                    ]
                }
            ]
        }
    };
    const stops = itineraryMapStops(trip);
    assert.equal(stops.length, 1);
    assert.equal(stops[0].label, 'Xangai');
});

test('itineraryLegFeatures gera trecho ground entre duas paradas', () => {
    const trip = {
        id: 't2',
        payload: {
            destinations: [
                { id: 'a', name: 'A', latitude: 40.0, longitude: -3.7, kind: 'city' },
                { id: 'b', name: 'B', latitude: 40.4, longitude: -3.6, kind: 'city' }
            ],
            itinerary: [
                {
                    id: 'day1',
                    dayKey: '2026-08-01',
                    items: [
                        { id: 'i1', title: 'Em A', destinationId: 'a' },
                        { id: 'i2', title: 'Em B', destinationId: 'b', travelMode: 'ground' }
                    ]
                }
            ]
        }
    };
    const legs = itineraryLegFeatures(trip);
    assert.equal(legs.length, 1);
    assert.equal(legs[0].properties.layer, 'ground');
    assert.equal(legs[0].properties.source, 'itinerary');
    assert.ok(legs[0].geometry.coordinates.length >= 2);
    assert.ok(legs[0].geometry.coordinates.length > 5, 'trecho terrestre deve ser curva, não corda');
});

test('itineraryMapStops deduplica o mesmo destino no roteiro', () => {
    const trip = {
        id: 't-dedup',
        payload: {
            destinations: [
                { id: 'gw', name: 'Muralha', latitude: 40.43, longitude: 116.57, kind: 'poi' },
                { id: 'pek', name: 'Pequim', latitude: 39.9, longitude: 116.4, kind: 'city' }
            ],
            itinerary: [
                {
                    id: 'day1',
                    dayKey: '2026-09-02',
                    items: [
                        { id: 'i1', title: 'Muralha', destinationId: 'gw' },
                        { id: 'i2', title: 'Almoço na muralha', destinationId: 'gw' },
                        { id: 'i3', title: 'Pequim', destinationId: 'pek', travelMode: 'ground' }
                    ]
                }
            ]
        }
    };
    const stops = itineraryMapStops(trip);
    assert.equal(stops.length, 2);
    assert.equal(stops[0].destinationId, 'gw');
    assert.equal(stops[1].destinationId, 'pek');
});

test('itineraryLegFeatures não desenha corda longa se viagem tem voos', () => {
    const trip = {
        id: 't-flights',
        startsOn: '2026-09-01',
        endsOn: '2026-09-12',
        payload: {
            destinations: [
                { id: 'pek', name: 'PEK', latitude: 40.08, longitude: 116.59, kind: 'airport' },
                { id: 'pvg', name: 'PVG', latitude: 31.14, longitude: 121.81, kind: 'airport' },
                { id: 'mad', name: 'Madri', latitude: 40.45, longitude: -3.57, kind: 'city' }
            ],
            itinerary: [
                {
                    id: 'day1',
                    dayKey: '2026-09-05',
                    items: [
                        { id: 'i1', title: 'PEK', destinationId: 'pek' },
                        { id: 'i2', title: 'PVG', destinationId: 'pvg' }
                    ]
                }
            ],
            flightSegments: [
                {
                    id: 'fs1',
                    simulations: [
                        {
                            id: 'sim1',
                            status: 'escolhida',
                            hops: [
                                {
                                    id: 'h1',
                                    fromPlace: 'PEK',
                                    toPlace: 'PVG',
                                    departsAt: '08:00',
                                    arrivesAt: '10:30'
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    };
    assert.ok(tripHasFlightRoute(trip));
    const legs = itineraryLegFeatures(trip);
    assert.equal(legs.length, 0);
});

test('buildAtlasMapModel expõe camadas ground e visits', () => {
    const trip = {
        id: 't3',
        title: 'Roteiro',
        startsOn: '2026-09-01',
        endsOn: '2026-09-10',
        payload: {
            destinations: [
                { id: 'pe', name: 'Pequim', latitude: 39.9, longitude: 116.4, kind: 'city' },
                { id: 'mad', name: 'Madri', latitude: 40.4, longitude: -3.7, kind: 'city' }
            ],
            itinerary: [
                {
                    id: 'd1',
                    dayKey: '2026-09-02',
                    items: [
                        { id: 'i1', title: 'Pequim', destinationId: 'pe' },
                        { id: 'i2', title: 'Madri', destinationId: 'mad', travelMode: 'flight' }
                    ]
                }
            ]
        }
    };
    const model = buildAtlasMapModel([trip], { now });
    assert.ok(model.visits.length >= 2);
    assert.ok(model.layers.ground.features.length >= 0);
    assert.equal(model.layers.flightOut.type, 'FeatureCollection');
    assert.equal(model.meta.trips[0].itineraryStops, 2);
    assert.equal(model.meta.trips[0].itineraryLegs, 1);
});