import crypto from 'node:crypto';
import { query, withTransaction } from './db.js';
import { COFRINHO_CATEGORY, syncBucketSubcategory } from './cofrinho-allocation.js';

export const COFRINHO_BUCKET_KIND_RESERVE = 'reserve';
export const COFRINHO_BUCKET_KIND_VIAGEM = 'viagem';

const DEFAULT_VIAGEM_BUCKET = {
    colorKey: 'fuchsia',
    icon: 'fa-plane',
    yieldMultiplier: 1.025
};

/**
 * Caixinha `kind=viagem` ligada à ficha (`trip_id`); nome = título da viagem.
 * @param {string} userId
 * @param {string} tripId
 * @param {string} title
 * @param {import('pg').PoolClient} [client]
 */
export async function ensureTripCofrinhoBucket(userId, tripId, title, client = null) {
    const q = client ? client.query.bind(client) : query;
    const trip_id = String(tripId ?? '').trim();
    if (!trip_id) return null;

    const { rows: existing } = await q(
        `SELECT id, name FROM cofrinho_buckets WHERE user_id = $1 AND trip_id = $2 LIMIT 1`,
        [userId, trip_id]
    );
    if (existing[0]?.id) {
        const name = String(title ?? '').trim() || existing[0].name || 'Viagem';
        if (name && name !== existing[0].name) {
            if (client) {
                await client.query(`UPDATE cofrinho_buckets SET name = $1 WHERE id = $2`, [name, existing[0].id]);
                await syncBucketSubcategory(userId, existing[0].id, name, client);
            } else {
                await withTransaction(async (c) => {
                    await c.query(`UPDATE cofrinho_buckets SET name = $1 WHERE id = $2`, [name, existing[0].id]);
                    await syncBucketSubcategory(userId, existing[0].id, name, c);
                });
            }
        }
        return existing[0].id;
    }

    const name = String(title ?? '').trim() || 'Viagem';
    const id = crypto.randomUUID();

    const runInsert = async (c) => {
        const { rows: orderRows } = await c.query(
            `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM cofrinho_buckets WHERE user_id = $1`,
            [userId]
        );
        const sortOrder = Number(orderRows[0]?.next) || 0;
        await c.query(
            `INSERT INTO cofrinho_buckets (
                id, user_id, name, color_key, icon, sort_order, yield_multiplier, kind, trip_id
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
                id,
                userId,
                name,
                DEFAULT_VIAGEM_BUCKET.colorKey,
                DEFAULT_VIAGEM_BUCKET.icon,
                sortOrder,
                DEFAULT_VIAGEM_BUCKET.yieldMultiplier,
                COFRINHO_BUCKET_KIND_VIAGEM,
                trip_id
            ]
        );
        await syncBucketSubcategory(userId, id, name, c);
    };

    if (client) await runInsert(client);
    else await withTransaction(runInsert);

    return id;
}

/**
 * Alinha nome da caixinha ao título da viagem após rename.
 */
export async function syncTripCofrinhoBucketName(userId, tripId, title) {
    return ensureTripCofrinhoBucket(userId, tripId, title);
}

/** Garante caixinha para viagens já existentes (idempotente), inclusive viagens da casa. */
export async function backfillTripCofrinhoBucketsForUser(userId) {
    const { listTripsForUser } = await import('./trips-repository.js');
    const trips = await listTripsForUser(userId);
    for (const t of trips) {
        await ensureTripCofrinhoBucket(userId, t.id, t.title);
    }
}

/**
 * Funde caixinha reserva manual com o mesmo nome da caixinha `viagem` (trip_id).
 * Evita duplicata no extrato após backfill de viagens.
 */
export async function mergeDuplicateTripNameBuckets(userId) {
    const { rows: tripBuckets } = await query(
        `SELECT id, name, trip_id AS "tripId"
         FROM cofrinho_buckets
         WHERE user_id = $1 AND trip_id IS NOT NULL`,
        [userId]
    );
    for (const vb of tripBuckets) {
        const name = String(vb.name ?? '').trim();
        if (!name) continue;
        const { rows: legacy } = await query(
            `SELECT id FROM cofrinho_buckets
             WHERE user_id = $1 AND trip_id IS NULL AND id <> $2
               AND lower(trim(name)) = lower($3)`,
            [userId, vb.id, name]
        );
        for (const leg of legacy) {
            await withTransaction(async (client) => {
                await client.query(
                    `UPDATE cofrinho_applications SET bucket_id = $1 WHERE bucket_id = $2 AND user_id = $3`,
                    [vb.id, leg.id, userId]
                );
                await client.query(
                    `UPDATE cofrinho_bucket_goals SET bucket_id = $1 WHERE bucket_id = $2 AND user_id = $3`,
                    [vb.id, leg.id, userId]
                );
                await client.query(`DELETE FROM cofrinho_buckets WHERE id = $1 AND user_id = $2`, [
                    leg.id,
                    userId
                ]);
            });
        }
    }
}

/** Aspiração legado → caixinha reserva genérica (viagens novas usam `kind=viagem` + trip_id). */
export async function normalizeLegacyAspirationBucket(userId) {
    await query(
        `UPDATE cofrinho_buckets
         SET kind = 'reserve'
         WHERE user_id = $1
           AND trip_id IS NULL
           AND lower(trim(name)) IN ('aspiração', 'aspiracao')`,
        [userId]
    );
}

export { COFRINHO_CATEGORY };