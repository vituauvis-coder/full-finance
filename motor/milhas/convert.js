import Decimal from 'decimal.js';

function asPoints(n) {
    const d = new Decimal(n ?? 0);
    if (!d.isFinite() || d.lt(0)) return 0;
    return d.toDecimalPlaces(0, Decimal.ROUND_DOWN).toNumber();
}

function applyRound(decimal, round) {
    return round === 'up'
        ? decimal.toDecimalPlaces(0, Decimal.ROUND_CEIL).toNumber()
        : decimal.toDecimalPlaces(0, Decimal.ROUND_FLOOR).toNumber();
}

export function convertPoints({ originPoints, from, to, bonusPercent = 0, round = 'down' }) {
    const origin = asPoints(originPoints);
    const a = Math.max(1, Math.trunc(Number(from) || 1));
    const b = Math.max(1, Math.trunc(Number(to) || 1));
    const bonus = new Decimal(bonusPercent || 0);
    const base = applyRound(new Decimal(origin).mul(b).div(a), round);
    const extra = bonus.lte(0) ? 0 : applyRound(new Decimal(base).mul(bonus).div(100), round);
    return { base, bonus: extra, total: base + extra };
}

export function originPointsNeeded({ destinationPoints, from, to, bonusPercent = 0, round = 'down' }) {
    const dest = asPoints(destinationPoints);
    if (dest === 0) return 0;
    const a = Math.max(1, Math.trunc(Number(from) || 1));
    const b = Math.max(1, Math.trunc(Number(to) || 1));
    const factor = new Decimal(b).div(a).mul(new Decimal(1).plus(new Decimal(bonusPercent || 0).div(100)));
    if (factor.lte(0)) return dest;
    let guess = new Decimal(dest).div(factor).toDecimalPlaces(0, Decimal.ROUND_CEIL).toNumber();
    const covers = (n) => convertPoints({ originPoints: n, from: a, to: b, bonusPercent, round }).total >= dest;
    while (!covers(guess)) guess += 1;
    while (guess > 0 && covers(guess - 1)) guess -= 1;
    return guess;
}
