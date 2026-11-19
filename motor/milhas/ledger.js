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

export function acquisitionMilheiro(movements, programId) {
    let brl = new Decimal(0);
    let pts = new Decimal(0);
    for (const m of movements ?? []) {
        if (programIdOf(m) !== programId) continue;
        const raw = m.amountBrl ?? m.amount_brl;
        if (raw == null || raw === '') continue;
        const paid = new Decimal(raw);
        if (!paid.isFinite() || paid.eq(0)) continue;
        const p = new Decimal(ptsOf(m));
        if (m.type === 'compra') {
            brl = brl.plus(paid);
            pts = pts.plus(p);
        } else if (m.type === 'ajuste') {
            const sign = Number(m.pointsSign ?? m.points_sign) >= 0 ? 1 : -1;
            brl = brl.plus(paid.mul(sign));
            pts = pts.plus(p.mul(sign));
        }
    }
    if (pts.lte(0)) return new Decimal(0);
    return brl.div(pts.div(1000));
}
