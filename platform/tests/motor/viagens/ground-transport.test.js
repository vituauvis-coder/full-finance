import test from 'node:test';
import assert from 'node:assert/strict';
import {
    groundTransportRoteiroStats,
    groundTransportTitle,
    itineraryGroundTransportUses,
    sumGroundTransportAmount
} from '../../../../motor/viagens/ground-transport.js';
import { spent } from '../../../../motor/viagens/trips-engine.js';

test('groundTransportTitle uses route or kind', () => {
    assert.equal(groundTransportTitle({ kind: 'train', fromName: 'Tóquio', toName: 'Kyoto' }), 'Tóquio → Kyoto');
    assert.equal(groundTransportTitle({ kind: 'bus', title: 'FlixBus' }), 'FlixBus');
});

test('spent transporte includes ground_transports', () => {
    const dest = '11111111-1111-4111-8111-111111111111';
    const trip = {
        payload: {
            expenses: [],
            stays: [],
            ground_transports: [
                { id: 'a', amount: 120, tripDestinationId: dest, kind: 'taxi' },
                { id: 'b', amount: 80, kind: 'metro' }
            ],
            legs: []
        }
    };
    assert.equal(sumGroundTransportAmount(trip.payload), 200);
    assert.equal(spent(trip, { category: 'transporte' }), 200);
    assert.equal(spent(trip, { category: 'transporte', destinationId: dest }), 120);
});

test('groundTransportRoteiroStats counts itinerary links', () => {
    const ticketId = 'gt-1';
    const payload = {
        ground_transports: [{ id: ticketId, amount: 50, kind: 'train' }],
        itinerary: [
            {
                id: 'd1',
                items: [
                    { id: 'a', title: 'X', travelMode: 'ground', groundTransportId: ticketId },
                    { id: 'b', title: 'Y', travelMode: 'ground', groundTransportId: ticketId },
                    { id: 'c', title: 'Z', travelMode: 'walk' }
                ]
            }
        ]
    };
    assert.equal(itineraryGroundTransportUses(payload.itinerary, ticketId), 2);
    const stats = groundTransportRoteiroStats(payload, ticketId);
    assert.equal(stats.uses, 2);
    assert.equal(stats.totalAmount, 100);
});