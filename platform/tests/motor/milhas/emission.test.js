import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildDashboard,
    compareEmissionOptions,
    emissionOptionCost
} from '../../../../motor/milhas/emission.js';

const sim = {
    conversionFrom: 2,
    conversionTo: 1,
    bonusPercent: 25,
    buyMilheiro: 14,
    buyDiscountPercent: 0,
    buyExtraFee: 0,
    fxRate: '6.20',
    iofPercent: '3.5',
    spreadPercent: 2,
    clubFeeBrl: 0
};

const optionA = { id: 'A', destinationPoints: 100000, taxesAmount: '283.16', taxesCurrency: 'EUR' };

test('emission outlay excludes owned points; economic includes acquisition milheiro', () => {
    const r = emissionOptionCost(sim, optionA, 160000, 14);
    assert.equal(r.originNeeded, 160000);
    assert.equal(r.ownPoints, 160000);
    assert.equal(r.pointsToBuy, 0);
    assert.equal(r.buyCost.toString(), '0');
    assert.equal(r.taxesBrl.toString(), '1853.3784744');
    assert.equal(r.outlay.toString(), '1853.3784744');
    assert.equal(r.sunk.toString(), '2240');
    assert.equal(r.economic.toString(), '4093.3784744');
});

test('missing points add purchase cost to outlay', () => {
    const r = emissionOptionCost(sim, optionA, 80000, 14);
    assert.equal(r.pointsToBuy, 80000);
    assert.equal(r.buyCost.toString(), '1120');
    assert.equal(r.outlay.toString(), '2973.3784744');
});

test('compare flags lowest outlay, economic and best value', () => {
    const cheapTaxes = { id: 'B', destinationPoints: 100000, taxesAmount: '100', taxesCurrency: 'EUR' };
    const rows = compareEmissionOptions(sim, [optionA, cheapTaxes], 160000, 14);
    assert.equal(rows.lowestOutlayId, 'B');
    assert.equal(rows.lowestEconomicId, 'B');
    assert.equal(rows.bestValueId, 'B');
    assert.equal(rows.options[0].id, 'A');
});

test('dashboard milheiro prefers weighted acquisition from extrato when present', () => {
    const dash = buildDashboard({
        programs: [
            {
                id: 'esfera',
                clubActive: true,
                clubFeeBrl: 800,
                clubPointsPerMonth: 0,
                buyMilheiro: 17
            }
        ],
        movements: [
            {
                programId: 'esfera',
                type: 'acumulo',
                source: 'clube',
                points: 25000,
                pointsSign: 1,
                amountBrl: '800'
            },
            { programId: 'esfera', type: 'ajuste', points: 0, pointsSign: 1, amountBrl: '75' }
        ],
        reservedSims: []
    });
    assert.equal(Number(dash.programs[0].invested), 800);
    assert.equal(Number(dash.programs[0].milheiro), 35);
});
