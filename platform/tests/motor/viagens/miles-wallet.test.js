import test from 'node:test';
import assert from 'node:assert/strict';
import {
    compareCashVsPoints,
    defaultMilesWallet,
    normalizeMilesWallet
} from '../../../../motor/viagens/miles-wallet.js';
import { searchAirportsCatalog } from '../../../../motor/viagens/airports-catalog.js';
import {
    connectionsCountLabel,
    duplicateFlightSimulation,
    googleFlightsSearchURL,
    nextFlightStatus,
    simulationFinalCost
} from '../../../../motor/viagens/flight-simulation.js';
import { mergeFinancePreferences } from '../../../../motor/dinheiro/finance-preferences.js';

test('wallet always keeps Esfera', () => {
    const empty = normalizeMilesWallet({ programs: [] });
    assert.equal(empty.programs[0].brand, 'esfera');
    const fromDefault = defaultMilesWallet();
    assert.equal(fromDefault.programs[0].name, 'Esfera');
});

test('compareCashVsPoints prefers award when cheaper', () => {
    const r = compareCashVsPoints({ cashBrl: 6052, pointsRequired: 300000, milheiroBrl: 14, balance: 400000 });
    assert.equal(r.enoughPoints, true);
    assert.ok(r.pointsCostBrl > 0);
    assert.equal(r.cheaper, 'points');
    assert.ok(r.savingBrl > 0);
});

test('compareCashVsPoints flags missing points', () => {
    const r = compareCashVsPoints({ cashBrl: 1000, pointsRequired: 80000, milheiroBrl: 14, balance: 10000 });
    assert.equal(r.enoughPoints, false);
    assert.equal(r.missingPoints, 70000);
});

test('airport catalog finds Recife and Madri', () => {
    const rec = searchAirportsCatalog('rec');
    assert.equal(rec[0].iata, 'REC');
    const mad = searchAirportsCatalog('madri');
    assert.equal(mad[0].iata, 'MAD');
});

test('flight helpers', () => {
    assert.equal(nextFlightStatus('candidata'), 'escolhida');
    assert.equal(simulationFinalCost({ amount: 6125, extrasAmount: 1800 }), 7925);
    assert.equal(connectionsCountLabel({ connections: [], isRoundTrip: true, returnConnections: [] }), 'Direto · ida e volta');
    const dup = duplicateFlightSimulation({ id: 'a', label: 'Taxa Iberia', status: 'escolhida', amount: 10 });
    assert.notEqual(dup.id, 'a');
    assert.equal(dup.status, 'candidata');
    assert.equal(dup.label, 'Taxa Iberia (cópia)');
});

test('googleFlightsSearchURL encodes origin and date', () => {
    const url = googleFlightsSearchURL({
        origin: 'Recife (REC)',
        destination: 'Madri (MAD)',
        departsOn: '2026-05-01T10:00',
        returnOn: '2026-05-20T18:00'
    });
    assert.ok(url.includes('google.com/travel/flights'));
    assert.ok(url.includes('REC'));
    assert.ok(url.includes('2026-05-01'));
});

test('mergeFinancePreferences keeps miles when cash-out is patched', () => {
    const merged = mergeFinancePreferences(
        { manualCashOut: { enabled: true }, viagensMiles: { programs: [{ brand: 'esfera', balance: 90000 }] } },
        { manualCashOut: { enabled: false, creditCard: true } }
    );
    assert.equal(merged.manualCashOut.enabled, false);
    assert.equal(merged.manualCashOut.creditCard, true);
    assert.equal(merged.viagensMiles.programs[0].balance, 90000);
});
