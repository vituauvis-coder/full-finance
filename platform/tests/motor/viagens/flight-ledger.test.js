import test from 'node:test';
import assert from 'node:assert/strict';
import { chosenDayTotal, flightLedger, optionScore, pickSegmentFlight, tripFlightScenario } from '../../../../motor/viagens/flight-ledger.js';
import { emptyFlightSimulation, flightPayWith, flightTravelers, normalizeFlightSimulation } from '../../../../motor/viagens/flight-simulation.js';

const esfera = {
    id: 'esfera',
    name: 'Esfera',
    unit: 'pontos',
    available: 0,
    buyMilheiro: 17,
    clubActive: true,
    clubFeeBrl: 49
};

function sim(patch = {}) {
    return normalizeFlightSimulation({
        amount: 4500,
        travelers: 2,
        miles: {
            destinationPoints: 25000,
            originProgramId: 'esfera',
            destinationProgramId: 'esfera',
            conversionFrom: 1,
            conversionTo: 1,
            bonusPercent: 0,
            taxesAmount: 50,
            taxesCurrency: 'EUR'
        },
        ...patch
    });
}

test('baggage pieces migrate from the old included flag', () => {
    const fromFlag = normalizeFlightSimulation({ baggageIncluded: true });
    assert.equal(fromFlag.baggage.kg23, 1);
    assert.equal(fromFlag.baggageIncluded, true);
    const fromPieces = normalizeFlightSimulation({ baggage: { kg10: 2, kg23: 1 } });
    assert.equal(fromPieces.baggage.kg10, 2);
    assert.equal(fromPieces.baggageIncluded, true);
    const empty = normalizeFlightSimulation({});
    assert.equal(empty.baggageIncluded, false);
    assert.equal(empty.baggage.kg10, 0);
});

test('travelers default to 1 and cap at 9', () => {
    assert.equal(flightTravelers({}), 1);
    assert.equal(emptyFlightSimulation().travelers, 1);
    assert.equal(normalizeFlightSimulation({ travelers: 3 }).travelers, 3);
    assert.equal(normalizeFlightSimulation({ passengers: 4 }).travelers, 4);
    assert.equal(flightTravelers({ travelers: 99 }), 9);
});

test('ledger prices extra buy, converts EUR tax to BRL, and keeps club off the flight', () => {
    const L = flightLedger(sim(), [esfera]);
    assert.equal(L.travelers, 2);
    assert.equal(L.needed, 25000);
    assert.equal(L.gap, 25000);
    assert.equal(L.extraBuy, 425);
    assert.equal(L.milesBrl, 425);
    assert.equal(L.taxesCurrency, 'EUR');
    assert.equal(L.taxesBrl, 317.5);
    assert.equal(L.clubFee, 49);
    assert.equal(L.dayValue, 742.5);
    assert.equal(L.cheaper, 'points');
    assert.equal(L.bonusOn, false);
});

test('transfer bonus reduces origin needed and flags the bonus as on', () => {
    const L = flightLedger(
        sim({
            miles: {
                destinationPoints: 25000,
                originProgramId: 'esfera',
                destinationProgramId: 'avios',
                conversionFrom: 1,
                conversionTo: 1,
                bonusPercent: 80
            }
        }),
        [esfera, { id: 'avios', name: 'Avios', unit: 'avios', available: 0 }]
    );
    assert.equal(L.bonusOn, true);
    assert.equal(L.bonusPercent, 80);
    assert.ok(L.needed < 25000);
});

test('owned points still count in day value; extra buy is only the gap', () => {
    const L = flightLedger(sim(), [{ ...esfera, clubActive: false, available: 25000 }]);
    assert.equal(L.gap, 0);
    assert.equal(L.extraBuy, 0);
    assert.equal(L.ownedPts, 25000);
    assert.equal(L.ownedBrl, 425);
    assert.equal(L.milesBrl, 425);
    assert.equal(L.dayValue, 742.5);
});

test('day value splits owned reais from extra buy', () => {
    const L = flightLedger(sim(), [{ ...esfera, clubActive: false, available: 10000 }]);
    assert.equal(L.ownedPts, 10000);
    assert.equal(L.ownedBrl, 170);
    assert.equal(L.extraBuy, 255);
    assert.equal(L.ownedBrl + L.extraBuy, L.milesBrl);
    assert.equal(L.dayValue, 742.5);
});

test('owned club points are the monthly fee, extra buy stays on the buy milheiro', () => {
    const L = flightLedger(
        sim({
            amount: 0,
            miles: {
                destinationPoints: 200000,
                originProgramId: 'esfera',
                conversionFrom: 1,
                conversionTo: 1,
                bonusPercent: 0,
                taxesAmount: 1800,
                taxesCurrency: 'BRL'
            }
        }),
        [
            {
                ...esfera,
                clubFeeBrl: 800,
                clubPointsPerMonth: 20000,
                clubBonusPerMonth: 5000,
                buyMilheiro: 35,
                available: 25000
            }
        ]
    );
    assert.equal(L.ownedPts, 25000);
    assert.equal(L.ownedBrl, 800);
    assert.equal(L.gap, 175000);
    assert.equal(L.extraBuy, 6125);
    assert.equal(L.taxesBrl, 1800);
    assert.equal(L.dayValue, 8725);
    assert.equal(L.milheiro, 35);
});

test('two leftover club points do not add cents to the monthly fee', () => {
    const L = flightLedger(
        sim({
            amount: 0,
            miles: {
                destinationPoints: 200000,
                originProgramId: 'esfera',
                conversionFrom: 1,
                conversionTo: 1,
                bonusPercent: 0,
                taxesAmount: 0,
                taxesCurrency: 'BRL'
            }
        }),
        [
            {
                ...esfera,
                clubFeeBrl: 800,
                clubPointsPerMonth: 25000,
                buyMilheiro: 35,
                available: 25002
            }
        ]
    );
    assert.equal(L.ownedPts, 25002);
    assert.equal(L.ownedBrl, 800);
});

test('chosen day total charges club once per wallet', () => {
    const a = sim({ status: 'escolhida', amount: 0, id: 'a' });
    const b = sim({ status: 'escolhida', amount: 0, id: 'b' });
    const t = chosenDayTotal([a, b], [esfera]);
    assert.equal(t.flights, 1485);
    assert.equal(t.club, 49);
    assert.equal(t.total, 1534);
});

test('normalize infers payWith from destination points when omitted', () => {
    assert.equal(flightPayWith(emptyFlightSimulation()), 'cash');
    assert.equal(normalizeFlightSimulation({ miles: { destinationPoints: 10 } }).miles.payWith, 'points');
    assert.equal(
        normalizeFlightSimulation({ miles: { destinationPoints: 10, payWith: 'cash' } }).miles.payWith,
        'cash'
    );
});

test('option score uses the selected path, not the cheaper of both', () => {
    assert.equal(optionScore(sim(), [esfera]), 742.5);
    assert.equal(optionScore(sim({ amount: 400, extrasAmount: 0 }), [esfera]), 742.5);
    assert.equal(
        optionScore(
            sim({
                amount: 400,
                extrasAmount: 0,
                miles: { destinationPoints: 0, payWith: 'cash' }
            }),
            [esfera]
        ),
        400
    );
});

test('bonus can be switched off without losing the stored rate', () => {
    const miles = {
        destinationPoints: 100000,
        originProgramId: 'esfera',
        destinationProgramId: 'avios',
        conversionFrom: 2,
        conversionTo: 1,
        bonusPercent: 25,
        bonusActive: false
    };
    const wallets = [esfera, { id: 'avios', name: 'Avios', unit: 'avios', available: 0 }];
    const off = flightLedger(sim({ amount: 0, miles }), wallets);
    const on = flightLedger(sim({ amount: 0, miles: { ...miles, bonusActive: true } }), wallets);
    assert.equal(off.bonusOn, false);
    assert.equal(off.bonusStored, 25);
    assert.equal(off.needed, on.needed * 1.25);
    assert.ok(on.needed < off.needed);
});

test('BRL tax still counts in the day without a milheiro; club stays on the wallet', () => {
    const L = flightLedger(
        sim({
            amount: 0,
            miles: {
                destinationPoints: 100000,
                originProgramId: 'esfera',
                taxesAmount: 1800,
                taxesCurrency: 'BRL',
                conversionFrom: 1,
                conversionTo: 1,
                bonusPercent: 25
            }
        }),
        [{ ...esfera, buyMilheiro: 0, milheiro: 0, clubFeeBrl: 800, available: 25000 }]
    );
    assert.equal(L.taxesBrl, 1800);
    assert.equal(L.clubFee, 800);
    assert.equal(L.ownedBrl, 800);
    assert.equal(L.dayValue, 2600);
});

test('segment pick prefers escolhida over a cheaper option', () => {
    const cheap = sim({ id: 'cheap', status: 'candidata', amount: 400, extrasAmount: 0, miles: { destinationPoints: 0 } });
    const picked = sim({ id: 'picked', status: 'escolhida', amount: 900, extrasAmount: 0, miles: { destinationPoints: 0 } });
    const segment = { id: 's1', title: 'Trecho 1', simulations: [cheap, picked] };
    assert.equal(pickSegmentFlight(segment, []).id, 'picked');
    cheap.status = 'candidata';
    picked.status = 'candidata';
    assert.equal(pickSegmentFlight(segment, []).id, 'cheap');
});

test('trip scenario totals the picked flights, mixing miles and cash', () => {
    const milesSim = sim({ id: 'm', status: 'escolhida', amount: 0 });
    const cashSim = sim({
        id: 'c',
        status: 'candidata',
        amount: 300,
        extrasAmount: 0,
        miles: { destinationPoints: 0 }
    });
    const scene = tripFlightScenario(
        [
            { id: 'a', title: 'Ida', simulations: [milesSim] },
            { id: 'b', title: 'Volta', simulations: [cashSim] }
        ],
        [esfera]
    );
    assert.equal(scene.rows.length, 2);
    assert.equal(scene.rows[0].chosen, true);
    assert.equal(scene.rows[1].chosen, false);
    assert.equal(scene.totals.flights, 742.5 + 300);
});
