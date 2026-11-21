/**
 * Lança o Gain de estorno de rateio quando a decisão de negócio permitir.
 */
import crypto from 'node:crypto';
import {
    shouldPostSplitReimbursementOnAccept,
    shouldPostSplitReimbursementOnRecipientPaid
} from '../motor/dinheiro/split-reimbursement-on-accept.js';
import { referenceOnlyForUserMovement } from './reference-only.js';

/**
 * @param {import('pg').PoolClient | { query: Function }} db
 * @param {{
 *   split: {
 *     id: string,
 *     sourceExpenseId: string,
 *     requesterUserId: string,
 *     amount: number,
 *     requesterCreditAccountId: string,
 *     splitScope?: string,
 *     createdGainId?: string|null
 *   },
 *   sourcePaymentType: string|null|undefined,
 *   sourceInstallmentCount: number,
 *   sourceDescription: string,
 *   recipientExpenseIsPaid: boolean
 * }} p
 * @returns {Promise<{ gain: object|null, decision: { post: boolean, settle: boolean, reason: string } }>}
 */
export async function maybeCreateSplitReimbursementOnAccept(db, p) {
    const decision = shouldPostSplitReimbursementOnAccept({
        sourcePaymentType: p.sourcePaymentType,
        splitScope: p.split?.splitScope,
        sourceInstallmentCount: p.sourceInstallmentCount,
        recipientExpenseIsPaid: p.recipientExpenseIsPaid
    });

    if (!decision.post) {
        await db.query(
            `UPDATE expense_split_requests
             SET status = 'ACCEPTED', created_gain_id = NULL, is_settled = false, updated_at = now()
             WHERE id = $1`,
            [p.split.id]
        );
        return { gain: null, decision };
    }

    const gainAccountId = String(p.split.requesterCreditAccountId ?? '').trim();
    const sourceDesc = String(p.sourceDescription ?? 'Compra').trim() || 'Compra';
    const refGain = await referenceOnlyForUserMovement(p.split.requesterUserId, new Date());
    const gainId = crypto.randomUUID();
    const { rows: gainRows } = await db.query(
        `INSERT INTO gains (
            id, user_id, account_id, category, subcategory, amount, description,
            date, is_paid, recurrence_group_id, related_expense_id, reference_only
         ) VALUES (
            $1,$2,$3,'Reembolsos','PIX',$4,$5,
            now(), true, NULL, $6, $7
         )
         RETURNING
            id,
            user_id AS "userId",
            account_id AS "accountId",
            category,
            subcategory,
            amount,
            description,
            date,
            is_paid AS "isPaid",
            recurrence_group_id AS "recurrenceGroupId",
            related_expense_id AS "relatedExpenseId",
            reference_only AS "referenceOnly"`,
        [
            gainId,
            p.split.requesterUserId,
            gainAccountId,
            Number(p.split.amount) || 0,
            `Estorno parcial — ${sourceDesc}`,
            p.split.sourceExpenseId,
            refGain
        ]
    );
    const gain = gainRows[0] || null;
    await db.query(
        `UPDATE expense_split_requests
         SET status = 'ACCEPTED', created_gain_id = $2, is_settled = true, updated_at = now()
         WHERE id = $1`,
        [p.split.id, gain?.id || null]
    );
    return { gain, decision };
}

/**
 * Se o destinatário acabou de marcar a saída do rateio como paga, lança o estorno (idempotente).
 * @param {import('pg').PoolClient | { query: Function }} db
 * @param {{ splitRequestId: string, recipientUserId: string }} p
 * @returns {Promise<{ gain: object|null, posted: boolean }>}
 */
export async function maybeCreateSplitReimbursementOnRecipientMarkedPaid(db, p) {
    const srId = String(p.splitRequestId ?? '').trim();
    if (!srId) return { gain: null, posted: false };

    const { rows: srRows } = await db.query(
        `SELECT
            id,
            source_expense_id AS "sourceExpenseId",
            requester_user_id AS "requesterUserId",
            recipient_user_id AS "recipientUserId",
            amount,
            requester_credit_account_id AS "requesterCreditAccountId",
            COALESCE(split_scope, 'FULL_EXPENSE') AS "splitScope",
            status,
            created_gain_id AS "createdGainId",
            COALESCE(is_settled, false) AS "isSettled",
            source_installment_count AS "sourceInstallmentCount"
         FROM expense_split_requests
         WHERE id = $1 AND recipient_user_id = $2
         LIMIT 1`,
        [srId, p.recipientUserId]
    );
    const split = srRows[0] || null;
    if (!split) return { gain: null, posted: false };

    const { rows: srcRows } = await db.query(
        `SELECT
            e.description,
            COALESCE(e.installment_count, 1) AS "installmentCount",
            a.type AS "paymentType"
         FROM expenses e
         JOIN accounts a ON a.id = e.account_id AND a.user_id = e.user_id
         WHERE e.id = $1 AND e.user_id = $2
         LIMIT 1`,
        [split.sourceExpenseId, split.requesterUserId]
    );
    const src = srcRows[0] || null;
    const nDb = Math.max(1, parseInt(String(src?.installmentCount ?? '1'), 10) || 1);
    const nSr = parseInt(String(split.sourceInstallmentCount ?? ''), 10);
    const nInst =
        Number.isFinite(nSr) && nSr >= 2 && nSr <= 99 ? Math.max(nDb, nSr) : nDb;

    const decision = shouldPostSplitReimbursementOnRecipientPaid({
        sourcePaymentType: src?.paymentType,
        splitScope: split.splitScope,
        sourceInstallmentCount: nInst,
        splitStatus: split.status,
        alreadyHasGain: Boolean(split.createdGainId) || Boolean(split.isSettled)
    });
    if (!decision.post) return { gain: null, posted: false };

    const gainAccountId = String(split.requesterCreditAccountId ?? '').trim();
    if (!gainAccountId) return { gain: null, posted: false };

    const sourceDesc = String(src?.description ?? 'Compra').trim() || 'Compra';
    const refGain = await referenceOnlyForUserMovement(split.requesterUserId, new Date());
    const gainId = crypto.randomUUID();
    const { rows: gainRows } = await db.query(
        `INSERT INTO gains (
            id, user_id, account_id, category, subcategory, amount, description,
            date, is_paid, recurrence_group_id, related_expense_id, reference_only
         ) VALUES (
            $1,$2,$3,'Reembolsos','PIX',$4,$5,
            now(), true, NULL, $6, $7
         )
         RETURNING
            id,
            user_id AS "userId",
            account_id AS "accountId",
            category,
            subcategory,
            amount,
            description,
            date,
            is_paid AS "isPaid",
            recurrence_group_id AS "recurrenceGroupId",
            related_expense_id AS "relatedExpenseId",
            reference_only AS "referenceOnly"`,
        [
            gainId,
            split.requesterUserId,
            gainAccountId,
            Number(split.amount) || 0,
            `Estorno parcial — ${sourceDesc}`,
            split.sourceExpenseId,
            refGain
        ]
    );
    const gain = gainRows[0] || null;
    await db.query(
        `UPDATE expense_split_requests
         SET created_gain_id = $2, is_settled = true, updated_at = now()
         WHERE id = $1 AND created_gain_id IS NULL`,
        [split.id, gain?.id || null]
    );
    return { gain, posted: true };
}
