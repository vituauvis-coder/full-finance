import { query } from './db.js';

const TRIP_COLUMNS = `t.id, t.user_id, t.title, t.starts_on, t.ends_on, t.status_override, t.budget_caps, t.payload, t.created_at, t.updated_at`;
const CREATOR_JOIN = `LEFT JOIN users u ON u.id = t.user_id`;
const SELECT_FIELDS = `${TRIP_COLUMNS}, u.name AS creator_name, u.email AS creator_email`;

/** Viagens são compartilhadas entre todos os usuários autenticados. */
export async function listTrips() {
    const { rows } = await query(
        `SELECT ${SELECT_FIELDS}
         FROM trips t
         ${CREATOR_JOIN}
         ORDER BY t.updated_at DESC`
    );
    return rows;
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

export async function createTrip(userId, { title = 'Nova viagem' } = {}) {
    const { rows } = await query(
        `INSERT INTO trips (user_id, title, budget_caps, payload)
         VALUES ($1, $2, '{}'::jsonb, '{}'::jsonb)
         RETURNING id`,
        [userId, title]
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