import {
    collectTripPayloadCofrinhoOutflows,
    filterTripPayloadCofrinhoOutflowsForUser
} from '../motor/dinheiro/cofrinho-trip-payload-outflows.js';
import { query } from './db.js';
import { listTripsForUser } from './trips-repository.js';

/** Gastos do cofrinho ainda só no payload das viagens (somente os do usuário logado). */
export async function fetchCofrinhoTripPayloadOutflows(userId) {
    const trips = await listTripsForUser(userId);
    const raw = collectTripPayloadCofrinhoOutflows(
        trips.map((t) => ({
            id: t.id,
            title: t.title,
            payload: typeof t.payload === 'object' && t.payload != null ? t.payload : {}
        }))
    );
    if (!raw.length) return [];

    const financeIds = [...new Set(raw.map((r) => r.financeExpenseId).filter(Boolean))];
    const tripIds = [...new Set(raw.map((r) => r.tripId).filter(Boolean))];
    const tripExpenseIds = [...new Set(raw.map((r) => r.tripExpenseId).filter(Boolean))];

    const { rows: mirrorRows } = await query(
        `SELECT id,
                user_id AS "userId",
                trip_id AS "tripId",
                trip_expense_id AS "tripExpenseId"
         FROM expenses
         WHERE (array_length($1::text[], 1) IS NOT NULL AND id = ANY($1::text[]))
            OR (
                array_length($2::text[], 1) IS NOT NULL
                AND array_length($3::text[], 1) IS NOT NULL
                AND trip_id = ANY($2::text[])
                AND trip_expense_id = ANY($3::text[])
            )`,
        [financeIds, tripIds, tripExpenseIds]
    );

    const tripOwnerByTripId = new Map(
        trips.map((t) => [String(t.id), String(t.user_id ?? '')])
    );

    return filterTripPayloadCofrinhoOutflowsForUser(raw, {
        userId,
        mirrorRows,
        tripOwnerByTripId
    });
}
