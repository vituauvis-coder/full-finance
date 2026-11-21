import test from 'node:test';
import assert from 'node:assert/strict';
import {
    AUTO_FLIGHT_KM,
    estimateGroundDurationMin,
    honorManualGroundMode,
    shouldDrawManualGroundLeg
} from '../../../../motor/viagens/ground-route-policy.js';

test('shouldDrawManualGroundLeg allows same-country train beyond AUTO_FLIGHT_KM', () => {
    assert.equal(AUTO_FLIGHT_KM, 280);
    assert.equal(
        shouldDrawManualGroundLeg(1067, { sameCountry: true, groundKind: 'train' }),
        true
    );
});

test('shouldDrawManualGroundLeg allows same-country explicit ground (bus/car)', () => {
    assert.equal(shouldDrawManualGroundLeg(400, { sameCountry: true, groundKind: 'bus' }), true);
    assert.equal(shouldDrawManualGroundLeg(400, { sameCountry: true, groundKind: null }), true);
});

test('shouldDrawManualGroundLeg still blocks long cross-country car as ground', () => {
    assert.equal(
        shouldDrawManualGroundLeg(900, { sameCountry: false, groundKind: 'rideshare' }),
        false
    );
});

test('shouldDrawManualGroundLeg allows cross-country train', () => {
    assert.equal(
        shouldDrawManualGroundLeg(500, { sameCountry: false, groundKind: 'train' }),
        true
    );
});

test('honorManualGroundMode keeps ground for PEK→Xangai train', () => {
    assert.equal(
        honorManualGroundMode('flight', 'ground', 1067, {
            sameCountry: true,
            groundKind: 'train'
        }),
        'ground'
    );
});

test('honorManualGroundMode still forces flight for long cross-country car', () => {
    assert.equal(
        honorManualGroundMode('flight', 'ground', 900, {
            sameCountry: false,
            groundKind: null
        }),
        'flight'
    );
});

test('estimateGroundDurationMin uses HSR pace for long train legs', () => {
    const min = estimateGroundDurationMin(1067, 'train');
    // ~250 km/h → ~4–5 h, not ~15 h de carro
    assert.ok(min >= 200 && min <= 360, `expected ~4–5h, got ${min} min`);
});
