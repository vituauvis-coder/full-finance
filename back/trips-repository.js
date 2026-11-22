import { query } from './db.js';
import { ensureHouseholdForUser } from './household.js';
import { canAccessTrip } from '../motor/viagens/trip-household-gate.js';

const TRIP_COLUMNS = `t.id, t.user_id, t.household_id, t.title, t.starts_on, t.ends_on, t.status_override, t.budget_caps, t.payload, t.created_at, t.updated_at`;
const CREATOR_JOIN = `LEFT JOIN users u ON u.id = t.user_id`;
const SELECT_FIELDS = `${TRIP_COLUMNS}, u.name AS creator_name, u.email AS creator_email`;

function mapAccessFields(row) {
    if (!row) return null;
    return {
        householdId: row.household_id ?? null,
        userId: row.user_id
    };
}

async function backfillOrphanTrips(userId) {
    const hid = await ensureHouseholdForUser(userId);
    await query(
        `UPDATE trips SET household_id = $1 WHERE user_id = $2 AND household_id IS NULL`,
        [hid, userId]
    );
    return hid;
}

/** @deprecated Prefer listTripsForUser — kept for scripts/admin. */
export async function listTrips() {
    const { rows } = await query(
        `SELECT ${SELECT_FIELDS}
         FROM trips t
         ${CREATOR_JOIN}
         ORDER BY t.updated_at DESC`
    );
    return rows;
}

export async function listTripsForUser(userId) {
    await backfillOrphanTrips(userId);
    return listTrips();
}

export async function getTrip(tripId) {
    const { rows } = await query(
        `SELECT ${SELECT_FIELDS}
         FROM trips t
         ${CREATOR_JOIN}
         WHERE t.id = $1`,
        [tripId]
    );
    return rows[0] ?? null;
}

export async function getTripForUser(userId, tripId) {
    await backfillOrphanTrips(userId);
    const row = await getTrip(tripId);
    if (!row) return null;
    if (!canAccessTrip(mapAccessFields(row), { userId })) return null;
    return row;
}

export async function assertTripAccess(userId, tripId) {
    const row = await getTripForUser(userId, tripId);
    if (!row) {
        const err = new Error('Viagem não encontrada');
        err.statusCode = 404;
        throw err;
    }
    return row;
}

export async function createTrip(userId, { title = 'Nova viagem' } = {}) {
    const householdId = await ensureHouseholdForUser(userId);
    const { rows } = await query(
        `INSERT INTO trips (user_id, household_id, title, budget_caps, payload)
         VALUES ($1, $2, $3, '{}'::jsonb, '{}'::jsonb)
         RETURNING id`,
        [userId, householdId, title]
    );
    return await getTrip(rows[0].id);
}

export async function updateTrip(tripId, patch) {
    const { rowCount } = await query(
        `UPDATE trips
         SET title = COALESCE($2, title),
             starts_on = COALESCE($3, starts_on),
             ends_on = COALESCE($4, ends_on),
             status_override = $5,
             budget_caps = COALESCE($6::jsonb, budget_caps),
             payload = COALESCE($7::jsonb, payload),
             updated_at = NOW()
         WHERE id = $1`,
        [
            tripId,
            patch.title ?? null,
            patch.starts_on ?? null,
            patch.ends_on ?? null,
            patch.status_override ?? null,
            patch.budget_caps != null ? JSON.stringify(patch.budget_caps) : null,
            patch.payload != null ? JSON.stringify(patch.payload) : null
        ]
    );
    if (!rowCount) return null;
    return await getTrip(tripId);
}

export async function deleteTrip(tripId) {
    const { rowCount } = await query(`DELETE FROM trips WHERE id = $1`, [tripId]);
    return rowCount > 0;
}
