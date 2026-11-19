import Decimal from 'decimal.js';

function dec(n) {
    const d = new Decimal(n ?? 0);
    return d.isFinite() ? d : new Decimal(0);
}

export function purchaseCost({ points, milheiro, discountPercent = 0, extraFee = 0 }) {
    const pts = Decimal.max(0, dec(points));
    const mil = Decimal.max(0, dec(milheiro));
    const disc = Decimal.max(0, dec(discountPercent));
    const fee = Decimal.max(0, dec(extraFee));
    const milheiros = pts.div(1000);
    const gross = milheiros.mul(mil);
    const afterDiscount = gross.mul(new Decimal(1).minus(disc.div(100)));
    const total = afterDiscount.plus(fee);
    const costPerPoint = pts.gt(0) ? total.div(pts) : new Decimal(0);
    const costPerMilheiro = milheiros.gt(0) ? total.div(milheiros) : new Decimal(0);
    return { gross, total, costPerPoint, costPerMilheiro };
}

export function money2(value) {
    return dec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
