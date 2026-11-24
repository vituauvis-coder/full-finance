import { query } from './db.js';
import { assertTripAccess } from './trips-repository.js';
import { mergeTripFinanceView } from '../motor/viagens/trip-finance-household.js';
import { buildTripCofrinhoMeta } from '../motor/viagens/trip-cofrinho-meta.js';
import { supplementTripAportesFromCofrinhoLedger } from '../motor/viagens/trip-cofrinho-supplement-aportes.js';
import { COFRINHO_CATEGORY } from '../motor/dinheiro/cofrinho-movement-ledger.js';

/**
 * Movimentos financeiros vinculados à viagem (orçamento + cofrinho compartilhado).
 * Viagens são compartilhadas entre todos os logins: aportes, rendimentos e gastos
 * de todos os participantes da viagem se somam aqui (enquanto a tela Cofrinhos
 * pessoal de cada usuário mantém apenas a própria caixinha).
 */
export async function listTripFinanceMovements(userId, tripId) {
    const trip = await assertTripAccess(userId, tripId);
    const payload =
        trip.payload && typeof trip.payload === 'object' ? trip.payload : {};
    const payloadExpenses = Array.isArray(payload.expenses) ? payload.expenses : [];
    const tripTitle = String(trip.title ?? '').trim();

    const { ensureTripCofrinhoBucket } = await import('./cofrinho-trip-bucket.js');
    await ensureTripCofrinhoBucket(userId, tripId, tripTitle);

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
         WHERE e.trip_id = $1
            OR (
                LOWER(TRIM(e.category)) = LOWER($2)
                AND (
                    EXISTS (
                        SELECT 1 FROM cofrinho_buckets b
                        WHERE b.trip_id = $1
                          AND b.user_id = e.user_id
                          AND LOWER(TRIM(b.name)) = LOWER(TRIM(COALESCE(e.subcategory, '')))
                    )
                    OR EXISTS (
                        SELECT 1 FROM cofrinho_applications ca
                        INNER JOIN cofrinho_buckets b ON b.id = ca.bucket_id
                        WHERE b.trip_id = $1
                          AND ca.allocated_expense_id = e.id
                    )
                )
            )
            OR (
                LOWER(TRIM(e.category)) = LOWER($2)
                AND $3 <> ''
                AND e.trip_id IS NULL
                AND LOWER(TRIM(e.subcategory)) = LOWER($3)
            )
         ORDER BY e.id, e.created_at ASC`,
        [tripId, COFRINHO_CATEGORY, tripTitle]
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
                 WHERE trip_id = $1
                    OR (
                        $2 <> ''
                        AND trip_id IS NULL
                        AND lower(trim(name)) = lower($2)
                    )`,
                [tripId, tripTitle]
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
                 WHERE b.trip_id = $1
                    OR (
                        $2 <> ''
                        AND b.trip_id IS NULL
                        AND lower(trim(b.name)) = lower($2)
                    )`,
                [tripId, tripTitle]
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
                 WHERE LOWER(TRIM(e.category)) = LOWER($1)
                   AND (
                        e.trip_id = $2
                        OR e.user_id IN (
                            SELECT b.user_id FROM cofrinho_buckets b
                            WHERE b.trip_id = $2
                               OR (
                                    $3 <> ''
                                    AND b.trip_id IS NULL
                                    AND lower(trim(b.name)) = lower($3)
                               )
                        )
                   )`,
                [COFRINHO_CATEGORY, tripId, tripTitle]
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
         WHERE b.trip_id = $1
         ORDER BY mb.reference_month ASC`,
        [tripId]
    );

    const cofrinho = buildTripCofrinhoMeta(view.lines, snapRows);

    return { ...view, cofrinho };
}
