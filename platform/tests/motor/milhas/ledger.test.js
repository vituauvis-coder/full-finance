import test from 'node:test';
import assert from 'node:assert/strict';
import {
    acquisitionBuckets,
    acquisitionMilheiro,
    allocateOwnedAcquisition,
    programBalance,
    setBalanceAdjustment
} from '../../../../motor/milhas/ledger.js';

const esfera = 'esfera-id';
const smiles = 'smiles-id';

test('balance credits minus debits; programs stay isolated', () => {
    const movements = [
        { id: '1', programId: esfera, type: 'ajuste', points: 90000, pointsSign: 1 },
        { id: '2', programId: esfera, type: 'compra', points: 20000, pointsSign: 1 },
        { id: '3', programId: esfera, type: 'transferencia_saida', points: 10000, pointsSign: 1 },
        { id: '4', programId: smiles, type: 'acumulo', points: 5000, pointsSign: 1 }
    ];
    assert.equal(programBalance(movements, esfera), 100000);
    assert.equal(programBalance(movements, smiles), 5000);
});

test('set-balance 90000 → 100000 yields +10000 adjustment', () => {
    const adj = setBalanceAdjustment({ current: 90000, target: 100000 });
    assert.deepEqual(adj, { points: 10000, pointsSign: 1 });
});

test('set-balance down yields negative sign', () => {
    const adj = setBalanceAdjustment({ current: 100000, target: 80000 });
    assert.deepEqual(adj, { points: 20000, pointsSign: -1 });
});

test('acquisition milheiro uses paid purchases and valued adjustments', () => {
    const movements = [
        { programId: esfera, type: 'compra', points: 50000, amountBrl: '700' },
        { programId: esfera, type: 'ajuste', points: 10000, pointsSign: 1, amountBrl: '140' }
    ];
    const m = acquisitionMilheiro(movements, esfera);
    assert.equal(m.toString(), '14');
});

test('acquisition milheiro blends club acumulo and compra lots', () => {
    const movements = [
        { programId: esfera, type: 'acumulo', points: 25000, amountBrl: '799', source: 'clube' },
        { programId: esfera, type: 'compra', points: 103000, amountBrl: '3605' }
    ];
    const m = acquisitionMilheiro(movements, esfera);
    assert.equal(m.toFixed(2), '34.41');
});

test('acquisition buckets split assinatura and compra', () => {
    const movements = [
        { programId: esfera, type: 'acumulo', points: 25000, amountBrl: '800' },
        { programId: esfera, type: 'compra', points: 103000, amountBrl: '3605' }
    ];
    const buckets = acquisitionBuckets(movements, esfera);
    assert.equal(buckets.length, 2);
    const sub = buckets.find((b) => b.key === 'assinatura');
    const buy = buckets.find((b) => b.key === 'compra');
    assert.equal(sub.points, 25000);
    assert.equal(sub.amountBrl.toString(), '800');
    assert.equal(buy.points, 103000);
    assert.equal(buy.amountBrl.toString(), '3605');
});

test('allocate owned cost proportional to paid lots', () => {
    const movements = [
        { programId: esfera, type: 'acumulo', points: 25000, amountBrl: '800' },
        { programId: esfera, type: 'compra', points: 103000, amountBrl: '3605' }
    ];
    const buckets = acquisitionBuckets(movements, esfera);
    const split = allocateOwnedAcquisition(buckets, 128000);
    assert.equal(split.lines.length, 2);
    assert.equal(Number(split.totalBrl.toFixed(2)), 4405);
    assert.equal(split.lines.find((l) => l.key === 'assinatura')?.amountBrl, 800);
    assert.equal(Number(split.lines.find((l) => l.key === 'compra')?.amountBrl.toFixed(2)), 3605);
});
