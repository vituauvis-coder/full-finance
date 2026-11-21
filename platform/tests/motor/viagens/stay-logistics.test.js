import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm } from '../../../../motor/viagens/geo-distance.js';
import { chosenArrivalAirports, stayAirportInsight } from '../../../../motor/viagens/stay-logistics.js';
import { staysSummary } from '../../../../motor/viagens/trip-stays-stats.js';

test('haversineKm REC to central Recife ~10km order', () => {
    const km = haversineKm(-8.1264, -34.9236, -8.0476, -34.877);
    assert.ok(km != null && km > 5 && km < 25);
});

test('chosenArrivalAirports from escolhida simulation', () => {
    const trip = {
        payload: {
            destinations: [{ id: 'd1', name: 'Lisboa', latitude: 38.72, longitude: -9.14 }],
            flight_segments: [
                {
                    id: 's1',
                    title: 'Ida',
                    simulations: [
                        {
                            id: 'f1',
                            status: 'escolhida',
                            origin: 'Recife (REC)',
                            destination: 'Lisboa (LIS)',
                            connections: []
                        }
                    ]
                }
            ]
        }
    };
    const airports = chosenArrivalAirports(trip);
    assert.ok(airports.length >= 1);
    assert.equal(airports[0].iata, 'LIS');
});

test('stayAirportInsight with coords', () => {
    const trip = {
        payload: {
            destinations: [{ id: 'd1', name: 'Lisboa', latitude: 38.72, longitude: -9.14 }],
            flight_segments: [
                {
                    id: 's1',
                    simulations: [
                        {
                            status: 'escolhida',
                            origin: 'REC',
                            destination: 'LIS',
                            connections: []
                        }
                    ]
                }
            ]
        }
    };
    const insight = stayAirportInsight(trip, {
        destinationId: 'd1',
        latitude: 38.71,
        longitude: -9.14
    });
    assert.ok(insight.distanceKm != null);
    assert.match(insight.hint ?? '', /km do aeroporto/i);
});

test('staysSummary', () => {
    const s = staysSummary([
        { amount: 500, paid: true, checkInOn: '2026-01-01', checkOutOn: '2026-01-03' },
        { amount: 200, paid: false, latitude: 1, longitude: 1 }
    ]);
    assert.equal(s.total, 700);
    assert.equal(s.paid, 500);
    assert.equal(s.unpaid, 200);
    assert.equal(s.nights, 2);
    assert.equal(s.withCoords, 1);
});