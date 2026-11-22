import test from 'node:test';
import assert from 'node:assert/strict';
import {
    chinaArrivalAnchorId,
    reorderChinaRoute,
    resolveChinaRouteOrder
} from '../../../../motor/viagens/china-city-route.js';

const destinations = [
    { id: 'rote-aero-pek', name: 'Pequim', kind: 'airport', country: 'China', latitude: 40.08, longitude: 116.59 },
    { id: 'shanghai', name: 'Xangai', kind: 'city', country: 'China', latitude: 31.23, longitude: 121.47 },
    { id: 'furong', name: 'Furong', kind: 'city', country: 'China', latitude: 28.18, longitude: 113.02 },
    { id: 'china-country', name: 'China', kind: 'country', country: 'China', latitude: 35.86, longitude: 104.19 }
];

test('resolveChinaRouteOrder keeps PEK anchor first', () => {
    const { order, anchorId } = resolveChinaRouteOrder(destinations, {
        china_city_route_order: ['furong', 'shanghai', 'rote-aero-pek']
    });
    assert.equal(anchorId, 'rote-aero-pek');
    assert.equal(order[0], 'rote-aero-pek');
    assert.deepEqual(order.slice(1).sort(), ['furong', 'shanghai']);
});

test('reorderChinaRoute cannot move anchor from index 0', () => {
    const order = ['rote-aero-pek', 'shanghai', 'furong'];
    const next = reorderChinaRoute(order, 1, 0, 'rote-aero-pek');
    assert.deepEqual(next, order);
});

test('chinaArrivalAnchorId from itinerary chegada PEK', () => {
    const anchor = chinaArrivalAnchorId(destinations, {
        itinerary: [
            {
                id: 'd1',
                dayKey: '2027-04-19',
                items: [
                    {
                        id: 'rote-flight-x-chegada',
                        placeName: 'Pequim (PEK)',
                        destinationId: 'rote-aero-pek'
                    }
                ]
            }
        ]
    });
    assert.equal(anchor, 'rote-aero-pek');
});