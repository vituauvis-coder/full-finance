import test from 'node:test';
import assert from 'node:assert/strict';
import {
    flightRouteLegFeatures,
    resolveFlightPlace,
    tripFlightPaths
} from '../../../../motor/viagens/flight-route-geo.js';

test('resolveFlightPlace entende Recife, IATA e cidade', () => {
    const rec = resolveFlightPlace('Recife');
    assert.ok(Math.abs(rec.lat + 8.047) < 0.2);
    const mad = resolveFlightPlace('MAD');
    assert.ok(Math.abs(mad.lat - 40.47) < 0.5);
    const cn = resolveFlightPlace('China');
    assert.ok(cn.lat > 35);
});

test('tripFlightPaths monta ida com trechos e volta inferida', () => {
    const trip = {
        id: 't1',
        payload: {
            flight_segments: [
                {
                    id: 's1',
                    title: 'Ida 1',
                    simulations: [
                        {
                            id: 'f1',
                            origin: 'Recife (REC)',
                            destination: 'Madri (MAD)',
                            status: 'escolhida',
                            connections: []
                        }
                    ]
                },
                {
                    id: 's2',
                    title: 'Ida 2',
                    simulations: [
                        {
                            id: 'f2',
                            origin: 'MAD',
                            destination: 'China',
                            status: 'escolhida',
                            connections: []
                        }
                    ]
                }
            ]
        }
    };
    const paths = tripFlightPaths(trip);
    assert.ok(paths);
    assert.equal(paths.ida.length >= 3, true);
    assert.ok(paths.volta.length >= 2);
    assert.equal(paths.inferredVolta, true);
});

test('flightRouteLegFeatures gera um arco por trecho de ida', () => {
    const trip = {
        id: 't1',
        payload: {
            flight_segments: [
                {
                    id: 's1',
                    simulations: [
                        {
                            id: 'f1',
                            origin: 'REC',
                            destination: 'MAD',
                            status: 'escolhida',
                            connections: []
                        }
                    ]
                },
                {
                    id: 's2',
                    simulations: [
                        {
                            id: 'f2',
                            origin: 'MAD',
                            destination: 'China',
                            status: 'escolhida',
                            connections: []
                        }
                    ]
                }
            ]
        }
    };
    const { ida } = flightRouteLegFeatures([trip]);
    assert.equal(ida.features.length, 2);
    assert.equal(ida.features[0].properties.segment, 0);
    assert.equal(ida.features[1].properties.segment, 1);
});

test('volta inferida não gera linha duplicada no mapa', () => {
    const trip = {
        id: 't1',
        payload: {
            flight_segments: [
                {
                    id: 's1',
                    simulations: [{ id: 'f1', origin: 'REC', destination: 'MAD', status: 'escolhida', connections: [] }]
                },
                {
                    id: 's2',
                    simulations: [{ id: 'f2', origin: 'MAD', destination: 'China', status: 'escolhida', connections: [] }]
                }
            ]
        }
    };
    const { volta } = flightRouteLegFeatures([trip]);
    assert.equal(volta.features.length, 0);
});