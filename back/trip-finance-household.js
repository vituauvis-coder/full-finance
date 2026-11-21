import { query } from './db.js';
import { assertTripAccess } from './trips-repository.js';
import { mergeTripFinanceView } from '../motor/viagens/trip-finance-household.js';

export async function listTripFinanceMovements(userId, tripId) {
    const trip = await assertTripAccess(userId, tripId);
    const payload =
        trip.payload && typeof trip.payload === 'object' ? trip.payload : {};
    const payloadExpenses = Array.isArray(payload.expenses) ? payload.expenses : [];

    const { rows } = await query(
        `SELECT e.id,
                e.user_id AS "userId",
                e.amount,
                e.description,
                e.category,
                e.subcategory,
                e.trip_id AS "tripId",
                e.trip_expense_id AS "tripExpenseId",
                e.date,
                u.name AS "authorName"
         FROM expenses e
         JOIN users u ON u.id = e.user_id
         WHERE e.trip_id = $1
           AND e.user_id IN (
             SELECT user_id FROM household_members
             WHERE household_id = (SELECT household_id FROM trips WHERE id = $1)
           )
         ORDER BY e.date DESC NULLS LAST, e.created_at DESC`,
        [tripId]
    );

    return mergeTripFinanceView({
        payloadExpenses,
        householdExpenses: rows.map((r) => ({
            id: r.id,
            tripExpenseId: r.tripExpenseId,
            amount: Number(r.amount),
            description: r.description,
            userId: r.userId,
            authorName: r.authorName
        }))
    });
}
