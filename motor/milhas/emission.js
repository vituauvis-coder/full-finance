import Decimal from 'decimal.js';
import { originPointsNeeded } from './convert.js';
import { purchaseCost } from './purchase.js';
import { clubInvested, clubMilheiro, clubPricesStock } from './club.js';
import { acquisitionBuckets, acquisitionMilheiro, programBalance } from './ledger.js';

function dec(n) {
    const d = new Decimal(n ?? 0);
    return d.isFinite() ? d : new Decimal(0);
}

function simField(sim, camel, snake) {
    return sim[camel] ?? sim[snake];
}

export function emissionOptionCost(sim, option, originBalance, acquisitionMilheiroValue) {
    const from = simField(sim, 'conversionFrom', 'conversion_from');
    const to = simField(sim, 'conversionTo', 'conversion_to');
    const bonusPercent = simField(sim, 'bonusPercent', 'bonus_percent') ?? 0;
    const round = simField(sim, 'pointsRound', 'points_round') ?? 'down';
    const destPts = option.destinationPoints ?? option.destination_points ?? 0;
    const originNeeded = originPointsNeeded({
        destinationPoints: destPts,
        from,
        to,
        bonusPercent,
        round
    });
    const available = Math.max(0, Math.round(Number(originBalance) || 0));
    const ownPoints = Math.min(available, originNeeded);
    const pointsToBuy = originNeeded - ownPoints;
    const buy = purchaseCost({
        points: pointsToBuy,
        milheiro: simField(sim, 'buyMilheiro', 'buy_milheiro') ?? 0,
        discountPercent: simField(sim, 'buyDiscountPercent', 'buy_discount_percent') ?? 0,
        extraFee: simField(sim, 'buyExtraFee', 'buy_extra_fee') ?? 0
    });
    const taxesBrl = dec(option.taxesAmount ?? option.taxes_amount)
        .mul(dec(simField(sim, 'fxRate', 'fx_rate')))
        .mul(new Decimal(1).plus(dec(simField(sim, 'iofPercent', 'iof_percent')).div(100)))
        .mul(new Decimal(1).plus(dec(simField(sim, 'spreadPercent', 'spread_percent')).div(100)));
    const outlay = buy.total.plus(taxesBrl).plus(dec(simField(sim, 'clubFeeBrl', 'club_fee_brl')));
    const sunk = new Decimal(ownPoints).div(1000).mul(dec(acquisitionMilheiroValue));
    const economic = outlay.plus(sunk);
    const destMilheiros = new Decimal(destPts || 0).div(1000);
    const valueScore = destMilheiros.gt(0) ? economic.div(destMilheiros) : null;
    return {
        id: option.id,
        originNeeded,
        ownPoints,
        pointsToBuy,
        buyCost: buy.total,
        taxesBrl,
        outlay,
        sunk,
        economic,
        valueScore
    };
}

function pickMin(rows, key) {
    let best = null;
    for (const row of rows) {
        const val = row[key];
        if (val == null) continue;
        if (!best || val.lt(best.val)) best = { id: row.id, val };
    }
    return best?.id ?? null;
}

export function compareEmissionOptions(sim, options, originBalance, acquisitionMilheiroValue) {
    const computed = (options ?? []).map((opt) => ({
        ...opt,
        ...emissionOptionCost(sim, opt, originBalance, acquisitionMilheiroValue)
    }));
    const cheapestOutlay = computed.reduce((m, r) => (!m || r.outlay.lt(m.outlay) ? r : m), null);
    return {
        options: computed,
        lowestOutlayId: pickMin(computed, 'outlay'),
        lowestEconomicId: pickMin(computed, 'economic'),
        bestValueId: pickMin(computed, 'valueScore'),
        diffs: computed.map((r) => ({
            id: r.id,
            outlayVsBest: cheapestOutlay ? r.outlay.minus(cheapestOutlay.outlay) : new Decimal(0)
        }))
    };
}

export function originNeededForSim(sim, option) {
    return originPointsNeeded({
        destinationPoints: option.destinationPoints ?? option.destination_points ?? 0,
        from: simField(sim, 'conversionFrom', 'conversion_from'),
        to: simField(sim, 'conversionTo', 'conversion_to'),
        bonusPercent: simField(sim, 'bonusPercent', 'bonus_percent') ?? 0,
        round: simField(sim, 'pointsRound', 'points_round') ?? 'down'
    });
}

export function committedPoints({ reservedSims, programId, excludeSimId, excludeFlightSimulationId }) {
    let n = 0;
    for (const sim of reservedSims ?? []) {
        if ((sim.originProgramId ?? sim.origin_program_id) !== programId) continue;
        if (excludeSimId && sim.id === excludeSimId) continue;
        const flightId = sim.flightSimulationId ?? sim.flight_simulation_id;
        if (excludeFlightSimulationId && flightId === excludeFlightSimulationId) continue;
        const options = sim.options ?? [];
        const chosen =
            options.find((o) => o.id === (sim.chosenOptionId ?? sim.chosen_option_id)) ??
            options[0];
        if (!chosen) continue;
        n += originNeededForSim(sim, chosen);
    }
    return n;
}

export function buildDashboard({ programs, movements, reservedSims, recentLimit = 8, excludeFlightSimulationId }) {
    const rows = (programs ?? []).map((p) => {
        const balance = programBalance(movements, p.id);
        const acquired = acquisitionMilheiro(movements, p.id);
        const declared = Number(p.buyMilheiro ?? p.buy_milheiro) || 0;
        const clubRate = clubMilheiro(p, balance);
        const milheiro = acquired.gt(0)
            ? acquired
            : clubRate > 0
              ? new Decimal(clubRate)
              : declared > 0
                ? new Decimal(declared)
                : new Decimal(0);
        const committed = committedPoints({ reservedSims, programId: p.id, excludeFlightSimulationId });
        const invested = clubPricesStock(p)
            ? new Decimal(clubInvested(p, balance))
            : (movements ?? []).reduce((acc, m) => {
                  if ((m.programId ?? m.program_id) !== p.id) return acc;
                  const raw = m.amountBrl ?? m.amount_brl;
                  if (raw == null || raw === '') return acc;
                  return acc.plus(dec(raw));
              }, new Decimal(0));
        const buckets = acquisitionBuckets(movements, p.id).map((b) => ({
            key: b.key,
            label: b.label,
            points: Math.round(b.points),
            amountBrl: b.amountBrl.toString(),
            milheiro: b.milheiro.toString()
        }));
        return {
            ...p,
            balance,
            committed,
            available: Math.max(0, balance - committed),
            acquisitionMilheiro: acquired,
            acquisitionBuckets: buckets,
            milheiro,
            invested
        };
    });
    const recent = [...(movements ?? [])]
        .sort((a, b) => String(b.occurredOn ?? b.occurred_on ?? b.createdAt ?? '').localeCompare(String(a.occurredOn ?? a.occurred_on ?? a.createdAt ?? '')))
        .slice(0, recentLimit);
    return { programs: rows, recent };
}
