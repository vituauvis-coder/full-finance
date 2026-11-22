import test from 'node:test';
import assert from 'node:assert/strict';
import { groundPathCoordinates } from '../../../../motor/viagens/atlas-route-geometry.js';
import { snapPointToDestinations } from '../../../../motor/viagens/flight-route-geo.js';

test('groundPathCoordinates ancora início e fim nos pins', () => {
    const from = { lng: 116.4, lat: 40.0 };
    const to = { lng: 116.57, lat: 40.43 };
    const coords = groundPathCoordinates(from, to, 'ground', 45);
    assert.ok(coords.length > 8);
    assert.equal(coords[0][0], from.lng);
    assert.equal(coords[0][1], from.lat);
    assert.equal(coords[coords.length - 1][0], to.lng);
    assert.equal(coords[coords.length - 1][1], to.lat);
});

test('snapPointToDestinations usa coordenadas do destino da ficha', () => {
    const pt = { lng: 116.597, lat: 40.079, label: 'PVG' };
    const destinations = [
        { id: 'pvg', name: 'Xangai (PVG)', latitude: 31.14, longitude: 121.81, kind: 'airport' }
    ];
    const snapped = snapPointToDestinations(pt, destinations);
    assert.equal(snapped.lng, 121.81);
    assert.equal(snapped.lat, 31.14);
});