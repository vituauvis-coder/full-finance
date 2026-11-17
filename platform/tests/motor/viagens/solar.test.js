import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    destinationPoint,
    nightHemisphereFeature,
    nightShadeAlpha,
    subsolarPoint,
    sunAltitudeDeg
} from '../../../../motor/viagens/solar.js';

describe('viagens solar', () => {
    it('subsolarPoint retorna lng/lat válidos', () => {
        const [lng, lat] = subsolarPoint(new Date());
        assert.ok(lng >= -180 && lng <= 180);
        assert.ok(lat >= -23.5 && lat <= 23.5);
    });

    it('nightHemisphereFeature é polígono fechado', () => {
        const f = nightHemisphereFeature(new Date());
        const ring = f.geometry.coordinates[0];
        assert.ok(ring.length > 4);
        const [a0, b0] = ring[0];
        const [a1, b1] = ring[ring.length - 1];
        assert.equal(a0, a1);
        assert.equal(b0, b1);
    });

    it('destinationPoint a 90° forma terminador', () => {
        const sub = subsolarPoint(new Date('2026-06-21T12:00:00Z'));
        const p = destinationPoint(sub[0], sub[1], 90, 0);
        assert.ok(Math.abs(p[0]) <= 180);
        assert.ok(Math.abs(p[1]) <= 90);
    });

    it('nightShadeAlpha escurece quando o Sol está abaixo do horizonte', () => {
        assert.equal(nightShadeAlpha(12), 0);
        assert.ok(Math.abs(nightShadeAlpha(-8) - 0.74) < 0.01);
        assert.ok(nightShadeAlpha(-2) > 0.3 && nightShadeAlpha(-2) < 0.45);
    });

    it('subsolar tem altitude ~90°', () => {
        const d = new Date();
        const sub = subsolarPoint(d);
        assert.ok(sunAltitudeDeg(sub[0], sub[1], d) > 89);
    });
});