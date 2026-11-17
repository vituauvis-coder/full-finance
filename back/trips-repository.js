import { query } from './db.js';

const SELECT_FIELDS = `id, user_id, title, starts_on, ends_on, status_override, budget_caps, payload, created_at, updated_at`;

export async function listTrips(userId) {
    const { rows } = await query(
        `SELECT ${SELECT_FIELDS}
         FROM trips
         WHERE user_id = $1
         ORDER BY updated_at DESC`,
        [userId]
    );
    return rows;
}

export async function getTrip(userId, tripId) {
    const { rows } = await query(
        `SELECT ${SELECT_FIELDS}
         FROM trips
         WHERE user_id = $1 AND id = $2`,
        [userId, tripId]
    );
    return rows[0] ?? null;
}

export async function createTrip(userId, { title = 'Nova viagem' } = {}) {
    const { rows } = await query(
        `INSERT INTO trips (user_id, title, budget_caps, payload)
         VALUES ($1, $2, '{}'::jsonb, '{}'::jsonb)
         RETURNING ${SELECT_FIELDS}`,
        [userId, title]
    );
    return rows[0];
}

export async function updateTrip(userId, tripId, patch) {
    const { rows } = await query(
        `UPDATE trips
         SET title = COALESCE($3, title),
             starts_on = COALESCE($4, starts_on),
             ends_on = COALESCE($5, ends_on),
             status_override = COALESCE($6, status_override),
             budget_caps = COALESCE($7::jsonb, budget_caps),
             payload = COALESCE($8::jsonb, payload),
             updated_at = NOW()
         WHERE user_id = $1 AND id = $2
         RETURNING ${SELECT_FIELDS}`,
        [
            userId,
            tripId,
            patch.title ?? null,
            patch.starts_on ?? null,
            patch.ends_on ?? null,
            patch.status_override ?? null,
            patch.budget_caps != null ? JSON.stringify(patch.budget_caps) : null,
            patch.payload != null ? JSON.stringify(patch.payload) : null
        ]
    );
    return rows[0] ?? null;
}

export async function deleteTrip(userId, tripId) {
    const { rowCount } = await query(`DELETE FROM trips WHERE user_id = $1 AND id = $2`, [userId, tripId]);
    return rowCount > 0;
}