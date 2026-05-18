/**
 * Schema + migração de dados: caixinhas ↔ subcategorias Investimentos.
 * Uso: node scripts/pg-migrate-investment-expense-link.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { pool, query, withTransaction } from '../server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INVESTMENT_CATEGORY = 'Investimentos';
const LEGACY_SUBS = new Set(['Taxa corretora', 'IOF', 'Impostos', 'Multa', 'Juros']);

const sqlPath = path.join(
    __dirname,
    '../prisma/migrations/20260518120000_investment_expense_link/migration_pg.sql'
);

async function getOrCreateInvestimentosCategory(uid, client) {
    const { rows } = await client.query(
        `SELECT id FROM categories
         WHERE user_id = $1 AND type = 'EXPENSE' AND LOWER(TRIM(name)) = LOWER(TRIM($2))
         LIMIT 1`,
        [uid, INVESTMENT_CATEGORY]
    );
    if (rows[0]) return rows[0].id;
    const id = crypto.randomUUID();
    await client.query(
        `INSERT INTO categories (id, user_id, name, type, is_default, created_at, updated_at)
         VALUES ($1, $2, $3, 'EXPENSE', false, NOW(), NOW())`,
        [id, uid, INVESTMENT_CATEGORY]
    );
    return id;
}

async function ensureSubcategoryForBucket(uid, categoryId, bucketName, client) {
    const trimmed = String(bucketName || '').trim().slice(0, 200);
    if (!trimmed) return null;

    const { rows: existing } = await client.query(
        `SELECT id FROM subcategories
         WHERE user_id = $1 AND category_id = $2 AND LOWER(TRIM(name)) = LOWER(TRIM($3))
         LIMIT 1`,
        [uid, categoryId, trimmed]
    );
    if (existing[0]) return existing[0].id;

    const id = crypto.randomUUID();
    await client.query(
        `INSERT INTO subcategories (id, user_id, category_id, name, is_default, created_at, updated_at)
         VALUES ($1, $2, $3, $4, false, NOW(), NOW())`,
        [id, uid, categoryId, trimmed]
    );
    return id;
}

async function migrateUser(uid) {
    await withTransaction(async (client) => {
        const categoryId = await getOrCreateInvestimentosCategory(uid, client);

        const { rows: buckets } = await client.query(
            `SELECT id, name, subcategory_id AS "subcategoryId" FROM investment_buckets WHERE user_id = $1`,
            [uid]
        );

        const keepSubIds = new Set();
        for (const b of buckets) {
            const subId = await ensureSubcategoryForBucket(uid, categoryId, b.name, client);
            if (subId) {
                keepSubIds.add(subId);
                await client.query(`UPDATE investment_buckets SET subcategory_id = $2 WHERE id = $1`, [
                    b.id,
                    subId
                ]);
            }
        }

        const { rows: allSubs } = await client.query(
            `SELECT id, name FROM subcategories WHERE user_id = $1 AND category_id = $2`,
            [uid, categoryId]
        );
        for (const sub of allSubs) {
            if (keepSubIds.has(sub.id)) continue;
            if (LEGACY_SUBS.has(sub.name)) {
                await client.query(`DELETE FROM subcategories WHERE id = $1 AND user_id = $2`, [sub.id, uid]);
            }
        }
    });
}

try {
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await query(sql);
    console.log('Schema investment_expense_link aplicado.');

    const { rows: users } = await query(
        `SELECT DISTINCT user_id AS uid FROM investment_buckets
         UNION
         SELECT DISTINCT user_id FROM categories WHERE type = 'EXPENSE'`
    );
    const uids = [...new Set(users.map((r) => r.uid).filter(Boolean))];
    for (const uid of uids) {
        await migrateUser(uid);
    }
    console.log(`Subcategorias sincronizadas para ${uids.length} utilizador(es).`);
} catch (e) {
    console.error('Falha na migração:', e.message || e);
    process.exitCode = 1;
} finally {
    await pool.end();
}
