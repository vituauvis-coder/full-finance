import test from 'node:test';
import assert from 'node:assert/strict';
import {
    acquisitionMilheiro,
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
