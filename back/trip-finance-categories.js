import crypto from 'node:crypto';
import { query, withTransaction } from './db.js';
import { FINANCE_TRIP_CATEGORY, financeTripSubcategory } from '../motor/viagens/trip-finance-fields.js';
import { householdIdsForUserSql } from './household.js';

/**
 * Garante categoria EXPENSE "Viagens" + subcategoria com o nome da viagem
 * para o usuário (e opcionalmente para todos os membros da household).
 */
export async function ensureViagensCategoryForUser(userId, client = null) {
    const run = client ? client.query.bind(client) : query;
    const { rows } = await run(
        `SELECT id FROM categories
         WHERE user_id = $1 AND type = 'EXPENSE' AND LOWER(TRIM(name)) = LOWER(TRIM($2))
         LIMIT 1`,
        [userId, FINANCE_TRIP_CATEGORY]
    );
    if (rows[0]) return rows[0].id;

    const id = crypto.randomUUID();
    await run(
        `INSERT INTO categories (id, user_id, name, type, is_default, created_at, updated_at)
         VALUES ($1, $2, $3, 'EXPENSE', true, NOW(), NOW())`,
        [id, userId, FINANCE_TRIP_CATEGORY]
    );
    return id;
}

export async function ensureTripSubcategoryForUser(userId, tripTitle, client = null) {
    const run = client ? client.query.bind(client) : query;
    const categoryId = await ensureViagensCategoryForUser(userId, client);
    const name = financeTripSubcategory(tripTitle);

    const { rows: existing } = await run(
        `SELECT id FROM subcategories
         WHERE user_id = $1 AND category_id = $2 AND LOWER(TRIM(name)) = LOWER(TRIM($3))
         LIMIT 1`,
        [userId, categoryId, name]
    );
    if (existing[0]) return { categoryId, subcategoryId: existing[0].id, name };

    const id = crypto.randomUUID();
    await run(
        `INSERT INTO subcategories (id, user_id, category_id, name, is_default, created_at, updated_at)
         VALUES ($1, $2, $3, $4, false, NOW(), NOW())`,
        [id, userId, categoryId, name]
    );
    return { categoryId, subcategoryId: id, name };
}

/** Viagens + subcategoria da viagem para todos os membros da casa do usuário. */
export async function ensureViagensCatalogForHousehold(userId, tripTitle) {
    return withTransaction(async (client) => {
        const { rows: members } = await client.query(
            `SELECT user_id AS id FROM household_members
             WHERE household_id IN ${householdIdsForUserSql(1)}`,
            [userId]
        );
        const ids = members.length ? members.map((m) => m.id) : [userId];
        const results = [];
        for (const uid of ids) {
            results.push(await ensureTripSubcategoryForUser(uid, tripTitle, client));
        }
        return results;
    });
}
