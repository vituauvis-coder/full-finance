import crypto from 'node:crypto';
import { query, withTransaction } from './db.js';

function httpError(message, statusCode = 400) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

/** Colunas padrão de accounts (com titular usuário). */
export const ACCOUNT_SELECT_FIELDS = `
    a.id,
    a.user_id AS "userId",
    a.household_id AS "householdId",
    a.holder_user_id AS "holderUserId",
    a.name,
    a.type,
    a.initial_balance AS "initialBalance",
    a.holder_name AS "holderName",
    a.plastic_tone AS "plasticTone",
    a.plastic_color AS "plasticColor",
    a."limit",
    a.close_day AS "closeDay",
    a.due_day AS "dueDay",
    a.linked_account_id AS "linkedAccountId",
    hu.name AS "holderUserName",
    hu.email AS "holderUserEmail"`;

const ACCOUNT_FROM_JOIN = `
    FROM accounts a
    LEFT JOIN users hu ON hu.id = a.holder_user_id`;

export function householdIdsForUserSql(paramIndex = 1) {
    return `(SELECT household_id FROM household_members WHERE user_id = $${paramIndex})`;
}

export function accountsVisibleToUserSql(uidParamIndex = 1) {
    return `a.household_id IN ${householdIdsForUserSql(uidParamIndex)}`;
}

export function expensesOnHouseholdAccountsSql(uidParamIndex = 1) {
    return `e.account_id IN (
        SELECT a.id FROM accounts a
        WHERE ${accountsVisibleToUserSql(uidParamIndex)}
    )`;
}

export function gainsOnHouseholdAccountsSql(uidParamIndex = 1) {
    return `g.account_id IN (
        SELECT a.id FROM accounts a
        WHERE ${accountsVisibleToUserSql(uidParamIndex)}
    )`;
}

/**
 * Garante uma casa para o usuário e associa contas existentes.
 * @returns {Promise<string>} householdId
 */
export async function ensureHouseholdForUser(uid) {
    const { rows: mem } = await query(
        `SELECT household_id AS "householdId" FROM household_members WHERE user_id = $1 LIMIT 1`,
        [uid]
    );
    let householdId = mem[0]?.householdId;
    if (!householdId) {
        householdId = crypto.randomUUID();
        await withTransaction(async (client) => {
            await client.query(`INSERT INTO households (id, name) VALUES ($1, $2)`, [householdId, 'Minha casa']);
            await client.query(
                `INSERT INTO household_members (household_id, user_id, role) VALUES ($1, $2, 'owner')`,
                [householdId, uid]
            );
            await client.query(
                `UPDATE accounts
                 SET household_id = $1,
                     holder_user_id = COALESCE(holder_user_id, user_id)
                 WHERE user_id = $2`,
                [householdId, uid]
            );
        });
    } else {
        await query(
            `UPDATE accounts
             SET household_id = $1,
                 holder_user_id = COALESCE(holder_user_id, user_id)
             WHERE user_id = $2 AND (household_id IS NULL OR holder_user_id IS NULL)`,
            [householdId, uid]
        );
    }
    return householdId;
}

export async function fetchHouseholdMembers(uid) {
    await ensureHouseholdForUser(uid);
    const { rows } = await query(
        `SELECT u.id, u.name, u.email, hm.role
         FROM household_members hm
         JOIN users u ON u.id = hm.user_id
         WHERE hm.household_id IN ${householdIdsForUserSql(1)}
         ORDER BY LOWER(u.name), u.email`,
        [uid]
    );
    return rows;
}

export async function fetchHouseholdSummary(uid) {
    const householdId = await ensureHouseholdForUser(uid);
    const { rows } = await query(`SELECT id, name, created_at AS "createdAt" FROM households WHERE id = $1`, [
        householdId
    ]);
    return rows[0] || { id: householdId, name: 'Minha casa' };
}

export async function assertAccountAccessible(accountId, uid) {
    const { rows } = await query(
        `SELECT a.id FROM accounts a
         WHERE a.id = $1 AND ${accountsVisibleToUserSql(2)}`,
        [accountId, uid]
    );
    if (!rows[0]) throw httpError('Conta não encontrada ou inválida', 400);
}

export async function validateHolderUserId(holderUserId, _uid) {
    const hid = String(holderUserId || '').trim();
    if (!hid) throw httpError('Selecione o titular.', 400);
    const { rows } = await query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [hid]);
    if (!rows[0]) throw httpError('Usuário titular inválido.', 400);
    return hid;
}

export async function addHouseholdMemberByEmail(inviterUid, rawEmail) {
    const email = String(rawEmail || '')
        .trim()
        .toLowerCase();
    if (!email || !email.includes('@')) throw httpError('E-mail inválido.', 400);

    const { rows: inviteeRows } = await query(`SELECT id, name, email FROM users WHERE LOWER(email) = $1 LIMIT 1`, [
        email
    ]);
    const invitee = inviteeRows[0];
    if (!invitee) throw httpError('Nenhum usuário com este e-mail.', 404);
    if (invitee.id === inviterUid) throw httpError('Você já faz parte da casa.', 400);

    const inviterHouseholdId = await ensureHouseholdForUser(inviterUid);

    const { rows: invMem } = await query(
        `SELECT household_id AS "householdId" FROM household_members WHERE user_id = $1 LIMIT 1`,
        [invitee.id]
    );
    const inviteeHouseholdId = invMem[0]?.householdId;

    if (inviteeHouseholdId === inviterHouseholdId) {
        return { member: invitee, alreadyMember: true };
    }

    if (inviteeHouseholdId) {
        const { rows: cnt } = await query(
            `SELECT COUNT(*)::int AS n FROM household_members WHERE household_id = $1`,
            [inviteeHouseholdId]
        );
        if (cnt[0]?.n > 1) {
            throw httpError('Este usuário já participa de outra casa com mais membros.', 409);
        }
    }

    await withTransaction(async (client) => {
        if (inviteeHouseholdId) {
            await client.query(`DELETE FROM household_members WHERE household_id = $1`, [inviteeHouseholdId]);
            await client.query(`DELETE FROM households WHERE id = $1`, [inviteeHouseholdId]);
        }
        await client.query(
            `INSERT INTO household_members (household_id, user_id, role)
             VALUES ($1, $2, 'member')
             ON CONFLICT (household_id, user_id) DO NOTHING`,
            [inviterHouseholdId, invitee.id]
        );
        await client.query(
            `UPDATE accounts
             SET household_id = $1,
                 holder_user_id = COALESCE(holder_user_id, user_id)
             WHERE user_id = $2`,
            [inviterHouseholdId, invitee.id]
        );
    });

    return { member: invitee, alreadyMember: false };
}

export function registerHouseholdRoutes(app, { requireAuth }) {
    app.get('/api/household', requireAuth, async (req, res) => {
        try {
            const uid = req.session.userId;
            const [household, members] = await Promise.all([
                fetchHouseholdSummary(uid),
                fetchHouseholdMembers(uid)
            ]);
            res.json({ household, members });
        } catch (e) {
            console.error('GET /api/household', e);
            res.status(500).json({ error: e.message || 'Erro ao carregar casa' });
        }
    });

    app.post('/api/household/members', requireAuth, async (req, res) => {
        try {
            const uid = req.session.userId;
            const email = req.body?.email;
            const result = await addHouseholdMemberByEmail(uid, email);
            const members = await fetchHouseholdMembers(uid);
            res.json({ ...result, members });
        } catch (e) {
            console.error('POST /api/household/members', e);
            const code = e.statusCode || 500;
            res.status(code).json({ error: e.message || 'Erro ao adicionar membro' });
        }
    });
}

export async function fetchAccountByIdForUser(accountId, uid) {
    const { rows } = await query(
        `SELECT ${ACCOUNT_SELECT_FIELDS}
         ${ACCOUNT_FROM_JOIN}
         WHERE a.id = $1 AND ${accountsVisibleToUserSql(2)}`,
        [accountId, uid]
    );
    return rows[0] || null;
}

export async function queryAccountsForUser(uid) {
    await ensureHouseholdForUser(uid);
    const { rows } = await query(
        `SELECT ${ACCOUNT_SELECT_FIELDS}
         ${ACCOUNT_FROM_JOIN}
         WHERE ${accountsVisibleToUserSql(1)}
         ORDER BY LOWER(a.name), a.type`,
        [uid]
    );
    return rows;
}
