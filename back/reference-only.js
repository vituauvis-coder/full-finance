/**
 * Lançamentos com competência antes do mês âncora financeiro são só referência (não entram no ledger oficial).
 */
import { query } from './db.js';

export function movementMonthKey(d) {
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return null;
    return x.getFullYear() * 12 + x.getMonth();
}

export function anchorMonthKey(anchorMonthDate, createdAtFallback) {
    const raw = anchorMonthDate || createdAtFallback;
    if (!raw) return null;
    const a = new Date(raw);
    if (Number.isNaN(a.getTime())) return null;
    return a.getFullYear() * 12 + a.getMonth();
}

/** true se o movimento é estritamente anterior ao mês âncora (só visual). */
export function computeReferenceOnlyFromUserRow(movementDate, userRow) {
    if (!userRow) return false;
    const mk = movementMonthKey(movementDate);
    const ak = anchorMonthKey(userRow.financeAnchorMonth, userRow.createdAt);
    if (mk == null || ak == null) return false;
    return mk < ak;
}

export async function referenceOnlyForUserMovement(userId, movementDate) {
    const { rows } = await query(
        `SELECT finance_anchor_month AS "financeAnchorMonth", created_at AS "createdAt"
         FROM users
         WHERE id = $1`,
        [userId]
    );
    return computeReferenceOnlyFromUserRow(movementDate, rows[0]);
}
