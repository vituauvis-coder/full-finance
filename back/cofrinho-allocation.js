/**
 * Cofrinhos: caixinhas (↔ subcategorias), aplicações e metas.
 * Alocação atómica: reduz saída pool e cria saída com subcategoria da caixinha.
 */
import crypto from 'node:crypto';
import { query, withTransaction } from './db.js';
import { referenceOnlyForUserMovement } from './reference-only.js';
import { safeUpsertBalanceSnapshot } from './balance-snapshot.js';

export const COFRINHO_CATEGORY = 'Cofrinhos';

/** Subcategoria da reserva antes de distribuir nas caixinhas. */
export const COFRINHO_POOL_SUBCATEGORY = 'Pool';

export const DEFAULT_COFRINHO_BUCKETS = [
    { name: 'Aspiração', colorKey: 'fuchsia', icon: 'fa-bullseye', sortOrder: 0, yieldMultiplier: 1.025 },
    { name: 'Rendimento', colorKey: 'violet', icon: 'fa-chart-line', sortOrder: 1, yieldMultiplier: 1.07 },
    { name: 'Fundo Emergência', colorKey: 'emerald', icon: 'fa-shield-halved', sortOrder: 2, yieldMultiplier: 1.015 }
];

const BUCKET_SELECT = `SELECT
    id,
    user_id AS "userId",
    name,
    color_key AS "colorKey",
    icon,
    sort_order AS "sortOrder",
    yield_multiplier AS "yieldMultiplier",
    subcategory_id AS "subcategoryId",
    created_at AS "createdAt"
 FROM cofrinho_buckets`;

const APPLICATION_SELECT = `SELECT
    id,
    user_id AS "userId",
    bucket_id AS "bucketId",
    reference_month AS "referenceMonth",
    amount,
    account_id AS "accountId",
    status,
    source_expense_id AS "sourceExpenseId",
    allocated_expense_id AS "allocatedExpenseId",
    created_at AS "createdAt"
 FROM cofrinho_applications`;

const GOAL_SELECT = `SELECT
    id,
    user_id AS "userId",
    bucket_id AS "bucketId",
    year,
    target_amount AS "targetAmount",
    achieved_amount AS "achievedAmount",
    status,
    created_at AS "createdAt"
 FROM cofrinho_bucket_goals`;

function normalizeReferenceMonth(raw) {
    if (raw == null || raw === '') return null;
    const s = String(raw).trim();
    const ym = s.match(/^(\d{4})-(\d{2})/);
    if (ym) {
        const y = parseInt(ym[1], 10);
        const m = parseInt(ym[2], 10);
        if (Number.isFinite(y) && m >= 1 && m <= 12) {
            return `${y}-${String(m).padStart(2, '0')}-01`;
        }
    }
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
}

function parseAmount(v) {
    const n = parseFloat(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100) / 100;
}

/** Data civil de hoje (`YYYY-MM-DD`) para lançamento do aporte. */
function todayLocalDateString() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Limites do mês civil em ISO date (evita desvio por fuso ao comparar com `expenses.date`). */
function yearMonthBounds(ym) {
    const [y, m] = String(ym).split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
        return { start: null, end: null };
    }
    const mm = String(m).padStart(2, '0');
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    return {
        start: `${y}-${mm}-01`,
        end: `${nextY}-${String(nextM).padStart(2, '0')}-01`
    };
}

async function getOrCreateCofrinhosCategory(uid, client) {
    const { rows } = await client.query(
        `SELECT id FROM categories
         WHERE user_id = $1 AND type = 'EXPENSE' AND LOWER(TRIM(name)) = LOWER(TRIM($2))
         LIMIT 1`,
        [uid, COFRINHO_CATEGORY]
    );
    if (rows[0]) return rows[0].id;
    const id = crypto.randomUUID();
    await client.query(
        `INSERT INTO categories (id, user_id, name, type, is_default, created_at, updated_at)
         VALUES ($1, $2, $3, 'EXPENSE', false, NOW(), NOW())`,
        [id, uid, COFRINHO_CATEGORY]
    );
    return id;
}

async function ensurePoolSubcategory(uid, client) {
    const categoryId = await getOrCreateCofrinhosCategory(uid, client);
    const { rows: existing } = await client.query(
        `SELECT id FROM subcategories
         WHERE user_id = $1 AND category_id = $2 AND LOWER(TRIM(name)) = LOWER($3)
         LIMIT 1`,
        [uid, categoryId, COFRINHO_POOL_SUBCATEGORY]
    );
    if (existing[0]) return existing[0].id;

    const id = crypto.randomUUID();
    await client.query(
        `INSERT INTO subcategories (id, user_id, category_id, name, is_default, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
        [id, uid, categoryId, COFRINHO_POOL_SUBCATEGORY]
    );
    return id;
}

async function ensureSubcategoryForBucketName(uid, categoryId, bucketName, client) {
    const name = String(bucketName || '').trim().slice(0, 200);
    if (!name) return null;

    const { rows: existing } = await client.query(
        `SELECT id FROM subcategories
         WHERE user_id = $1 AND category_id = $2 AND LOWER(TRIM(name)) = LOWER(TRIM($3))
         LIMIT 1`,
        [uid, categoryId, name]
    );
    if (existing[0]) return existing[0].id;

    const id = crypto.randomUUID();
    await client.query(
        `INSERT INTO subcategories (id, user_id, category_id, name, is_default, created_at, updated_at)
         VALUES ($1, $2, $3, $4, false, NOW(), NOW())`,
        [id, uid, categoryId, name]
    );
    return id;
}

/**
 * @param {string} userId
 * @param {string} bucketId
 * @param {import('pg').PoolClient} client
 */
async function syncBucketSubcategory(userId, bucketId, bucketName, client) {
    const categoryId = await getOrCreateCofrinhosCategory(userId, client);
    const subcategoryId = await ensureSubcategoryForBucketName(userId, categoryId, bucketName, client);
    if (subcategoryId) {
        await client.query(`UPDATE cofrinho_buckets SET subcategory_id = $2 WHERE id = $1 AND user_id = $3`, [
            bucketId,
            subcategoryId,
            userId
        ]);
    }
    return subcategoryId;
}

async function renameBucketSubcategory(userId, subcategoryId, newName, oldName, client) {
    if (!subcategoryId) return;
    const name = String(newName || '').trim().slice(0, 200);
    await client.query(`UPDATE subcategories SET name = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2`, [
        subcategoryId,
        userId,
        name
    ]);
    if (oldName && oldName !== name) {
        await client.query(
            `UPDATE expenses SET subcategory = $4
             WHERE user_id = $1 AND category = $2 AND subcategory = $3`,
            [userId, COFRINHO_CATEGORY, oldName, name]
        );
    }
}

async function deleteBucketSubcategory(userId, subcategoryId, client) {
    if (!subcategoryId) return;
    await client.query(`DELETE FROM subcategories WHERE id = $1 AND user_id = $2`, [subcategoryId, userId]);
}

const POOL_EXPENSE_CORE_SQL = `
    LOWER(TRIM(category)) = LOWER(TRIM($2))
    AND is_paid IS NOT FALSE
    AND allocation_parent_id IS NULL
    AND COALESCE(amount, 0) > 0.001
    AND (
        subcategory IS NULL OR TRIM(subcategory) = ''
        OR LOWER(TRIM(subcategory)) = LOWER('${COFRINHO_POOL_SUBCATEGORY}')
    )
`;

async function fetchPoolExpensesForMonth(uid, ym, client = null, sourceExpenseId = null) {
    const db = client || { query };
    const { start, end } = yearMonthBounds(ym);
    if (!start || !end) return [];
    if (sourceExpenseId) {
        const { rows } = await db.query(
            `SELECT id, account_id AS "accountId", amount, description, date, category, subcategory
             FROM expenses
             WHERE id = $3 AND user_id = $1 AND ${POOL_EXPENSE_CORE_SQL}`,
            [uid, COFRINHO_CATEGORY, sourceExpenseId]
        );
        return rows;
    }
    const { rows } = await db.query(
        `SELECT id, account_id AS "accountId", amount, description, date, category, subcategory
         FROM expenses
         WHERE user_id = $1
           AND ${POOL_EXPENSE_CORE_SQL}
           AND date >= $3::date AND date < $4::date
         ORDER BY date ASC, created_at ASC`,
        [uid, COFRINHO_CATEGORY, start, end]
    );
    return rows;
}

async function sumPoolAvailable(uid, ym, client = null, sourceExpenseId = null) {
    const rows = await fetchPoolExpensesForMonth(uid, ym, client, sourceExpenseId);
    const sum = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    return Math.max(0, Math.round(sum * 100) / 100);
}

/**
 * Consome pool FIFO; devolve { primarySourceId, slices }.
 */
async function consumePoolFifo(client, uid, ym, amount, preferredSourceId = null) {
    let remaining = amount;
    let primarySourceId = null;
    const slices = [];

    let poolRows = await fetchPoolExpensesForMonth(uid, ym, client, preferredSourceId || null);
    if (preferredSourceId && poolRows.length === 0) {
        poolRows = await fetchPoolExpensesForMonth(uid, ym, client, null);
    }

    for (const row of poolRows) {
        if (remaining <= 0.001) break;
        const avail = parseFloat(row.amount) || 0;
        if (avail <= 0.001) continue;
        const take = Math.min(avail, remaining);
        const newAmt = Math.round((avail - take) * 100) / 100;
        // Zerar em vez de apagar: a saída alocada referencia allocation_parent_id → FK em expenses.
        await client.query(`UPDATE expenses SET amount = $3 WHERE id = $1 AND user_id = $2`, [
            row.id,
            uid,
            newAmt <= 0.001 ? 0 : newAmt
        ]);
        if (!primarySourceId) primarySourceId = row.id;
        slices.push({ poolRow: row, take });
        remaining = Math.round((remaining - take) * 100) / 100;
    }

    if (remaining > 0.001) {
        throw Object.assign(new Error('Saldo pool insuficiente'), { status: 400 });
    }
    return { primarySourceId, slices };
}

async function insertAllocatedExpense(client, uid, poolRow, bucketName, amount, accountIdOverride) {
    const accountId = accountIdOverride || poolRow.accountId;
    const date = todayLocalDateString();
    const refOnly = await referenceOnlyForUserMovement(uid, date);
    const expenseId = crypto.randomUUID();
    const description = `Aporte — ${bucketName}`;

    await client.query(
        `INSERT INTO expenses (
            id, user_id, account_id, category, subcategory, amount, description,
            date, is_paid, is_cofrinho, installment_count, recurring_monthly,
            cash_out_confirmed_periods, recurrence_group_id, is_fixed, reference_only,
            allocation_parent_id
         ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,true,false,null,false,
            null,null,false,$9,
            $10
         )`,
        [
            expenseId,
            uid,
            accountId,
            COFRINHO_CATEGORY,
            bucketName,
            amount,
            description,
            date,
            refOnly,
            poolRow?.id || null
        ]
    );
    return expenseId;
}

async function restorePoolAmount(client, uid, sourceExpenseId, amount, fallbackPoolRow) {
    if (sourceExpenseId) {
        const { rows } = await client.query(
            `SELECT id, amount FROM expenses WHERE id = $1 AND user_id = $2`,
            [sourceExpenseId, uid]
        );
        if (rows[0]) {
            const newAmt = Math.round(((parseFloat(rows[0].amount) || 0) + amount) * 100) / 100;
            await client.query(`UPDATE expenses SET amount = $3 WHERE id = $1 AND user_id = $2`, [
                sourceExpenseId,
                uid,
                newAmt
            ]);
            return sourceExpenseId;
        }
    }
    if (!fallbackPoolRow) return null;
    const refOnly = await referenceOnlyForUserMovement(uid, fallbackPoolRow.date);
    const id = crypto.randomUUID();
    await client.query(
        `INSERT INTO expenses (
            id, user_id, account_id, category, subcategory, amount, description,
            date, is_paid, is_cofrinho, installment_count, recurring_monthly,
            cash_out_confirmed_periods, recurrence_group_id, is_fixed, reference_only
         ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,true,false,null,false,
            null,null,false,$9
         )`,
        [
            id,
            uid,
            fallbackPoolRow.accountId,
            COFRINHO_CATEGORY,
            COFRINHO_POOL_SUBCATEGORY,
            amount,
            fallbackPoolRow.description || 'Cofrinhos (pool)',
            fallbackPoolRow.date,
            refOnly
        ]
    );
    return id;
}

/**
 * @param {string} userId
 */
export async function ensureDefaultCofrinhoBuckets(userId) {
    const { rows } = await query(`SELECT id FROM cofrinho_buckets WHERE user_id = $1 LIMIT 1`, [userId]);
    if (rows.length > 0) return;

    await withTransaction(async (client) => {
        await ensurePoolSubcategory(userId, client);
        for (const b of DEFAULT_COFRINHO_BUCKETS) {
            const id = crypto.randomUUID();
            await client.query(
                `INSERT INTO cofrinho_buckets (id, user_id, name, color_key, icon, sort_order, yield_multiplier)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [id, userId, b.name, b.colorKey, b.icon, b.sortOrder, b.yieldMultiplier]
            );
            await syncBucketSubcategory(userId, id, b.name, client);
        }
    });
}

/**
 * @param {string} userId
 */
export async function fetchCofrinhoBundle(userId) {
    await ensureDefaultCofrinhoBuckets(userId);
    await withTransaction((client) => ensurePoolSubcategory(userId, client));
    const [bucketsRes, appsRes, goalsRes] = await Promise.all([
        query(`${BUCKET_SELECT} WHERE user_id = $1 ORDER BY sort_order ASC, name ASC`, [userId]),
        query(`${APPLICATION_SELECT} WHERE user_id = $1 ORDER BY reference_month DESC, created_at DESC`, [
            userId
        ]),
        query(`${GOAL_SELECT} WHERE user_id = $1 ORDER BY year DESC, bucket_id ASC`, [userId])
    ]);
    return {
        cofrinhoBuckets: bucketsRes.rows,
        cofrinhoApplications: appsRes.rows,
        cofrinhoBucketGoals: goalsRes.rows
    };
}

/**
 * @param {import('express').Express} app
 * @param {import('express').RequestHandler} requireAuth
 */
export function registerCofrinhoRoutes(app, requireAuth) {
    // --- Buckets ---
    app.post('/api/cofrinho-buckets', requireAuth, async (req, res) => {
        const uid = req.session.userId;
        const name = String(req.body.name || '').trim();
        if (!name) return res.status(400).json({ error: 'Nome obrigatório' });

        try {
            const row = await withTransaction(async (client) => {
                const { rows: maxSort } = await client.query(
                    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM cofrinho_buckets WHERE user_id = $1`,
                    [uid]
                );
                const sortOrder = Number(req.body.sortOrder);
                const id = crypto.randomUUID();
                const { rows } = await client.query(
                    `INSERT INTO cofrinho_buckets (id, user_id, name, color_key, icon, sort_order, yield_multiplier)
                     VALUES ($1,$2,$3,$4,$5,$6,$7)
                     RETURNING
                        id, user_id AS "userId", name, color_key AS "colorKey", icon,
                        sort_order AS "sortOrder", yield_multiplier AS "yieldMultiplier",
                        subcategory_id AS "subcategoryId", created_at AS "createdAt"`,
                    [
                        id,
                        uid,
                        name.slice(0, 200),
                        String(req.body.colorKey || 'violet').slice(0, 50),
                        String(req.body.icon || 'fa-chart-line').slice(0, 80),
                        Number.isFinite(sortOrder) ? sortOrder : maxSort[0].n,
                        parseFloat(req.body.yieldMultiplier) || 1
                    ]
                );
                await syncBucketSubcategory(uid, id, name, client);
                const { rows: updated } = await client.query(`${BUCKET_SELECT} WHERE id = $1`, [id]);
                return updated[0] || rows[0];
            });
            res.json(row);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Não foi possível criar caixinha.' });
        }
    });

    app.put('/api/cofrinho-buckets/:id', requireAuth, async (req, res) => {
        const uid = req.session.userId;
        const { rows: existingRows } = await query(`${BUCKET_SELECT} WHERE id = $1 AND user_id = $2`, [
            req.params.id,
            uid
        ]);
        const existing = existingRows[0];
        if (!existing) return res.status(404).json({ error: 'Não encontrado' });

        const name =
            req.body.name !== undefined ? String(req.body.name || '').trim() || existing.name : existing.name;
        const colorKey =
            req.body.colorKey !== undefined
                ? String(req.body.colorKey || 'violet').slice(0, 50)
                : existing.colorKey;
        const icon =
            req.body.icon !== undefined
                ? String(req.body.icon || 'fa-chart-line').slice(0, 80)
                : existing.icon;
        const sortOrder =
            req.body.sortOrder !== undefined ? parseInt(req.body.sortOrder, 10) : existing.sortOrder;
        const yieldMultiplier =
            req.body.yieldMultiplier !== undefined
                ? parseFloat(req.body.yieldMultiplier) || 1
                : existing.yieldMultiplier;

        try {
            const row = await withTransaction(async (client) => {
                await client.query(
                    `UPDATE cofrinho_buckets
                     SET name = $3, color_key = $4, icon = $5, sort_order = $6, yield_multiplier = $7
                     WHERE id = $1 AND user_id = $2`,
                    [req.params.id, uid, name, colorKey, icon, sortOrder, yieldMultiplier]
                );
                if (name !== existing.name) {
                    if (existing.subcategoryId) {
                        await renameBucketSubcategory(uid, existing.subcategoryId, name, existing.name, client);
                    } else {
                        await syncBucketSubcategory(uid, req.params.id, name, client);
                    }
                }
                const { rows } = await client.query(`${BUCKET_SELECT} WHERE id = $1 AND user_id = $2`, [
                    req.params.id,
                    uid
                ]);
                return rows[0];
            });
            res.json(row);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Não foi possível guardar caixinha.' });
        }
    });

    app.delete('/api/cofrinho-buckets/:id', requireAuth, async (req, res) => {
        const uid = req.session.userId;
        const { rows: existingRows } = await query(
            `${BUCKET_SELECT} WHERE id = $1 AND user_id = $2`,
            [req.params.id, uid]
        );
        const existing = existingRows[0];
        if (!existing) return res.status(404).json({ error: 'Não encontrado' });

        const { rows: appCount } = await query(
            `SELECT COUNT(*)::int AS n FROM cofrinho_applications WHERE bucket_id = $1 AND user_id = $2`,
            [req.params.id, uid]
        );
        if ((appCount[0]?.n || 0) > 0) {
            return res.status(400).json({ error: 'Não é possível excluir: há aplicações nesta caixinha.' });
        }

        await withTransaction(async (client) => {
            await client.query(`DELETE FROM cofrinho_bucket_goals WHERE bucket_id = $1 AND user_id = $2`, [
                req.params.id,
                uid
            ]);
            await client.query(`DELETE FROM cofrinho_buckets WHERE id = $1 AND user_id = $2`, [
                req.params.id,
                uid
            ]);
            if (existing.subcategoryId) {
                await deleteBucketSubcategory(uid, existing.subcategoryId, client);
            }
        });
        res.json({ ok: true });
    });

    const handleCreateAllocation = async (req, res) => {
        const uid = req.session.userId;
        const amount = parseAmount(req.body.amount);
        if (amount == null) return res.status(400).json({ error: 'Valor inválido' });

        const refMonth = normalizeReferenceMonth(req.body.referenceMonth);
        if (!refMonth) return res.status(400).json({ error: 'Mês de referência inválido' });

        const ym = refMonth.slice(0, 7);
        const bucketId = String(req.body.bucketId || '').trim();

        const { rows: bucketRows } = await query(`${BUCKET_SELECT} WHERE id = $1 AND user_id = $2`, [
            bucketId,
            uid
        ]);
        const bucket = bucketRows[0];
        if (!bucket) return res.status(400).json({ error: 'Caixinha inválida' });
        if (!bucket.subcategoryId) {
            return res.status(400).json({ error: 'Caixinha sem subcategoria ligada.' });
        }

        let accountId = req.body.accountId ? String(req.body.accountId).trim() : null;
        if (accountId) {
            const { rows: acc } = await query(`SELECT id FROM accounts WHERE id = $1 AND user_id = $2`, [
                accountId,
                uid
            ]);
            if (!acc[0]) accountId = null;
        }

        try {
            const application = await withTransaction(async (client) => {
                const available = await sumPoolAvailable(uid, ym, client);
                if (amount > available + 0.001) {
                    const err = new Error('Valor maior que o saldo disponível para alocação.');
                    err.status = 400;
                    throw err;
                }
                const consumed = await consumePoolFifo(client, uid, ym, amount);
                const primarySourceId = consumed.primarySourceId;
                const poolTemplate = consumed.slices[0]?.poolRow;
                const allocatedExpenseId = await insertAllocatedExpense(
                    client,
                    uid,
                    poolTemplate,
                    bucket.name,
                    amount,
                    accountId
                );

                const appId = crypto.randomUUID();
                const { rows } = await client.query(
                    `INSERT INTO cofrinho_applications (
                        id, user_id, bucket_id, reference_month, amount, account_id, status,
                        source_expense_id, allocated_expense_id
                     ) VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8,$9)
                     RETURNING
                        id, user_id AS "userId", bucket_id AS "bucketId", reference_month AS "referenceMonth",
                        amount, account_id AS "accountId", status,
                        source_expense_id AS "sourceExpenseId",
                        allocated_expense_id AS "allocatedExpenseId",
                        created_at AS "createdAt"`,
                    [
                        appId,
                        uid,
                        bucketId,
                        refMonth,
                        amount,
                        accountId || poolTemplate?.accountId || null,
                        String(req.body.status || 'Concluído').slice(0, 50),
                        primarySourceId,
                        allocatedExpenseId
                    ]
                );
                return rows[0];
            });
            await safeUpsertBalanceSnapshot(uid);
            res.json(application);
        } catch (e) {
            const status = e.status || 500;
            if (status >= 500) console.error(e);
            res.status(status).json({ error: e.message || 'Não foi possível alocar.' });
        }
    };

    app.get('/api/cofrinho-pool-available', requireAuth, async (req, res) => {
        const uid = req.session.userId;
        const ym = String(req.query.yearMonth || req.query.month || '').trim();
        if (!/^\d{4}-\d{2}$/.test(ym)) {
            return res.status(400).json({ error: 'Mês inválido (use YYYY-MM)' });
        }
        try {
            const available = await sumPoolAvailable(uid, ym);
            res.json({ yearMonth: ym, available });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Não foi possível calcular o saldo pool.' });
        }
    });

    app.post('/api/cofrinho-allocations', requireAuth, handleCreateAllocation);
    app.post('/api/cofrinho-applications', requireAuth, handleCreateAllocation);

    const handleUpdateAllocation = async (req, res) => {
        const uid = req.session.userId;
        const { rows: existingRows } = await query(`${APPLICATION_SELECT} WHERE id = $1 AND user_id = $2`, [
            req.params.id,
            uid
        ]);
        const existing = existingRows[0];
        if (!existing) return res.status(404).json({ error: 'Não encontrado' });

        const newAmount =
            req.body.amount !== undefined ? parseAmount(req.body.amount) : parseAmount(existing.amount);
        if (newAmount == null) return res.status(400).json({ error: 'Valor inválido' });

        const oldAmount = parseFloat(existing.amount) || 0;
        const delta = Math.round((newAmount - oldAmount) * 100) / 100;
        const ym = String(existing.referenceMonth).slice(0, 7);

        let bucketId = existing.bucketId;
        let bucket = null;
        if (req.body.bucketId !== undefined) {
            bucketId = String(req.body.bucketId || '').trim();
            const { rows: bucketRows } = await query(`${BUCKET_SELECT} WHERE id = $1 AND user_id = $2`, [
                bucketId,
                uid
            ]);
            bucket = bucketRows[0];
            if (!bucket) return res.status(400).json({ error: 'Caixinha inválida' });
        } else {
            const { rows: bucketRows } = await query(`${BUCKET_SELECT} WHERE id = $1 AND user_id = $2`, [
                bucketId,
                uid
            ]);
            bucket = bucketRows[0];
        }

        let accountId = existing.accountId;
        if (req.body.accountId !== undefined) {
            accountId = req.body.accountId ? String(req.body.accountId).trim() : null;
            if (accountId) {
                const { rows: acc } = await query(`SELECT id FROM accounts WHERE id = $1 AND user_id = $2`, [
                    accountId,
                    uid
                ]);
                if (!acc[0]) accountId = null;
            }
        }

        try {
            const row = await withTransaction(async (client) => {
                if (existing.sourceExpenseId && Math.abs(delta) > 0.001) {
                    if (delta > 0) {
                        const available = await sumPoolAvailable(uid, ym, client, existing.sourceExpenseId);
                        if (delta > available + 0.001) {
                            const err = new Error('Saldo pool insuficiente para aumentar a alocação.');
                            err.status = 400;
                            throw err;
                        }
                        await consumePoolFifo(client, uid, ym, delta, existing.sourceExpenseId);
                    } else {
                        const { rows: allocExp } = await client.query(
                            `SELECT account_id AS "accountId", date, description FROM expenses WHERE id = $1`,
                            [existing.allocatedExpenseId]
                        );
                        await restorePoolAmount(
                            client,
                            uid,
                            existing.sourceExpenseId,
                            Math.abs(delta),
                            allocExp[0]
                        );
                    }
                }

                if (existing.allocatedExpenseId) {
                    await client.query(`UPDATE expenses SET amount = $3 WHERE id = $1 AND user_id = $2`, [
                        existing.allocatedExpenseId,
                        uid,
                        newAmount
                    ]);
                    if (bucket && req.body.bucketId !== undefined) {
                        await client.query(
                            `UPDATE expenses SET subcategory = $3, description = $4 WHERE id = $1 AND user_id = $2`,
                            [
                                existing.allocatedExpenseId,
                                uid,
                                bucket.name,
                                `Aporte — ${bucket.name}`
                            ]
                        );
                    }
                    if (accountId !== undefined) {
                        await client.query(`UPDATE expenses SET account_id = $3 WHERE id = $1 AND user_id = $2`, [
                            existing.allocatedExpenseId,
                            uid,
                            accountId
                        ]);
                    }
                }

                const { rows } = await client.query(
                    `UPDATE cofrinho_applications
                     SET bucket_id = $3, amount = $4, account_id = $5,
                         status = COALESCE($6, status)
                     WHERE id = $1 AND user_id = $2
                     RETURNING
                        id, user_id AS "userId", bucket_id AS "bucketId", reference_month AS "referenceMonth",
                        amount, account_id AS "accountId", status,
                        source_expense_id AS "sourceExpenseId",
                        allocated_expense_id AS "allocatedExpenseId",
                        created_at AS "createdAt"`,
                    [
                        req.params.id,
                        uid,
                        bucketId,
                        newAmount,
                        accountId,
                        req.body.status != null ? String(req.body.status).slice(0, 50) : null
                    ]
                );
                return rows[0];
            });
            await safeUpsertBalanceSnapshot(uid);
            res.json(row);
        } catch (e) {
            const status = e.status || 500;
            if (status >= 500) console.error(e);
            res.status(status).json({ error: e.message || 'Não foi possível atualizar.' });
        }
    };

    app.put('/api/cofrinho-allocations/:id', requireAuth, handleUpdateAllocation);
    app.put('/api/cofrinho-applications/:id', requireAuth, handleUpdateAllocation);

    const handleDeleteAllocation = async (req, res) => {
        const uid = req.session.userId;
        const { rows: existingRows } = await query(`${APPLICATION_SELECT} WHERE id = $1 AND user_id = $2`, [
            req.params.id,
            uid
        ]);
        const existing = existingRows[0];
        if (!existing) return res.status(404).json({ error: 'Não encontrado' });

        try {
            await withTransaction(async (client) => {
                let poolTemplate = null;
                if (existing.allocatedExpenseId) {
                    const { rows: allocExp } = await client.query(
                        `SELECT account_id AS "accountId", date, description, amount
                         FROM expenses WHERE id = $1 AND user_id = $2`,
                        [existing.allocatedExpenseId, uid]
                    );
                    poolTemplate = allocExp[0];
                    await client.query(`DELETE FROM expenses WHERE id = $1 AND user_id = $2`, [
                        existing.allocatedExpenseId,
                        uid
                    ]);
                }
                const amt = parseFloat(existing.amount) || 0;
                if (existing.sourceExpenseId && amt > 0) {
                    await restorePoolAmount(client, uid, existing.sourceExpenseId, amt, poolTemplate);
                }
                await client.query(`DELETE FROM cofrinho_applications WHERE id = $1 AND user_id = $2`, [
                    req.params.id,
                    uid
                ]);
            });
            await safeUpsertBalanceSnapshot(uid);
            res.json({ ok: true });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Não foi possível excluir.' });
        }
    };

    app.delete('/api/cofrinho-allocations/:id', requireAuth, handleDeleteAllocation);
    app.delete('/api/cofrinho-applications/:id', requireAuth, handleDeleteAllocation);

    // --- Bucket goals ---
    app.post('/api/cofrinho-bucket-goals', requireAuth, async (req, res) => {
        const uid = req.session.userId;
        const bucketId = String(req.body.bucketId || '').trim();
        const year = parseInt(req.body.year, 10);
        if (!bucketId || !Number.isFinite(year)) {
            return res.status(400).json({ error: 'Caixinha e ano obrigatórios' });
        }

        const { rows: bucketRows } = await query(
            `SELECT id FROM cofrinho_buckets WHERE id = $1 AND user_id = $2`,
            [bucketId, uid]
        );
        if (!bucketRows[0]) return res.status(400).json({ error: 'Caixinha inválida' });

        const id = crypto.randomUUID();
        try {
            const { rows } = await query(
                `INSERT INTO cofrinho_bucket_goals (id, user_id, bucket_id, year, target_amount, achieved_amount, status)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)
                 RETURNING
                    id, user_id AS "userId", bucket_id AS "bucketId", year,
                    target_amount AS "targetAmount", achieved_amount AS "achievedAmount",
                    status, created_at AS "createdAt"`,
                [
                    id,
                    uid,
                    bucketId,
                    year,
                    parseFloat(req.body.targetAmount) || 0,
                    parseFloat(req.body.achievedAmount) || 0,
                    String(req.body.status || 'Em andamento').slice(0, 50)
                ]
            );
            res.json(rows[0]);
        } catch (e) {
            if (e.code === '23505') {
                return res.status(409).json({ error: 'Já existe meta para esta caixinha neste ano.' });
            }
            throw e;
        }
    });

    app.put('/api/cofrinho-bucket-goals/:id', requireAuth, async (req, res) => {
        const uid = req.session.userId;
        const { rows: existingRows } = await query(`${GOAL_SELECT} WHERE id = $1 AND user_id = $2`, [
            req.params.id,
            uid
        ]);
        const existing = existingRows[0];
        if (!existing) return res.status(404).json({ error: 'Não encontrado' });

        const year = req.body.year !== undefined ? parseInt(req.body.year, 10) : existing.year;
        const targetAmount =
            req.body.targetAmount !== undefined
                ? parseFloat(req.body.targetAmount) || 0
                : existing.targetAmount;
        const achievedAmount =
            req.body.achievedAmount !== undefined
                ? parseFloat(req.body.achievedAmount) || 0
                : existing.achievedAmount;
        const status =
            req.body.status !== undefined
                ? String(req.body.status || 'Em andamento').slice(0, 50)
                : existing.status;

        const { rows } = await query(
            `UPDATE cofrinho_bucket_goals
             SET year = $3, target_amount = $4, achieved_amount = $5, status = $6
             WHERE id = $1 AND user_id = $2
             RETURNING
                id, user_id AS "userId", bucket_id AS "bucketId", year,
                target_amount AS "targetAmount", achieved_amount AS "achievedAmount",
                status, created_at AS "createdAt"`,
            [req.params.id, uid, year, targetAmount, achievedAmount, status]
        );
        res.json(rows[0]);
    });

    app.delete('/api/cofrinho-bucket-goals/:id', requireAuth, async (req, res) => {
        const uid = req.session.userId;
        const { rows } = await query(`SELECT id FROM cofrinho_bucket_goals WHERE id = $1 AND user_id = $2`, [
            req.params.id,
            uid
        ]);
        if (!rows[0]) return res.status(404).json({ error: 'Não encontrado' });
        await query(`DELETE FROM cofrinho_bucket_goals WHERE id = $1 AND user_id = $2`, [req.params.id, uid]);
        res.json({ ok: true });
    });
}
