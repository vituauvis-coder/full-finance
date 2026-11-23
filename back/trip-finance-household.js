import { query } from './db.js';
import { assertTripAccess } from './trips-repository.js';
import { mergeTripFinanceView } from '../motor/viagens/trip-finance-household.js';
import { buildTripCofrinhoMeta } from '../motor/viagens/trip-cofrinho-meta.js';
import { supplementTripAportesFromCofrinhoLedger } from '../motor/viagens/trip-cofrinho-supplement-aportes.js';
import { COFRINHO_CATEGORY } from '../motor/dinheiro/cofrinho-movement-ledger.js';
import {
    cofrinhoBucketAccessibleSql,
    expenseAccessibleToUserSql,
    householdIdsForUserSql
} from './household.js';

function cofrinhoBucketRowAccessibleSql(uidParamIndex, alias = 'b') {
    return `(
        ${alias}.user_id = $${uidParamIndex}
        OR (
            ${alias}.trip_id IS NOT NULL
            AND ${alias}.trip_id IN (
                SELECT t.id FROM trips t
                WHERE t.household_id IN ${householdIdsForUserSql(uidParamIndex)}
            )
        )
    )`;
}

function cofrinhoApplicationRowAccessibleSql(uidParamIndex, alias = 'ca') {
    return `(
        ${alias}.user_id = $${uidParamIndex}
        OR EXISTS (
            SELECT 1 FROM expenses e
            WHERE e.id = ${alias}.allocated_expense_id
              AND ${expenseAccessibleToUserSql(uidParamIndex, 'e')}
        )
    )`;
}

function cofrinhoMonthlyBalanceRowAccessibleSql(uidParamIndex, alias = 'mb') {
    return `(
        ${alias}.user_id = $${uidParamIndex}
        OR ${alias}.bucket_id IN (
            SELECT id FROM cofrinho_buckets WHERE ${cofrinhoBucketAccessibleSql(uidParamIndex)}
        )
    )`;
}

export async function listTripFinanceMovements(userId, tripId) {
    const trip = await assertTripAccess(userId, tripId);
    const payload =
        trip.payload && typeof trip.payload === 'object' ? trip.payload : {};
    const payloadExpenses = Array.isArray(payload.expenses) ? payload.expenses : [];
    const tripTitle = String(trip.title ?? '').trim();

    const { ensureTripCofrinhoBucket } = await import('./cofrinho-trip-bucket.js');
    await ensureTripCofrinhoBucket(userId, tripId, tripTitle);

    const bucketAccessible = cofrinhoBucketRowAccessibleSql(1, 'b');

    const { rows } = await query(
        `SELECT DISTINCT ON (e.id)
                e.id,
                e.user_id AS "userId",
                e.amount,
                e.description,
                e.category,
                e.subcategory,
                e.trip_id AS "tripId",
                e.trip_expense_id AS "tripExpenseId",
                e.is_cofrinho AS "isCofrinho",
                e.paid_from_cofrinho AS "paidFromCofrinho",
                e.date,
                e.created_at AS "createdAt",
                u.name AS "authorName"
         FROM expenses e
         JOIN users u ON u.id = e.user_id
         WHERE ${expenseAccessibleToUserSql(1, 'e')}
           AND (
                e.trip_id = $2
                OR (
                    LOWER(TRIM(e.category)) = LOWER($3)
                    AND (
                        EXISTS (
                            SELECT 1 FROM cofrinho_buckets b
                            WHERE b.trip_id = $2
                              AND ${bucketAccessible}
                              AND LOWER(TRIM(b.name)) = LOWER(TRIM(COALESCE(e.subcategory, '')))
                        )
                        OR EXISTS (
                            SELECT 1 FROM cofrinho_applications ca
                            INNER JOIN cofrinho_buckets b ON b.id = ca.bucket_id
                            WHERE b.trip_id = $2
                              AND ${bucketAccessible}
                              AND ca.allocated_expense_id = e.id
                        )
                    )
                )
                OR (
                    LOWER(TRIM(e.category)) = LOWER($3)
                    AND $4 <> ''
                    AND e.trip_id IS NULL
                    AND LOWER(TRIM(e.subcategory)) = LOWER($4)
                )
           )
         ORDER BY e.id, e.created_at ASC`,
        [userId, tripId, COFRINHO_CATEGORY, tripTitle]
    );

    const householdExpenses = rows.map((r) => ({
        id: r.id,
        tripExpenseId: r.tripExpenseId,
        amount: Number(r.amount),
        description: r.description,
        category: r.category,
        isCofrinho: r.isCofrinho,
        paidFromCofrinho: r.paidFromCofrinho,
        date: r.date,
        createdAt: r.createdAt,
        userId: r.userId,
        authorName: r.authorName
    }));

    const existingIds = new Set(householdExpenses.map((e) => String(e.id)));

    const [{ rows: bucketRows }, { rows: appRows }, { rows: cofrinhoExpenseRows }] =
        await Promise.all([
            query(
                `SELECT id, user_id AS "userId", name, trip_id AS "tripId"
                 FROM cofrinho_buckets
                 WHERE ${cofrinhoBucketAccessibleSql(1)}
                   AND (
                        trip_id = $2
                        OR (
                            $3 <> ''
                            AND trip_id IS NULL
                            AND lower(trim(name)) = lower($3)
                        )
                   )`,
                [userId, tripId, tripTitle]
            ),
            query(
                `SELECT ca.id,
                        ca.user_id AS "userId",
                        ca.bucket_id AS "bucketId",
                        ca.reference_month AS "referenceMonth",
                        ca.amount,
                        ca.allocated_expense_id AS "allocatedExpenseId",
                        u.name AS "authorName"
                 FROM cofrinho_applications ca
                 INNER JOIN cofrinho_buckets b ON b.id = ca.bucket_id
                 LEFT JOIN users u ON u.id = ca.user_id
                 WHERE ${cofrinhoApplicationRowAccessibleSql(1, 'ca')}
                   AND (
                        b.trip_id = $2
                        OR (
                            $3 <> ''
                            AND b.trip_id IS NULL
                            AND lower(trim(b.name)) = lower($3)
                        )
                   )`,
                [userId, tripId, tripTitle]
            ),
            query(
                `SELECT e.id,
                        e.user_id AS "userId",
                        e.amount,
                        e.description,
                        e.category,
                        e.subcategory,
                        e.trip_id AS "tripId",
                        e.is_cofrinho AS "isCofrinho",
                        e.is_paid AS "isPaid",
                        e.date,
                        u.name AS "authorName"
                 FROM expenses e
                 JOIN users u ON u.id = e.user_id
                 WHERE ${expenseAccessibleToUserSql(1, 'e')}
                   AND LOWER(TRIM(e.category)) = LOWER($2)`,
                [userId, COFRINHO_CATEGORY]
            )
        ]);

    const supplemental = supplementTripAportesFromCofrinhoLedger(
        tripId,
        bucketRows,
        appRows,
        cofrinhoExpenseRows,
        existingIds,
        tripTitle
    );

    const view = mergeTripFinanceView({
        payloadExpenses,
        householdExpenses: [...householdExpenses, ...supplemental]
    });

    const { rows: snapRows } = await query(
        `SELECT mb.bucket_id AS "bucketId",
                mb.reference_month AS "referenceMonth",
                mb.principal_amount AS "principalAmount",
                mb.balance_with_yield AS "balanceWithYield"
         FROM cofrinho_monthly_balances mb
         INNER JOIN cofrinho_buckets b ON b.id = mb.bucket_id
         WHERE b.trip_id = $2
           AND ${cofrinhoMonthlyBalanceRowAccessibleSql(1, 'mb')}
         ORDER BY mb.reference_month ASC`,
        [userId, tripId]
    );

    const cofrinho = buildTripCofrinhoMeta(view.lines, snapRows);

    return { ...view, cofrinho };
}