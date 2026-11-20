import Decimal from 'decimal.js';

export const DEBIT_TYPES = new Set(['transferencia_saida', 'emissao', 'expiracao']);
export const CREDIT_TYPES = new Set(['acumulo', 'compra', 'transferencia_entrada', 'bonus']);

function ptsOf(m) {
    return Math.max(0, Math.round(Number(m?.points) || 0));
}

function programIdOf(m) {
    return m?.programId ?? m?.program_id;
}

export function movementDelta(m) {
    const pts = ptsOf(m);
    if (m?.type === 'ajuste') {
        const sign = Number(m.pointsSign ?? m.points_sign) >= 0 ? 1 : -1;
        return pts * sign;
    }
    if (DEBIT_TYPES.has(m?.type)) return -pts;
    if (CREDIT_TYPES.has(m?.type)) return pts;
    return 0;
}

export function programBalance(movements, programId) {
    return (movements ?? []).reduce((n, m) => {
        if (programIdOf(m) !== programId) return n;
        return n + movementDelta(m);
    }, 0);
}

export function setBalanceAdjustment({ current, target }) {
    const cur = Math.max(0, Math.round(Number(current) || 0));
    const tgt = Math.max(0, Math.round(Number(target) || 0));
    const delta = tgt - cur;
    if (delta === 0) return null;
    return { points: Math.abs(delta), pointsSign: delta > 0 ? 1 : -1 };
}

function paidLotKinds(m) {
    if (m.type === 'compra') return 'compra';
    if (m.type === 'acumulo' || m.type === 'bonus') return 'assinatura';
    if (m.type === 'ajuste') return 'ajuste';
    return null;
}

function emptyBucket(key, label) {
    return { key, label, pts: new Decimal(0), brl: new Decimal(0) };
}

/** Pontos pagos por origem (assinatura/clube vs compra) para detalhar custo. */
export function acquisitionBuckets(movements, programId) {
    const map = {
        assinatura: emptyBucket('assinatura', 'Assinatura'),
        compra: emptyBucket('compra', 'Compra'),
        ajuste: emptyBucket('ajuste', 'Ajuste')
    };
    for (const m of movements ?? []) {
        if (programIdOf(m) !== programId) continue;
        const kind = paidLotKinds(m);
        if (!kind) continue;
        const raw = m.amountBrl ?? m.amount_brl;
        if (raw == null || raw === '') continue;
        const paid = new Decimal(raw);
        if (!paid.isFinite() || paid.eq(0)) continue;
        const p = new Decimal(ptsOf(m));
        const bucket = map[kind];
        if (m.type === 'ajuste') {
            const sign = Number(m.pointsSign ?? m.points_sign) >= 0 ? 1 : -1;
            bucket.brl = bucket.brl.plus(paid.mul(sign));
            bucket.pts = bucket.pts.plus(p.mul(sign));
        } else {
            bucket.brl = bucket.brl.plus(paid);
            bucket.pts = bucket.pts.plus(p);
        }
    }
    return Object.values(map)
        .filter((b) => b.pts.gt(0))
        .map((b) => ({
            key: b.key,
            label: b.label,
            points: b.pts.toNumber(),
            amountBrl: b.brl,
            milheiro: b.brl.div(b.pts.div(1000))
        }));
}

const BUCKET_FIFO = ['assinatura', 'compra', 'ajuste'];

function milheiroOfBucket(b) {
    const lotPts = new Decimal(b.points ?? 0);
    if (lotPts.lte(0)) return new Decimal(0);
    if (b.milheiro != null && b.milheiro !== '') return new Decimal(b.milheiro);
    return new Decimal(b.amountBrl ?? b.amount_brl ?? 0).div(lotPts.div(1000));
}

/** Consome assinatura antes de compra; falta sem lote usa milheiro de compra declarado. */
export function allocateOwnedAcquisition(buckets, ownedPts, opts = {}) {
    const need = Math.max(0, Math.round(Number(ownedPts) || 0));
    const buyMilheiro = Math.max(0, Number(opts.buyMilheiro) || 0);
  const list = (buckets ?? [])
        .filter((b) => (b.points ?? 0) > 0)
        .sort(
            (a, b) =>
                (BUCKET_FIFO.indexOf(a.key) < 0 ? 9 : BUCKET_FIFO.indexOf(a.key)) -
                (BUCKET_FIFO.indexOf(b.key) < 0 ? 9 : BUCKET_FIFO.indexOf(b.key))
        );
    if (need <= 0) return { lines: [], totalBrl: 0 };

    let remaining = need;
    let totalBrl = new Decimal(0);
    const lines = [];
    for (const b of list) {
        if (remaining <= 0) break;
        const lotPts = Math.max(0, Math.round(Number(b.points)));
        const take = Math.min(remaining, lotPts);
        if (take <= 0) continue;
        const mil = milheiroOfBucket(b);
        const brl = new Decimal(take).div(1000).mul(mil);
        totalBrl = totalBrl.plus(brl);
        lines.push({
            key: b.key,
            label: b.label ?? b.key,
            points: take,
            amountBrl: brl.toNumber(),
            milheiro: mil.toNumber()
        });
        remaining -= take;
    }
    if (remaining > 0 && buyMilheiro > 0) {
        const brl = new Decimal(remaining).div(1000).mul(buyMilheiro);
        totalBrl = totalBrl.plus(brl);
        const compra = lines.find((row) => row.key === 'compra');
        if (compra) {
            compra.points += remaining;
            compra.amountBrl += brl.toNumber();
        } else {
            lines.push({
                key: 'compra',
                label: 'Compra',
                points: remaining,
                amountBrl: brl.toNumber(),
                milheiro: buyMilheiro
            });
        }
    }
    return { lines, totalBrl: totalBrl.toNumber() };
}

export function acquisitionMilheiro(movements, programId) {
    let brl = new Decimal(0);
    let pts = new Decimal(0);
    for (const m of movements ?? []) {
        if (programIdOf(m) !== programId) continue;
        const kind = paidLotKinds(m);
        if (!kind) continue;
        const raw = m.amountBrl ?? m.amount_brl;
        if (raw == null || raw === '') continue;
        const paid = new Decimal(raw);
        if (!paid.isFinite() || paid.eq(0)) continue;
        const p = new Decimal(ptsOf(m));
        if (m.type === 'ajuste') {
            const sign = Number(m.pointsSign ?? m.points_sign) >= 0 ? 1 : -1;
            brl = brl.plus(paid.mul(sign));
            pts = pts.plus(p.mul(sign));
        } else {
            brl = brl.plus(paid);
            pts = pts.plus(p);
        }
    }
    if (pts.lte(0)) return new Decimal(0);
    return brl.div(pts.div(1000));
}
