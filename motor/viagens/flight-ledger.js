/** Custo do dia de uma opção de voo: milhas, compra extra, clube e dinheiro. */

import { allocateOwnedAcquisition } from '../milhas/ledger.js';
import { clubMilheiro, clubValuePoints } from '../milhas/club.js';
import { originPointsNeeded } from '../milhas/convert.js';
import { flightPayWith, flightTravelers, simulationFinalCost } from './flight-simulation.js';
import { taxesToBrl } from './tax-fx.js';

function num(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'object' && value !== null && typeof value.toString === 'function') {
        const n = Number(value.toString());
        return Number.isFinite(n) ? n : 0;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function programOf(programs, id) {
    if (!id) return null;
    return (programs ?? []).find((p) => p.id === id) ?? null;
}

function buyMilheiroOf(program) {
    if (!program) return 0;
    return num(program.buyMilheiro ?? program.buy_milheiro);
}

/** Milheiro médio pago (extrato) ou o consolidado do dashboard. */
function paidStockMilheiroOf(program) {
    if (!program) return 0;
    const acq = num(program.acquisitionMilheiro ?? program.acquisition_milheiro);
    if (acq > 0) return acq;
    const dash = num(program.milheiro);
    if (dash > 0) return dash;
    return 0;
}

function acquisitionBucketsOf(program) {
    const raw = program?.acquisitionBuckets ?? program?.acquisition_buckets;
    if (!Array.isArray(raw) || !raw.length) return [];
    return raw
        .map((b) => ({
            key: b.key,
            label: b.label,
            points: Math.max(0, Math.round(Number(b.points) || 0)),
            amountBrl: num(b.amountBrl ?? b.amount_brl),
            milheiro: num(b.milheiro)
        }))
        .filter((b) => b.points > 0);
}

/**
 * @param {object} sim
 * @param {object[]} [programs]
 */
export function flightLedger(sim, programs = []) {
    const cash = simulationFinalCost(sim);
    const miles = sim?.miles && typeof sim.miles === 'object' ? sim.miles : {};
    const destPts = num(miles.destinationPoints ?? miles.destination_points);
    const hasMiles = destPts > 0;
    const origin = programOf(programs, miles.originProgramId ?? miles.origin_program_id);
    const dest = programOf(programs, miles.destinationProgramId ?? miles.destination_program_id) ?? origin;
    const storedBonus = num(miles.bonusPercent ?? miles.bonus_percent);
    const bonusActive = miles.bonusActive !== false && miles.bonus_active !== false;
    const bonusPercent = bonusActive ? storedBonus : 0;
    const walletBonus = num(origin?.transferBonusPercent ?? origin?.transfer_bonus_percent);
    const needed = hasMiles
        ? originPointsNeeded({
              destinationPoints: destPts,
              from: miles.conversionFrom ?? miles.conversion_from ?? 1,
              to: miles.conversionTo ?? miles.conversion_to ?? 1,
              bonusPercent
          })
        : 0;
    const have = num(origin?.available ?? origin?.balance);
    const gap = Math.max(0, needed - have);
    const ownedPts = Math.max(0, needed - gap);
    const buyMilheiro = buyMilheiroOf(origin);
    const stockMilheiro = paidStockMilheiroOf(origin);
    const clubRate = clubMilheiro(origin, have);
    const ownedRate = stockMilheiro > 0 ? stockMilheiro : clubRate > 0 ? clubRate : buyMilheiro;
    const milheiro = buyMilheiro;
    const extraBuy = gap > 0 && buyMilheiro > 0 ? (gap / 1000) * buyMilheiro : 0;
    const paidBuckets = acquisitionBucketsOf(origin);
    const ownedBreakdown =
        ownedPts > 0 && paidBuckets.length
            ? allocateOwnedAcquisition(paidBuckets, ownedPts, { buyMilheiro })
            : { lines: [], totalBrl: 0 };
    let ownedBrl =
        ownedBreakdown.lines.length > 0
            ? ownedBreakdown.totalBrl
            : ownedPts > 0 && stockMilheiro > 0
              ? (ownedPts / 1000) * stockMilheiro
              : ownedPts > 0 && clubRate > 0
                ? clubValuePoints(origin, ownedPts, have)
                : ownedPts > 0 && buyMilheiro > 0
                  ? (ownedPts / 1000) * buyMilheiro
                  : 0;
    const milesBrl = ownedBrl + extraBuy;
    const priced = milesBrl > 0 || (hasMiles && needed > 0 && (ownedRate > 0 || buyMilheiro > 0));
    const taxes = num(miles.taxesAmount ?? miles.taxes_amount);
    const taxesCurrency = String(miles.taxesCurrency ?? miles.taxes_currency ?? 'EUR').toUpperCase();
    const taxesBrl = taxesToBrl({
        amount: taxes,
        currency: taxesCurrency,
        fxRate: miles.taxFxRate ?? miles.tax_fx_rate,
        iofPercent: miles.taxIofPercent ?? miles.tax_iof_percent,
        spreadPercent: miles.taxSpreadPercent ?? miles.tax_spread_percent
    });
    const clubActive = Boolean(origin?.clubActive ?? origin?.club_active);
    const clubFee = clubActive ? num(origin?.clubFeeBrl ?? origin?.club_fee_brl) : 0;
    const dayValue = milesBrl + taxesBrl;
    const outlay = extraBuy + taxesBrl;
    let cheaper = null;
    if (cash > 0 && dayValue > 0) {
        cheaper = dayValue < cash ? 'points' : dayValue > cash ? 'cash' : 'tie';
    } else if (cash > 0) cheaper = 'cash';
    else if (dayValue > 0) cheaper = 'points';

    return {
        travelers: flightTravelers(sim),
        cash,
        hasMiles,
        destPts,
        destUnit: dest?.unit || 'pontos',
        originName: origin?.name ?? null,
        originId: origin?.id ?? null,
        destName: dest?.name ?? null,
        needed,
        have,
        gap,
        ownedPts,
        ownedBrl,
        ownedBreakdown,
        stockMilheiro,
        milheiro,
        priced,
        taxes,
        taxesCurrency,
        taxesBrl,
        bonusPercent,
        bonusStored: storedBonus,
        bonusOn: bonusPercent > 0,
        bonusActive: bonusPercent > 0,
        walletBonus,
        clubActive,
        clubFee,
        milesBrl,
        extraBuy,
        dayValue,
        outlay,
        cheaper
    };
}

/** Custo do caminho escolhido (milhas ou dinheiro). `null` se ainda não há valor. */
export function optionScore(sim, programs = []) {
    const L = flightLedger(sim, programs);
    if (usesMilesPath(sim, programs)) {
        return L.dayValue > 0 ? L.dayValue : null;
    }
    return L.cash > 0 ? L.cash : null;
}

export function usesMilesPath(sim, programs = []) {
    if (flightPayWith(sim) !== 'points') return false;
    const L = flightLedger(sim, programs);
    return Boolean(L.hasMiles);
}

function sumDayOf(simulations, programs) {
    let flights = 0;
    const clubs = new Map();
    for (const sim of simulations) {
        if (!sim) continue;
        const L = flightLedger(sim, programs);
        const usePoints = usesMilesPath(sim, programs);
        if (usePoints) {
            flights += L.milesBrl + L.taxesBrl;
            if (L.clubActive && L.originId && L.clubFee > 0) {
                const prev = clubs.get(L.originId) ?? { fee: L.clubFee, stock: false };
                clubs.set(L.originId, { fee: L.clubFee, stock: prev.stock || L.ownedPts > 0 });
            }
        } else {
            flights += L.cash;
        }
    }
    let club = 0;
    for (const row of clubs.values()) {
        if (!row.stock) club += row.fee;
    }
    return { flights, club, total: flights + club };
}

/**
 * Soma das opções registradas: caminho escolhido de cada voo + mensalidade
 * do clube uma vez por carteira usada em milhas.
 */
export function chosenDayTotal(simulations = [], programs = []) {
    return sumDayOf(
        simulations.filter((sim) => sim?.status === 'escolhida'),
        programs
    );
}

/** Voo escolhido do trecho; se ninguém foi marcado, o de menor custo. */
export function pickSegmentFlight(segment, programs = []) {
    const live = (segment?.simulations ?? []).filter((sim) => sim && sim.status !== 'descartada');
    if (!live.length) return null;
    const chosen = live.filter((sim) => sim.status === 'escolhida');
    const pool = chosen.length ? chosen : live;
    let best = pool[0];
    let bestScore = optionScore(best, programs);
    for (const sim of pool.slice(1)) {
        const score = optionScore(sim, programs);
        if (score == null) continue;
        if (bestScore == null || score < bestScore) {
            best = sim;
            bestScore = score;
        }
    }
    return best;
}

/** Melhor cenário da viagem: escolhido manda; senão, menor custo de cada trecho. */
export function tripFlightScenario(segments = [], programs = []) {
    const rows = [];
    for (const segment of segments ?? []) {
        const sim = pickSegmentFlight(segment, programs);
        if (!sim) continue;
        rows.push({
            segmentId: segment.id,
            title: segment.title || 'Trecho',
            sim,
            chosen: (segment.simulations ?? []).some((s) => s.status === 'escolhida')
        });
    }
    return {
        rows,
        totals: sumDayOf(
            rows.map((row) => row.sim),
            programs
        )
    };
}

function simOriginPointsNeed(sim) {
    const miles = sim?.miles && typeof sim.miles === 'object' ? sim.miles : {};
    if (miles.payWith && miles.payWith !== 'points') return null;
    const destPts = num(miles.destinationPoints ?? miles.destination_points);
    if (destPts <= 0) return null;
    const originId = miles.originProgramId ?? miles.origin_program_id;
    if (!originId) return null;
    const storedBonus = num(miles.bonusPercent ?? miles.bonus_percent);
    const bonusActive = miles.bonusActive !== false && miles.bonus_active !== false;
    const bonusPercent = bonusActive ? storedBonus : 0;
    const points = originPointsNeeded({
        destinationPoints: destPts,
        from: miles.conversionFrom ?? miles.conversion_from ?? 1,
        to: miles.conversionTo ?? miles.conversion_to ?? 1,
        bonusPercent
    });
    return { originProgramId: originId, points };
}

/**
 * Pontos a debitar na origem por carteira: soma voos escolhidos;
 * se o trecho ainda não tem escolhido, conta só o maior cenário do trecho.
 */
export function tripWalletPointsNeeded(segments = []) {
    const byOrigin = new Map();
    for (const segment of segments ?? []) {
        const live = (segment?.simulations ?? []).filter((sim) => sim && sim.status !== 'descartada');
        const needs = live.map(simOriginPointsNeed).filter(Boolean);
        if (!needs.length) continue;
        const chosenIds = new Set(live.filter((s) => s.status === 'escolhida').map((s) => s.id));
        const chosenNeeds = live
            .filter((s) => chosenIds.has(s.id))
            .map(simOriginPointsNeed)
            .filter(Boolean);
        const pool = chosenNeeds.length ? chosenNeeds : [needs.reduce((best, row) => (row.points > best.points ? row : best))];
        for (const row of pool) {
            byOrigin.set(row.originProgramId, (byOrigin.get(row.originProgramId) ?? 0) + row.points);
        }
    }
    return byOrigin;
}

export function cheapestOptionId(simulations = [], programs = []) {
    let bestId = null;
    let best = Number.POSITIVE_INFINITY;
    for (const sim of simulations) {
        if (!sim || sim.status === 'descartada') continue;
        const score = optionScore(sim, programs);
        if (score == null || score >= best) continue;
        best = score;
        bestId = sim.id;
    }
    return bestId;
}
