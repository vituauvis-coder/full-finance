import test from 'node:test';
import assert from 'node:assert/strict';
import { convertPoints, originPointsNeeded } from '../../../../motor/milhas/convert.js';

test('2:1 with 25% bonus on destination: 160000 Esfera → 80000 + 20000 = 100000', () => {
    const r = convertPoints({ originPoints: 160000, from: 2, to: 1, bonusPercent: 25 });
    assert.equal(r.base, 80000);
    assert.equal(r.bonus, 20000);
    assert.equal(r.total, 100000);
});

test('conversion without bonus yields zero bonus', () => {
    const r = convertPoints({ originPoints: 160000, from: 2, to: 1, bonusPercent: 0 });
    assert.equal(r.base, 80000);
    assert.equal(r.bonus, 0);
    assert.equal(r.total, 80000);
});

test('inverse with bonus: 100000 Avios need 160000 origin', () => {
    const needed = originPointsNeeded({ destinationPoints: 100000, from: 2, to: 1, bonusPercent: 25 });
    assert.equal(needed, 160000);
});
