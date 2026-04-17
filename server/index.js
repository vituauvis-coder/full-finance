import 'dotenv/config';
import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { query, withTransaction } from './db.js';
import { safeUpsertBalanceSnapshot } from './balance-snapshot.js';
import { registerExpenseSplitRoutes, fetchExpenseSplitBundleForUser } from './expense-splits.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const PORT = Number(process.env.PORT || 3001);
/** `0.0.0.0` = API acessível na rede local; `127.0.0.1` = só neste PC */
const HOST = process.env.HOST || '0.0.0.0';
const SESSION_SECRET = process.env.SESSION_SECRET || 'full-finan-local-dev-change-me';

/** Origens extras para CORS (ex.: https://seu-app.vercel.app). Vírgula = várias. */
function parseExtraCorsOrigins() {
    const raw = [process.env.CORS_ORIGINS, process.env.FRONTEND_URL].filter(Boolean).join(',');
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

const EXTRA_CORS_ORIGINS = parseExtraCorsOrigins();
const LOCALHOST_ORIGIN_REGEX = [/localhost:\d+$/, /127\.0\.0\.1:\d+$/];

function corsAllowedOrigin(origin) {
    if (!origin) return true;
    if (LOCALHOST_ORIGIN_REGEX.some((re) => re.test(origin))) return true;
    if (EXTRA_CORS_ORIGINS.includes(origin)) return true;
    return false;
}

/** Front em outro domínio (Vercel + API no Railway): cookie precisa SameSite=None; Secure. */
const crossSiteSession = EXTRA_CORS_ORIGINS.length > 0;

function logLanUrls(port) {
    const ips = Object.values(os.networkInterfaces())
        .flat()
        .filter((n) => n && n.family === 'IPv4' && !n.internal)
        .map((n) => n.address);
    const uniq = [...new Set(ips)];
    if (HOST !== '0.0.0.0' || uniq.length === 0) return;
    uniq.forEach((ip) => {
        console.log(`     Rede local: http://${ip}:${port}`);
    });
}

let APP_VERSION = '1.0.0';
try {
    APP_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || APP_VERSION;
} catch {
    /* ignore */
}

/** Série diária de cadastros (últimos `days` dias, inclusive hoje). */
async function buildUserGrowthSeries(days) {
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    const { rows } = await query(
        `SELECT created_at AS "createdAt"
         FROM users
         WHERE created_at >= $1`,
        [start]
    );
    const users = rows;
    const buckets = [];
    for (let i = 0; i < days; i++) {
        const dayStart = new Date(start);
        dayStart.setDate(start.getDate() + i);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const count = users.filter((u) => {
            const c = new Date(u.createdAt);
            return c >= dayStart && c < dayEnd;
        }).length;
        buckets.push({
            date: dayStart.toISOString().slice(0, 10),
            label: dayStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            count
        });
    }
    return buckets;
}

/** Valores de `User.role` no banco (SQL Server sem enum nativo no Prisma). */
const ROLE_USER = 'USER';
const ROLE_ADMIN = 'ADMIN';

function userIsAdmin(u) {
    if (!u) return false;
    return String(u.role || ROLE_USER).toUpperCase() === ROLE_ADMIN;
}

/** Objeto público do usuário para login /auth/me (sem secrets). */
function publicAuthUser(u) {
    if (!u) return null;
    const role = String(u.role || ROLE_USER).toUpperCase() === ROLE_ADMIN ? ROLE_ADMIN : ROLE_USER;
    return {
        uid: u.id,
        email: u.email,
        emailVerified: true,
        role,
        isAdmin: role === ROLE_ADMIN
    };
}

function ensureDirs() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const profileDir = path.join(UPLOAD_DIR, 'profile_pictures');
    if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });
}

function userSafe(u) {
    if (!u) return null;
    const { passwordHash: _, ...rest } = u;
    return rest;
}

/** Objetivos: contas vinculadas como JSON no banco; API expõe array de ids. */
function parseGoalLinkedAccountIds(raw) {
    if (raw == null || raw === '') return [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw === 'string') {
        try {
            const a = JSON.parse(raw);
            return Array.isArray(a) ? a.map(String).filter(Boolean) : [];
        } catch {
            return [];
        }
    }
    return [];
}

function serializeGoalLinkedAccountIds(ids) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return null;
    const uniq = [...new Set(ids.map(String).filter(Boolean))];
    return uniq.length ? JSON.stringify(uniq) : null;
}

function normalizeGoalRow(g) {
    if (!g) return g;
    return {
        ...g,
        linkedAccountIds: parseGoalLinkedAccountIds(g.linkedAccountIds)
    };
}

function toFirestoreLikeDate(isoOrObj) {
    if (!isoOrObj) {
        const d = new Date(0);
        return { seconds: 0, nanoseconds: 0, toDate: () => d };
    }
    let d;
    if (typeof isoOrObj === 'object' && isoOrObj.seconds != null) {
        d = new Date(isoOrObj.seconds * 1000);
    } else if (typeof isoOrObj === 'string') {
        d = new Date(isoOrObj);
    } else {
        d = new Date(isoOrObj);
    }
    if (Number.isNaN(d.getTime())) d = new Date();
    const seconds = Math.floor(d.getTime() / 1000);
    return { seconds, nanoseconds: 0, toDate: () => d };
}

function normalizeMovement(t) {
    const out = { ...t, date: toFirestoreLikeDate(t.date) };
    if (t.createdAt != null) {
        out.createdAt = toFirestoreLikeDate(t.createdAt);
    }
    return out;
}

function normalizeUserDoc(u) {
    return {
        ...u,
        createdAt: u.createdAt ? toFirestoreLikeDate(u.createdAt) : toFirestoreLikeDate(new Date().toISOString())
    };
}

ensureDirs();

const app = express();
/** Railway / Vercel: um hop de proxy; necessário para cookies Secure e IP correta */
if (process.env.TRUST_PROXY !== 'false') {
    app.set('trust proxy', 1);
}

app.use(
    cors({
        credentials: true,
        origin(origin, cb) {
            if (corsAllowedOrigin(origin)) {
                return cb(null, origin || true);
            }
            cb(null, false);
        }
    })
);
app.use(express.json({ limit: '10mb' }));

app.use(
    session({
        name: 'fullfinan.sid',
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        proxy: crossSiteSession,
        cookie: {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: crossSiteSession ? 'none' : 'lax',
            secure: crossSiteSession
        }
    })
);

app.use('/uploads', express.static(UPLOAD_DIR));

/** Diagnóstico Railway/produção: se der 502, abra GET /api/health no browser (db: true = Postgres OK). */
app.get('/api/health', async (req, res) => {
    try {
        await query('SELECT 1');
        res.json({ ok: true, db: true });
    } catch (err) {
        console.error('[api/health]', err.message);
        res.status(503).json({ ok: false, db: false, error: 'database_unavailable' });
    }
});

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, path.join(UPLOAD_DIR, 'profile_pictures'));
    },
    filename(req, file, cb) {
        const uid = req.session.userId || 'anon';
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${uid}-${Date.now()}-${safe}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Não autenticado' });
    }
    next();
}

async function requireAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Não autenticado' });
    }
    const { rows } = await query(
        `SELECT id, email, name, role
         FROM users
         WHERE id = $1`,
        [req.session.userId]
    );
    const u = rows[0] || null;
    if (!u || !userIsAdmin(u)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    req.user = u;
    next();
}

// --- Auth ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body || {};
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }
        const em = String(email).trim().toLowerCase();
        if (password.length < 6) {
            return res.status(400).json({ code: 'auth/weak-password', error: 'Senha fraca' });
        }
        const passwordHash = bcrypt.hashSync(password, 10);
        /** Uma única query (sem BEGIN/COMMIT): compatível com PgBouncer modo transação do Supabase (:6543). */
        const { rows } = await query(
            `INSERT INTO users (email, name, password_hash, currency, has_completed_tour, role)
             VALUES ($1, $2, $3, 'BRL', false, $4)
             ON CONFLICT (email) DO NOTHING
             RETURNING id, email, role`,
            [em, String(name).trim(), passwordHash, ROLE_USER]
        );
        if (!rows[0]) {
            return res.status(400).json({ code: 'auth/email-already-in-use', error: 'Email em uso' });
        }
        const user = rows[0];
        req.session.userId = user.id;
        res.json({ user: publicAuthUser(user) });
    } catch (e) {
        console.error('[auth/register]', e.message, e.code, e.detail || '');
        if (e.code === '23505') {
            return res.status(400).json({ code: 'auth/email-already-in-use', error: 'Email em uso' });
        }
        res.status(500).json({ error: 'Erro ao registrar' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        const em = String(email || '').trim().toLowerCase();
        const { rows } = await query(
            `SELECT id, email, role, password_hash AS "passwordHash"
             FROM users
             WHERE email = $1`,
            [em]
        );
        const user = rows[0] || null;
        if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash)) {
            return res.status(401).json({ code: 'auth/wrong-password', error: 'Email ou senha incorretos' });
        }
        req.session.userId = user.id;
        res.json({ user: publicAuthUser(user) });
    } catch (e) {
        console.error('[auth/login]', e);
        res.status(500).json({ error: 'Erro ao entrar' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ ok: true });
    });
});

app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) return res.json({ user: null });
    const { rows } = await query(
        `SELECT id, email, role
         FROM users
         WHERE id = $1`,
        [req.session.userId]
    );
    const u = rows[0] || null;
    if (!u) {
        req.session.destroy();
        return res.json({ user: null });
    }
    res.json({ user: publicAuthUser(u) });
});

// --- User data bundle ---
app.get('/api/data', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const [userDocRes, accRes, expRes, gainRes, goalRes, invRes, debtRes, debtUpdRes] =
        await Promise.all([
            query(
                `SELECT
                    id,
                    email,
                    name,
                    password_hash AS "passwordHash",
                    created_at AS "createdAt",
                    currency,
                    has_completed_tour AS "hasCompletedTour",
                    profile_photo_url AS "profilePhotoURL",
                    role,
                    finance_preferences AS "financePreferences"
                 FROM users
                 WHERE id = $1`,
                [uid]
            ),
            query(
                `SELECT
                    id,
                    user_id AS "userId",
                    name,
                    type,
                    initial_balance AS "initialBalance",
                    holder_name AS "holderName",
                    plastic_tone AS "plasticTone",
                    plastic_color AS "plasticColor",
                    "limit",
                    close_day AS "closeDay",
                    due_day AS "dueDay",
                    linked_account_id AS "linkedAccountId"
                 FROM accounts
                 WHERE user_id = $1`,
                [uid]
            ),
            query(
                `SELECT
                    id,
                    user_id AS "userId",
                    account_id AS "accountId",
                    category,
                    subcategory,
                    amount,
                    description,
                    date,
                    created_at AS "createdAt",
                    is_paid AS "isPaid",
                    is_investment AS "isInvestment",
                    installment_count AS "installmentCount",
                    cash_out_confirmed_periods AS "cashOutConfirmedPeriods",
                    recurring_monthly AS "recurringMonthly",
                    recurrence_group_id AS "recurrenceGroupId",
                    split_request_id AS "splitRequestId"
                 FROM expenses
                 WHERE user_id = $1`,
                [uid]
            ),
            query(
                `SELECT
                    id,
                    user_id AS "userId",
                    account_id AS "accountId",
                    category,
                    subcategory,
                    amount,
                    description,
                    date,
                    is_paid AS "isPaid",
                    recurrence_group_id AS "recurrenceGroupId",
                    related_expense_id AS "relatedExpenseId"
                 FROM gains
                 WHERE user_id = $1`,
                [uid]
            ),
            query(
                `SELECT
                    id,
                    user_id AS "userId",
                    name,
                    target_amount AS "targetAmount",
                    current_amount AS "currentAmount",
                    goal_type AS "goalType",
                    linked_account_ids AS "linkedAccountIds"
                 FROM goals
                 WHERE user_id = $1`,
                [uid]
            ),
            query(
                `SELECT
                    id,
                    user_id AS "userId",
                    name,
                    category,
                    institution,
                    current_value AS "currentValue",
                    notes,
                    linked_account_id AS "linkedAccountId"
                 FROM investments
                 WHERE user_id = $1`,
                [uid]
            ),
            query(
                `SELECT
                    id,
                    user_id AS "userId",
                    company,
                    notes,
                    created_at AS "createdAt",
                    updated_at AS "updatedAt",
                    is_closed AS "isClosed"
                 FROM debts
                 WHERE user_id = $1`,
                [uid]
            ),
            query(
                `SELECT
                    id,
                    user_id AS "userId",
                    debt_id AS "debtId",
                    date,
                    amount,
                    description,
                    created_at AS "createdAt"
                 FROM debt_updates
                 WHERE user_id = $1`,
                [uid]
            )
        ]);
    const userDoc = userDocRes.rows[0] || null;
    const userAccounts = accRes.rows;
    const userExpensesRaw = expRes.rows;
    const userGainsRaw = gainRes.rows;
    const userGoalsRaw = goalRes.rows;
    const userGoals = userGoalsRaw.map(normalizeGoalRow);
    const userInvestments = invRes.rows;
    const userDebts = debtRes.rows;
    const userDebtUpdatesRaw = debtUpdRes.rows;
    
    const userExpenses = userExpensesRaw.map(normalizeMovement);
    const userGains = userGainsRaw.map(normalizeMovement);
    const userDebtUpdates = userDebtUpdatesRaw.map(normalizeMovement);

    const expenseSplitRequests = await fetchExpenseSplitBundleForUser(uid);

    res.json({
        userProfile: userDoc ? normalizeUserDoc(userSafe(userDoc)) : null,
        userAccounts,
        userExpenses,
        userGains,
        userGoals,
        userInvestments,
        userDebts,
        userDebtUpdates,
        expenseSplitRequests
    });
});

// --- Histórico de saldo total (snapshots diários) ---
app.get('/api/balance-snapshots', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        const days = Math.min(3650, Math.max(1, parseInt(String(req.query.days || '365'), 10) || 365));
        const start = new Date();
        start.setDate(start.getDate() - days);
        start.setHours(0, 0, 0, 0);
        const { rows } = await query(
            `SELECT date, total_balance AS "totalBalance"
             FROM balance_snapshots
             WHERE user_id = $1 AND date >= $2
             ORDER BY date ASC`,
            [uid, start]
        );
        res.json(
            rows.map((r) => ({
                date: r.date.toISOString().slice(0, 10),
                totalBalance: r.totalBalance
            }))
        );
    } catch (e) {
        console.error('GET /api/balance-snapshots', e);
        res.status(500).json({ error: 'Erro ao carregar histórico de saldo' });
    }
});

function parseClientDate(body) {
    if (body.date && typeof body.date === 'object' && body.date.seconds != null) {
        return new Date(body.date.seconds * 1000).toISOString();
    }
    if (body.date && typeof body.date === 'string') return body.date;
    return new Date().toISOString();
}

function httpMovementError(message, statusCode = 400) {
    const e = new Error(message);
    e.statusCode = statusCode;
    return e;
}

function expensePayloadFromBody(body, uid) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw httpMovementError('Valor inválido');
    const accountId = String(body.accountId ?? '').trim();
    if (!accountId) throw httpMovementError('Conta obrigatória');
    const category = String(body.category ?? '').trim();
    if (!category) throw httpMovementError('Categoria obrigatória');
    const description = String(body.description ?? '').trim();
    if (!description) throw httpMovementError('Descrição obrigatória');
    let subcategory = body.subcategory;
    if (subcategory == null || subcategory === '') subcategory = null;
    else subcategory = String(subcategory).trim() || null;

    const date = new Date(parseClientDate(body));
    if (Number.isNaN(date.getTime())) throw httpMovementError('Data inválida');

    let installmentCount = null;
    if (body.installmentCount != null && body.installmentCount !== '') {
        const n = parseInt(String(body.installmentCount), 10);
        if (Number.isFinite(n) && n >= 1) installmentCount = n;
    }
    const recurringMonthly =
        body && 'recurringMonthly' in body
            ? body.recurringMonthly === true || body.recurringMonthly === 'true'
            : false;

    const out = {
        userId: uid,
        accountId,
        category,
        subcategory,
        amount,
        description,
        date,
        isPaid: Boolean(body.isPaid),
        isInvestment: Boolean(body.isInvestment),
        installmentCount,
        recurringMonthly
    };
    if (body && 'cashOutConfirmedPeriods' in body) {
        if (body.cashOutConfirmedPeriods == null || body.cashOutConfirmedPeriods === '') {
            out.cashOutConfirmedPeriods = null;
        } else {
            out.cashOutConfirmedPeriods =
                typeof body.cashOutConfirmedPeriods === 'string'
                    ? body.cashOutConfirmedPeriods
                    : JSON.stringify(body.cashOutConfirmedPeriods);
        }
    }
    return out;
}

/**
 * Datas (meio-dia local) do mês da transação até dezembro do mesmo ano, respeitando dia do mês.
 */
function monthDatesThroughDecemberSameYear(baseDate) {
    const d0 = new Date(baseDate);
    if (Number.isNaN(d0.getTime())) return [];
    const year = d0.getFullYear();
    const startMonth = d0.getMonth();
    const dayWanted = d0.getDate();
    const out = [];
    for (let m = startMonth; m <= 11; m++) {
        const lastDay = new Date(year, m + 1, 0).getDate();
        const day = Math.min(dayWanted, lastDay);
        out.push(new Date(year, m, day, 12, 0, 0, 0));
    }
    return out;
}

function bodyWantsRecurring(body) {
    const v = body?.isRecurring;
    if (v === true || v === 1) return true;
    if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        return s === 'true' || s === '1' || s === 'yes';
    }
    return false;
}

/** Confirma recorrência mesmo se o body JSON perder `isRecurring` (proxy/cache/extensão). */
function queryWantsRecurring(req) {
    const q = req.query?.recurring;
    if (q === undefined || q === null) return false;
    const s = String(q).trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes';
}

function bodyWantsExpenseRecurring(body) {
    const v = body?.recurringMonthly;
    return v === true || v === 'true';
}

function gainPayloadFromBody(body, uid) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw httpMovementError('Valor inválido');
    const accountId = String(body.accountId ?? '').trim();
    if (!accountId) throw httpMovementError('Conta obrigatória');
    const category = String(body.category ?? '').trim();
    if (!category) throw httpMovementError('Categoria obrigatória');
    const description = String(body.description ?? '').trim();
    if (!description) throw httpMovementError('Descrição obrigatória');
    let subcategory = body.subcategory;
    if (subcategory == null || subcategory === '') subcategory = null;
    else subcategory = String(subcategory).trim() || null;

    const date = new Date(parseClientDate(body));
    if (Number.isNaN(date.getTime())) throw httpMovementError('Data inválida');

    let recurrenceGroupId = null;
    if (body.recurrenceGroupId != null && String(body.recurrenceGroupId).trim() !== '') {
        recurrenceGroupId = String(body.recurrenceGroupId).trim();
    }

    let relatedExpenseId = null;
    if (body.relatedExpenseId != null && String(body.relatedExpenseId).trim() !== '') {
        relatedExpenseId = String(body.relatedExpenseId).trim();
    }

    return {
        userId: uid,
        accountId,
        category,
        subcategory,
        amount,
        description,
        date,
        isPaid: Boolean(body.isPaid),
        recurrenceGroupId,
        relatedExpenseId
    };
}

async function assertAccountBelongsToUser(accountId, uid) {
    const { rows } = await query(`SELECT id FROM accounts WHERE id = $1 AND user_id = $2`, [
        accountId,
        uid
    ]);
    if (!rows[0]) throw httpMovementError('Conta não encontrada ou inválida');
}

function debtPayloadFromBody(body, uid) {
    const company = String(body.company ?? '').trim();
    if (!company) throw httpMovementError('Empresa obrigatória');
    let notes = body.notes;
    if (notes == null || notes === '') notes = null;
    else notes = String(notes);
    const isClosed = Boolean(body.isClosed);
    return { userId: uid, company, notes, isClosed };
}

function debtUpdatePayloadFromBody(body, uid) {
    const debtId = String(body.debtId ?? '').trim();
    if (!debtId) throw httpMovementError('debtId obrigatório');
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) throw httpMovementError('Valor inválido');
    const date = new Date(parseClientDate(body));
    if (Number.isNaN(date.getTime())) throw httpMovementError('Data inválida');
    let description = body.description;
    if (description == null || description === '') description = null;
    else description = String(description).trim() || null;
    return { userId: uid, debtId, amount, date, description };
}

// --- Despesas e ganhos (payload só com campos do Prisma; evita 500 por campos extras ou tipos inválidos) ---
app.post('/api/expenses', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        let splitRequestBind = null;
        let splitRequestRow = null;
        let splitAlreadyAccepted = false;
        if (req.body?.splitRequestId) {
            const srId = String(req.body.splitRequestId).trim();
            const { rows: srRows } = await query(
                `SELECT
                    id,
                    source_expense_id AS "sourceExpenseId",
                    requester_user_id AS "requesterUserId",
                    recipient_user_id AS "recipientUserId",
                    amount,
                    requester_credit_account_id AS "requesterCreditAccountId",
                    status,
                    sender_proof_url AS "senderProofUrl",
                    created_gain_id AS "createdGainId",
                    created_at AS "createdAt",
                    updated_at AS "updatedAt"
                 FROM expense_split_requests
                 WHERE id = $1 AND recipient_user_id = $2`,
                [srId, uid]
            );
            const sr = srRows[0] || null;
            if (!sr) throw httpMovementError('Solicitação de rateio inválida');
            const st = String(sr.status ?? '').toUpperCase();
            if (st === 'ACCEPTED') {
                // Compatibilidade: fluxo antigo aceitava antes de criar a saída.
                splitAlreadyAccepted = true;
            } else if (st !== 'PENDING') {
                throw httpMovementError(`Solicitação de rateio não pode ser usada (status: ${st || '—'})`);
            }
            if (!splitAlreadyAccepted && !sr.requesterCreditAccountId) {
                throw httpMovementError('Conta de extorno não configurada nesta solicitação');
            }
            const { rows: dupRows } = await query(
                `SELECT id FROM expenses WHERE split_request_id = $1 LIMIT 1`,
                [srId]
            );
            if (dupRows[0]) throw httpMovementError('Esta divisão já foi registrada como saída');
            req.body.amount = sr.amount;
            req.body.recurringMonthly = false;
            if (req.body.installmentCount != null) req.body.installmentCount = 1;
            splitRequestBind = srId;
            splitRequestRow = sr;
        }

        const base = expensePayloadFromBody(req.body, uid);
        await assertAccountBelongsToUser(base.accountId, uid);

        if (splitRequestBind) {
            base.splitRequestId = splitRequestBind;
            base.recurrenceGroupId = null;
            base.recurringMonthly = false;
            base.installmentCount = null;
        }

        const wantRecurring =
            !splitRequestBind &&
            (bodyWantsExpenseRecurring(req.body) || queryWantsRecurring(req)) &&
            (base.installmentCount == null || base.installmentCount === 1);

        if (wantRecurring) {
            const dates = monthDatesThroughDecemberSameYear(base.date);
            if (dates.length === 0) {
                return res.status(400).json({ error: 'Data inválida para série recorrente' });
            }
            const groupId = crypto.randomUUID();
            const rows = dates.map((date) => ({
                userId: uid,
                accountId: base.accountId,
                category: base.category,
                subcategory: base.subcategory,
                amount: base.amount,
                description: base.description,
                date,
                isPaid: base.isPaid,
                isInvestment: base.isInvestment,
                installmentCount: null,
                recurringMonthly: false,
                cashOutConfirmedPeriods: null,
                recurrenceGroupId: groupId
            }));
            await withTransaction(async (client) => {
                for (const r of rows) {
                    await client.query(
                        `INSERT INTO expenses (
                            id, user_id, account_id, category, subcategory, amount, description,
                            date, is_paid, is_investment, installment_count, recurring_monthly,
                            cash_out_confirmed_periods, recurrence_group_id
                         ) VALUES (
                            $1,$2,$3,$4,$5,$6,$7,
                            $8,$9,$10,$11,$12,
                            $13,$14
                         )`,
                        [
                            crypto.randomUUID(),
                            r.userId,
                            r.accountId,
                            r.category,
                            r.subcategory,
                            r.amount,
                            r.description,
                            r.date,
                            r.isPaid,
                            r.isInvestment,
                            r.installmentCount,
                            r.recurringMonthly,
                            r.cashOutConfirmedPeriods,
                            r.recurrenceGroupId
                        ]
                    );
                }
            });
            await safeUpsertBalanceSnapshot(uid);
            return res.json({
                ok: true,
                recurring: true,
                count: rows.length,
                recurrenceGroupId: groupId
            });
        }

        const createData = { ...base, recurrenceGroupId: null };
        if (!splitRequestBind) delete createData.splitRequestId;
        if (splitRequestBind && splitRequestRow && !splitAlreadyAccepted) {
            // Confirma o aceite APÓS criar a saída do destinatário.
            const result = await withTransaction(async (client) => {
                const expenseId = crypto.randomUUID();
                const { rows: expRows } = await client.query(
                    `INSERT INTO expenses (
                        id, user_id, account_id, category, subcategory, amount, description,
                        date, created_at, is_paid, is_investment, installment_count,
                        cash_out_confirmed_periods, recurring_monthly, recurrence_group_id,
                        split_request_id
                     ) VALUES (
                        $1,$2,$3,$4,$5,$6,$7,
                        $8, now(), $9,$10,$11,
                        $12,$13,$14,
                        $15
                     )
                     RETURNING
                        id,
                        user_id AS "userId",
                        account_id AS "accountId",
                        category,
                        subcategory,
                        amount,
                        description,
                        date,
                        created_at AS "createdAt",
                        is_paid AS "isPaid",
                        is_investment AS "isInvestment",
                        installment_count AS "installmentCount",
                        cash_out_confirmed_periods AS "cashOutConfirmedPeriods",
                        recurring_monthly AS "recurringMonthly",
                        recurrence_group_id AS "recurrenceGroupId",
                        split_request_id AS "splitRequestId"`,
                    [
                        expenseId,
                        createData.userId,
                        createData.accountId,
                        createData.category,
                        createData.subcategory,
                        createData.amount,
                        createData.description,
                        createData.date,
                        createData.isPaid,
                        createData.isInvestment,
                        createData.installmentCount,
                        createData.cashOutConfirmedPeriods ?? null,
                        createData.recurringMonthly ?? false,
                        null,
                        splitRequestBind
                    ]
                );
                const expense = expRows[0];

                const { rows: sourceRows } = await client.query(
                    `SELECT description
                     FROM expenses
                     WHERE id = $1 AND user_id = $2`,
                    [splitRequestRow.sourceExpenseId, splitRequestRow.requesterUserId]
                );
                const sourceDesc = String(sourceRows[0]?.description ?? 'Compra').trim() || 'Compra';

                const gainId = crypto.randomUUID();
                const { rows: gainRows } = await client.query(
                    `INSERT INTO gains (
                        id, user_id, account_id, category, subcategory, amount, description,
                        date, is_paid, recurrence_group_id, related_expense_id
                     ) VALUES (
                        $1,$2,$3,$4,$5,$6,$7,
                        now(), true, NULL, $8
                     )
                     RETURNING
                        id,
                        user_id AS "userId",
                        account_id AS "accountId",
                        category,
                        subcategory,
                        amount,
                        description,
                        date,
                        is_paid AS "isPaid",
                        recurrence_group_id AS "recurrenceGroupId",
                        related_expense_id AS "relatedExpenseId"`,
                    [
                        gainId,
                        splitRequestRow.requesterUserId,
                        splitRequestRow.requesterCreditAccountId,
                        'Reembolsos',
                        null,
                        Number(splitRequestRow.amount) || 0,
                        `Extorno parcial — ${sourceDesc}`,
                        splitRequestRow.sourceExpenseId
                    ]
                );
                const gain = gainRows[0];

                const { rows: splitRows } = await client.query(
                    `UPDATE expense_split_requests
                     SET status = 'ACCEPTED', created_gain_id = $2, updated_at = now()
                     WHERE id = $1
                     RETURNING
                        id,
                        source_expense_id AS "sourceExpenseId",
                        requester_user_id AS "requesterUserId",
                        recipient_user_id AS "recipientUserId",
                        amount,
                        requester_credit_account_id AS "requesterCreditAccountId",
                        status,
                        sender_proof_url AS "senderProofUrl",
                        created_gain_id AS "createdGainId",
                        created_at AS "createdAt",
                        updated_at AS "updatedAt"`,
                    [splitRequestBind, gain.id]
                );
                const split = splitRows[0];

                return { expense, gain, split };
            });

            await safeUpsertBalanceSnapshot(uid);
            await safeUpsertBalanceSnapshot(splitRequestRow.requesterUserId);
            return res.json({
                expense: normalizeMovement(result.expense),
                gain: normalizeMovement(result.gain),
                split: result.split
            });
        }

        if (splitRequestBind && splitRequestRow && splitAlreadyAccepted) {
            // Fluxo antigo: já existe extorno e status aceito; só cria a saída vinculada.
            const expenseId = crypto.randomUUID();
            const { rows: expRows } = await query(
                `INSERT INTO expenses (
                    id, user_id, account_id, category, subcategory, amount, description,
                    date, created_at, is_paid, is_investment, installment_count,
                    cash_out_confirmed_periods, recurring_monthly, recurrence_group_id,
                    split_request_id
                 ) VALUES (
                    $1,$2,$3,$4,$5,$6,$7,
                    $8, now(), $9,$10,$11,
                    $12,$13,$14,
                    $15
                 )
                 RETURNING
                    id,
                    user_id AS "userId",
                    account_id AS "accountId",
                    category,
                    subcategory,
                    amount,
                    description,
                    date,
                    created_at AS "createdAt",
                    is_paid AS "isPaid",
                    is_investment AS "isInvestment",
                    installment_count AS "installmentCount",
                    cash_out_confirmed_periods AS "cashOutConfirmedPeriods",
                    recurring_monthly AS "recurringMonthly",
                    recurrence_group_id AS "recurrenceGroupId",
                    split_request_id AS "splitRequestId"`,
                [
                    expenseId,
                    createData.userId,
                    createData.accountId,
                    createData.category,
                    createData.subcategory,
                    createData.amount,
                    createData.description,
                    createData.date,
                    createData.isPaid,
                    createData.isInvestment,
                    createData.installmentCount,
                    createData.cashOutConfirmedPeriods ?? null,
                    createData.recurringMonthly ?? false,
                    null,
                    splitRequestBind
                ]
            );
            const expense = expRows[0];
            await safeUpsertBalanceSnapshot(uid);
            return res.json({ expense: normalizeMovement(expense), split: splitRequestRow });
        }

        const expenseId = crypto.randomUUID();
        const { rows: expRows } = await query(
            `INSERT INTO expenses (
                id, user_id, account_id, category, subcategory, amount, description,
                date, created_at, is_paid, is_investment, installment_count,
                cash_out_confirmed_periods, recurring_monthly, recurrence_group_id
             ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,
                $8, now(), $9,$10,$11,
                $12,$13,$14
             )
             RETURNING
                id,
                user_id AS "userId",
                account_id AS "accountId",
                category,
                subcategory,
                amount,
                description,
                date,
                created_at AS "createdAt",
                is_paid AS "isPaid",
                is_investment AS "isInvestment",
                installment_count AS "installmentCount",
                cash_out_confirmed_periods AS "cashOutConfirmedPeriods",
                recurring_monthly AS "recurringMonthly",
                recurrence_group_id AS "recurrenceGroupId",
                split_request_id AS "splitRequestId"`,
            [
                expenseId,
                createData.userId,
                createData.accountId,
                createData.category,
                createData.subcategory,
                createData.amount,
                createData.description,
                createData.date,
                createData.isPaid,
                createData.isInvestment,
                createData.installmentCount,
                createData.cashOutConfirmedPeriods ?? null,
                createData.recurringMonthly ?? false,
                null
            ]
        );
        const row = expRows[0];
        await safeUpsertBalanceSnapshot(uid);
        res.json(normalizeMovement(row));
    } catch (e) {
        console.error('POST /api/expenses', e);
        const code = e.statusCode || 500;
        res.status(code).json({ error: e.message || 'Erro ao criar saída' });
    }
});

app.put('/api/expenses/:id', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        const { rows: existingRows } = await query(
            `SELECT id FROM expenses WHERE id = $1 AND user_id = $2`,
            [req.params.id, uid]
        );
        const existing = existingRows[0] || null;
        if (!existing) return res.status(404).json({ error: 'Não encontrado' });
        const data = expensePayloadFromBody(req.body, uid);
        if (!('cashOutConfirmedPeriods' in (req.body || {}))) {
            delete data.cashOutConfirmedPeriods;
        }
        if (!('recurringMonthly' in (req.body || {}))) {
            delete data.recurringMonthly;
        }
        await assertAccountBelongsToUser(data.accountId, uid);
        const sets = [];
        const params = [];
        let i = 1;
        function addSet(sqlKey, value) {
            sets.push(`${sqlKey} = $${i++}`);
            params.push(value);
        }
        addSet('account_id', data.accountId);
        addSet('category', data.category);
        addSet('subcategory', data.subcategory);
        addSet('amount', data.amount);
        addSet('description', data.description);
        addSet('date', data.date);
        addSet('is_paid', data.isPaid);
        addSet('is_investment', data.isInvestment);
        addSet('installment_count', data.installmentCount);
        if ('recurringMonthly' in data) addSet('recurring_monthly', data.recurringMonthly);
        if ('cashOutConfirmedPeriods' in data)
            addSet('cash_out_confirmed_periods', data.cashOutConfirmedPeriods);

        params.push(req.params.id, uid);
        const { rows: updatedRows } = await query(
            `UPDATE expenses
             SET ${sets.join(', ')}
             WHERE id = $${i++} AND user_id = $${i++}
             RETURNING
                id,
                user_id AS "userId",
                account_id AS "accountId",
                category,
                subcategory,
                amount,
                description,
                date,
                created_at AS "createdAt",
                is_paid AS "isPaid",
                is_investment AS "isInvestment",
                installment_count AS "installmentCount",
                cash_out_confirmed_periods AS "cashOutConfirmedPeriods",
                recurring_monthly AS "recurringMonthly",
                recurrence_group_id AS "recurrenceGroupId",
                split_request_id AS "splitRequestId"`,
            params
        );
        const updated = updatedRows[0] || null;
        await safeUpsertBalanceSnapshot(uid);
        res.json(normalizeMovement(updated));
    } catch (e) {
        console.error('PUT /api/expenses', e);
        const code = e.statusCode || 500;
        res.status(code).json({ error: e.message || 'Erro ao atualizar saída' });
    }
});

/** Marca um período (YYYY-MM-DD ou YYYY-MM) como pago para efeito de débito no saldo (modo confirmação manual). */
app.post('/api/expenses/:id/confirm-cash-out', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        const periodKey = String(req.body?.periodKey ?? '').trim();
        if (!periodKey) {
            return res.status(400).json({ error: 'periodKey é obrigatório' });
        }
        const { rows: existingRows } = await query(
            `SELECT cash_out_confirmed_periods AS "cashOutConfirmedPeriods"
             FROM expenses
             WHERE id = $1 AND user_id = $2`,
            [req.params.id, uid]
        );
        const existing = existingRows[0] || null;
        if (!existing) return res.status(404).json({ error: 'Não encontrado' });
        let arr = [];
        try {
            arr = JSON.parse(existing.cashOutConfirmedPeriods || '[]');
        } catch {
            arr = [];
        }
        if (!Array.isArray(arr)) arr = [];
        if (!arr.includes(periodKey)) arr.push(periodKey);
        const { rows: updatedRows } = await query(
            `UPDATE expenses
             SET cash_out_confirmed_periods = $3
             WHERE id = $1 AND user_id = $2
             RETURNING
                id,
                user_id AS "userId",
                account_id AS "accountId",
                category,
                subcategory,
                amount,
                description,
                date,
                created_at AS "createdAt",
                is_paid AS "isPaid",
                is_investment AS "isInvestment",
                installment_count AS "installmentCount",
                cash_out_confirmed_periods AS "cashOutConfirmedPeriods",
                recurring_monthly AS "recurringMonthly",
                recurrence_group_id AS "recurrenceGroupId",
                split_request_id AS "splitRequestId"`,
            [req.params.id, uid, JSON.stringify(arr)]
        );
        const updated = updatedRows[0] || null;
        await safeUpsertBalanceSnapshot(uid);
        res.json(normalizeMovement(updated));
    } catch (e) {
        console.error('POST /api/expenses/:id/confirm-cash-out', e);
        res.status(500).json({ error: e.message || 'Erro ao confirmar pagamento' });
    }
});

const MSG_DELETE_EXPENSE_HAS_SPLITS =
    'Não é possível excluir esta saída enquanto houver divisão aceita ou registro vinculado. Em «Dividir saída», remova as divisões que ainda não foram aceitas.';

app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        const id = String(req.params.id ?? '').trim();
        const { rows: existingRows } = await query(
            `SELECT id FROM expenses WHERE id = $1 AND user_id = $2`,
            [id, uid]
        );
        const existing = existingRows[0] || null;
        if (!existing) return res.status(404).json({ error: 'Não encontrado' });

        const { rows: countRows } = await query(
            `SELECT COUNT(*)::int AS n FROM expense_split_requests WHERE source_expense_id = $1`,
            [id]
        );
        const n = countRows[0]?.n ?? 0;
        if (n > 0) {
            return res.status(409).json({
                error: MSG_DELETE_EXPENSE_HAS_SPLITS,
                code: 'EXPENSE_HAS_SPLIT_REQUESTS'
            });
        }

        await query(`DELETE FROM expenses WHERE id = $1 AND user_id = $2`, [id, uid]);
        await safeUpsertBalanceSnapshot(uid);
        res.json({ ok: true });
    } catch (e) {
        console.error('DELETE /api/expenses/:id', e);
        res.status(500).json({ error: e.message || 'Erro ao excluir saída' });
    }
});

// --- Dívidas ---
app.get('/api/debts', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { rows } = await query(
        `SELECT
            id,
            user_id AS "userId",
            company,
            notes,
            created_at AS "createdAt",
            updated_at AS "updatedAt",
            is_closed AS "isClosed"
         FROM debts
         WHERE user_id = $1
         ORDER BY updated_at DESC`,
        [uid]
    );
    res.json(rows);
});

app.post('/api/debts', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        const data = debtPayloadFromBody(req.body, uid);
        const id = crypto.randomUUID();
        const { rows } = await query(
            `INSERT INTO debts (id, user_id, company, notes, is_closed, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5, now(), now())
             RETURNING
                id,
                user_id AS "userId",
                company,
                notes,
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                is_closed AS "isClosed"`,
            [id, data.userId, data.company, data.notes, data.isClosed]
        );
        res.json(rows[0]);
    } catch (e) {
        console.error('POST /api/debts', e);
        const code = e.statusCode || 500;
        res.status(code).json({ error: e.message || 'Erro ao criar dívida' });
    }
});

app.put('/api/debts/:id', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        const { rows: existingRows } = await query(
            `SELECT id FROM debts WHERE id = $1 AND user_id = $2`,
            [req.params.id, uid]
        );
        const existing = existingRows[0] || null;
        if (!existing) return res.status(404).json({ error: 'Não encontrado' });
        const data = debtPayloadFromBody(req.body, uid);
        const { rows: updatedRows } = await query(
            `UPDATE debts
             SET company = $3, notes = $4, is_closed = $5, updated_at = now()
             WHERE id = $1 AND user_id = $2
             RETURNING
                id,
                user_id AS "userId",
                company,
                notes,
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                is_closed AS "isClosed"`,
            [req.params.id, uid, data.company, data.notes, data.isClosed]
        );
        res.json(updatedRows[0]);
    } catch (e) {
        console.error('PUT /api/debts/:id', e);
        const code = e.statusCode || 500;
        res.status(code).json({ error: e.message || 'Erro ao atualizar dívida' });
    }
});

app.delete('/api/debts/:id', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { rows: existingRows } = await query(
        `SELECT id FROM debts WHERE id = $1 AND user_id = $2`,
        [req.params.id, uid]
    );
    const existing = existingRows[0] || null;
    if (!existing) return res.status(404).json({ error: 'Não encontrado' });
    await withTransaction(async (client) => {
        await client.query(`DELETE FROM debt_updates WHERE debt_id = $1 AND user_id = $2`, [
            req.params.id,
            uid
        ]);
        await client.query(`DELETE FROM debts WHERE id = $1 AND user_id = $2`, [req.params.id, uid]);
    });
    res.json({ ok: true });
});

app.get('/api/debt-updates', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { rows } = await query(
        `SELECT
            id,
            user_id AS "userId",
            debt_id AS "debtId",
            date,
            amount,
            description,
            created_at AS "createdAt"
         FROM debt_updates
         WHERE user_id = $1
         ORDER BY date DESC`,
        [uid]
    );
    res.json(rows.map(normalizeMovement));
});

app.post('/api/debt-updates', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        const data = debtUpdatePayloadFromBody(req.body, uid);
        const { rows: debtRows } = await query(`SELECT id FROM debts WHERE id = $1 AND user_id = $2`, [
            data.debtId,
            uid
        ]);
        if (!debtRows[0]) return res.status(400).json({ error: 'Dívida inválida' });

        const result = await withTransaction(async (client) => {
            const id = crypto.randomUUID();
            const { rows: updRows } = await client.query(
                `INSERT INTO debt_updates (id, user_id, debt_id, date, amount, description, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6, now())
                 RETURNING
                    id,
                    user_id AS "userId",
                    debt_id AS "debtId",
                    date,
                    amount,
                    description,
                    created_at AS "createdAt"`,
                [id, data.userId, data.debtId, data.date, data.amount, data.description]
            );
            await client.query(`UPDATE debts SET updated_at = now() WHERE id = $1 AND user_id = $2`, [
                data.debtId,
                uid
            ]);
            return updRows[0];
        });
        res.json(normalizeMovement(result));
    } catch (e) {
        console.error('POST /api/debt-updates', e);
        const code = e.statusCode || 500;
        res.status(code).json({ error: e.message || 'Erro ao criar atualização' });
    }
});

app.put('/api/debt-updates/:id', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        const { rows: existingRows } = await query(
            `SELECT id, debt_id AS "debtId" FROM debt_updates WHERE id = $1 AND user_id = $2`,
            [req.params.id, uid]
        );
        const existing = existingRows[0] || null;
        if (!existing) return res.status(404).json({ error: 'Não encontrado' });
        const data = debtUpdatePayloadFromBody({ ...req.body, debtId: existing.debtId }, uid);

        const updated = await withTransaction(async (client) => {
            const { rows: updatedRows } = await client.query(
                `UPDATE debt_updates
                 SET date = $3, amount = $4, description = $5
                 WHERE id = $1 AND user_id = $2
                 RETURNING
                    id,
                    user_id AS "userId",
                    debt_id AS "debtId",
                    date,
                    amount,
                    description,
                    created_at AS "createdAt"`,
                [req.params.id, uid, data.date, data.amount, data.description]
            );
            await client.query(`UPDATE debts SET updated_at = now() WHERE id = $1 AND user_id = $2`, [
                existing.debtId,
                uid
            ]);
            return updatedRows[0];
        });

        res.json(normalizeMovement(updated));
    } catch (e) {
        console.error('PUT /api/debt-updates/:id', e);
        const code = e.statusCode || 500;
        res.status(code).json({ error: e.message || 'Erro ao atualizar atualização' });
    }
});

app.delete('/api/debt-updates/:id', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { rows: existingRows } = await query(
        `SELECT id, debt_id AS "debtId" FROM debt_updates WHERE id = $1 AND user_id = $2`,
        [req.params.id, uid]
    );
    const existing = existingRows[0] || null;
    if (!existing) return res.status(404).json({ error: 'Não encontrado' });
    await withTransaction(async (client) => {
        await client.query(`DELETE FROM debt_updates WHERE id = $1 AND user_id = $2`, [
            req.params.id,
            uid
        ]);
        await client.query(`UPDATE debts SET updated_at = now() WHERE id = $1 AND user_id = $2`, [
            existing.debtId,
            uid
        ]);
    });
    res.json({ ok: true });
});

app.post('/api/gains', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        const base = gainPayloadFromBody(req.body, uid);
        await assertAccountBelongsToUser(base.accountId, uid);

        const wantRecurring = bodyWantsRecurring(req.body) || queryWantsRecurring(req);
        if (wantRecurring) {
            const dates = monthDatesThroughDecemberSameYear(base.date);
            if (dates.length === 0) throw httpMovementError('Data inválida para recorrência');
            const groupId = crypto.randomUUID();
            const rows = dates.map((date) => ({
                userId: uid,
                accountId: base.accountId,
                category: base.category,
                subcategory: base.subcategory,
                amount: base.amount,
                description: base.description,
                date,
                isPaid: base.isPaid,
                recurrenceGroupId: groupId,
                relatedExpenseId: null
            }));
            await withTransaction(async (client) => {
                for (const r of rows) {
                    await client.query(
                        `INSERT INTO gains (
                            id, user_id, account_id, category, subcategory, amount, description,
                            date, is_paid, recurrence_group_id, related_expense_id
                         ) VALUES (
                            $1,$2,$3,$4,$5,$6,$7,
                            $8,$9,$10,$11
                         )`,
                        [
                            crypto.randomUUID(),
                            r.userId,
                            r.accountId,
                            r.category,
                            r.subcategory,
                            r.amount,
                            r.description,
                            r.date,
                            r.isPaid,
                            r.recurrenceGroupId,
                            null
                        ]
                    );
                }
            });
            await safeUpsertBalanceSnapshot(uid);
            return res.json({
                ok: true,
                recurring: true,
                count: rows.length,
                recurrenceGroupId: groupId
            });
        }

        const id = crypto.randomUUID();
        const { rows: gainRows } = await query(
            `INSERT INTO gains (
                id, user_id, account_id, category, subcategory, amount, description,
                date, is_paid, recurrence_group_id, related_expense_id
             ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,
                $8,$9,$10,$11
             )
             RETURNING
                id,
                user_id AS "userId",
                account_id AS "accountId",
                category,
                subcategory,
                amount,
                description,
                date,
                is_paid AS "isPaid",
                recurrence_group_id AS "recurrenceGroupId",
                related_expense_id AS "relatedExpenseId"`,
            [
                id,
                base.userId,
                base.accountId,
                base.category,
                base.subcategory,
                base.amount,
                base.description,
                base.date,
                base.isPaid,
                null,
                base.relatedExpenseId ?? null
            ]
        );
        const row = gainRows[0];
        await safeUpsertBalanceSnapshot(uid);
        res.json(normalizeMovement(row));
    } catch (e) {
        console.error('POST /api/gains', e);
        const code = e.statusCode || 500;
        res.status(code).json({ error: e.message || 'Erro ao criar entrada' });
    }
});

app.put('/api/gains/:id', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        const { rows: existingRows } = await query(
            `SELECT recurrence_group_id AS "recurrenceGroupId", related_expense_id AS "relatedExpenseId"
             FROM gains
             WHERE id = $1 AND user_id = $2`,
            [req.params.id, uid]
        );
        const existing = existingRows[0] || null;
        if (!existing) return res.status(404).json({ error: 'Não encontrado' });
        const data = gainPayloadFromBody(req.body, uid);
        await assertAccountBelongsToUser(data.accountId, uid);
        data.recurrenceGroupId = existing.recurrenceGroupId;
        if (!('relatedExpenseId' in (req.body || {}))) {
            data.relatedExpenseId = existing.relatedExpenseId;
        }
        const { rows: updatedRows } = await query(
            `UPDATE gains
             SET
                account_id = $3,
                category = $4,
                subcategory = $5,
                amount = $6,
                description = $7,
                date = $8,
                is_paid = $9,
                recurrence_group_id = $10,
                related_expense_id = $11
             WHERE id = $1 AND user_id = $2
             RETURNING
                id,
                user_id AS "userId",
                account_id AS "accountId",
                category,
                subcategory,
                amount,
                description,
                date,
                is_paid AS "isPaid",
                recurrence_group_id AS "recurrenceGroupId",
                related_expense_id AS "relatedExpenseId"`,
            [
                req.params.id,
                uid,
                data.accountId,
                data.category,
                data.subcategory,
                data.amount,
                data.description,
                data.date,
                data.isPaid,
                data.recurrenceGroupId,
                data.relatedExpenseId ?? null
            ]
        );
        const updated = updatedRows[0];
        await safeUpsertBalanceSnapshot(uid);
        res.json(normalizeMovement(updated));
    } catch (e) {
        console.error('PUT /api/gains', e);
        const code = e.statusCode || 500;
        res.status(code).json({ error: e.message || 'Erro ao atualizar entrada' });
    }
});

app.delete('/api/gains/:id', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { rows: existingRows } = await query(`SELECT id FROM gains WHERE id = $1 AND user_id = $2`, [
        req.params.id,
        uid
    ]);
    const existing = existingRows[0] || null;
    if (!existing) return res.status(404).json({ error: 'Não encontrado' });
    await query(`DELETE FROM gains WHERE id = $1 AND user_id = $2`, [req.params.id, uid]);
    await safeUpsertBalanceSnapshot(uid);
    res.json({ ok: true });
});

const ACCOUNT_FIELDS = new Set([
    'name',
    'type',
    'initialBalance',
    'holderName',
    'plasticTone',
    'plasticColor',
    'limit',
    'closeDay',
    'dueDay',
    'linkedAccountId'
]);

function accountPayloadFromBody(body, uid) {
    const data = { userId: uid };
    for (const key of ACCOUNT_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
        let v = body[key];
        if (key === 'linkedAccountId') {
            if (v === null || v === undefined || v === '') {
                data.linkedAccountId = null;
            } else {
                data.linkedAccountId = String(v).trim();
            }
            continue;
        }
        if (key === 'closeDay' || key === 'dueDay') {
            if (v === null || v === undefined || v === '') continue;
            const n = parseInt(String(v), 10);
            if (Number.isFinite(n)) data[key] = n;
            continue;
        }
        /* Saldo e limite podem ser 0; string vazia conta como 0 */
        if (key === 'initialBalance' || key === 'limit') {
            if (v === null || v === undefined || v === '') {
                data[key] = 0;
            } else {
                const n = parseFloat(String(v));
                if (Number.isFinite(n)) data[key] = n;
            }
            continue;
        }
        if (key === 'holderName') {
            if (v == null || v === '') {
                data.holderName = null;
            } else {
                const s = String(v).trim();
                data.holderName = s === '' ? null : s;
            }
            continue;
        }
        if (v === null || v === '') continue;
        if (key === 'name' || key === 'type') {
            data[key] = String(v).trim();
        } else {
            data[key] = typeof v === 'string' ? v.trim() : v;
        }
    }
    if (!data.name || !data.type) {
        const err = new Error('Nome e tipo são obrigatórios');
        err.statusCode = 400;
        throw err;
    }
    if (data.type !== 'cartao_credito' && data.type !== 'cartao_debito') {
        delete data.linkedAccountId;
    }
    return data;
}

async function assertCardLinkedAccountValid(uid, accountIdOrNull, type, linkedAccountId) {
    if (type !== 'cartao_credito' && type !== 'cartao_debito') return;
    if (!linkedAccountId) {
        const err = new Error('Cartão de crédito ou débito exige uma conta bancária vinculada.');
        err.statusCode = 400;
        throw err;
    }
    if (accountIdOrNull && linkedAccountId === accountIdOrNull) {
        const err = new Error('O cartão não pode estar vinculado a si mesmo.');
        err.statusCode = 400;
        throw err;
    }
    const { rows: linkedRows } = await query(
        `SELECT id, type FROM accounts WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [linkedAccountId, uid]
    );
    const linked = linkedRows[0] || null;
    if (!linked) {
        const err = new Error('Conta vinculada inválida.');
        err.statusCode = 400;
        throw err;
    }
    if (linked.type === 'cartao_credito' || linked.type === 'cartao_debito') {
        const err = new Error('Vincule a uma conta bancária (não a outro cartão).');
        err.statusCode = 400;
        throw err;
    }
}

// --- Accounts ---
app.post('/api/accounts', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        const data = accountPayloadFromBody(req.body, uid);
        await assertCardLinkedAccountValid(uid, null, data.type, data.linkedAccountId);
        const id = crypto.randomUUID();
        const { rows } = await query(
            `INSERT INTO accounts (
                id, user_id, name, type, initial_balance, holder_name,
                plastic_tone, plastic_color, "limit", close_day, due_day, linked_account_id
             ) VALUES (
                $1,$2,$3,$4,$5,$6,
                $7,$8,$9,$10,$11,$12
             )
             RETURNING
                id,
                user_id AS "userId",
                name,
                type,
                initial_balance AS "initialBalance",
                holder_name AS "holderName",
                plastic_tone AS "plasticTone",
                plastic_color AS "plasticColor",
                "limit",
                close_day AS "closeDay",
                due_day AS "dueDay",
                linked_account_id AS "linkedAccountId"`,
            [
                id,
                uid,
                data.name,
                data.type,
                data.initialBalance ?? 0,
                data.holderName ?? null,
                data.plasticTone ?? null,
                data.plasticColor ?? null,
                data.limit ?? null,
                data.closeDay ?? null,
                data.dueDay ?? null,
                data.linkedAccountId ?? null
            ]
        );
        const account = rows[0];
        await safeUpsertBalanceSnapshot(uid);
        res.json(account);
    } catch (e) {
        console.error('POST /api/accounts', e);
        const code = e.statusCode || 500;
        res.status(code).json({ error: e.message || 'Erro ao criar conta' });
    }
});

app.put('/api/accounts/:id', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        const { rows: existingRows } = await query(
            `SELECT
                id,
                type,
                linked_account_id AS "linkedAccountId"
             FROM accounts
             WHERE id = $1 AND user_id = $2`,
            [req.params.id, uid]
        );
        const existing = existingRows[0] || null;
        if (!existing) return res.status(404).json({ error: 'Não encontrado' });
        const data = accountPayloadFromBody(req.body, uid);
        const mergedType = data.type !== undefined ? data.type : existing.type;
        const mergedLinked =
            data.linkedAccountId !== undefined ? data.linkedAccountId : existing.linkedAccountId;
        await assertCardLinkedAccountValid(uid, req.params.id, mergedType, mergedLinked);
        if (mergedType !== 'cartao_credito' && mergedType !== 'cartao_debito') {
            data.linkedAccountId = null;
        }
        const sets = [];
        const params = [];
        let i = 1;
        function addSet(col, val) {
            sets.push(`${col} = $${i++}`);
            params.push(val);
        }
        if (data.name !== undefined) addSet('name', data.name);
        if (data.type !== undefined) addSet('type', data.type);
        if (data.initialBalance !== undefined) addSet('initial_balance', data.initialBalance);
        if (data.holderName !== undefined) addSet('holder_name', data.holderName);
        if (data.plasticTone !== undefined) addSet('plastic_tone', data.plasticTone);
        if (data.plasticColor !== undefined) addSet('plastic_color', data.plasticColor);
        if (data.limit !== undefined) addSet('"limit"', data.limit);
        if (data.closeDay !== undefined) addSet('close_day', data.closeDay);
        if (data.dueDay !== undefined) addSet('due_day', data.dueDay);
        if (data.linkedAccountId !== undefined) addSet('linked_account_id', data.linkedAccountId);

        params.push(req.params.id, uid);
        const { rows: updatedRows } = await query(
            `UPDATE accounts
             SET ${sets.join(', ')}
             WHERE id = $${i++} AND user_id = $${i++}
             RETURNING
                id,
                user_id AS "userId",
                name,
                type,
                initial_balance AS "initialBalance",
                holder_name AS "holderName",
                plastic_tone AS "plasticTone",
                plastic_color AS "plasticColor",
                "limit",
                close_day AS "closeDay",
                due_day AS "dueDay",
                linked_account_id AS "linkedAccountId"`,
            params
        );
        const updated = updatedRows[0];
        await safeUpsertBalanceSnapshot(uid);
        res.json(updated);
    } catch (e) {
        console.error('PUT /api/accounts', e);
        const code = e.statusCode || 500;
        res.status(code).json({ error: e.message || 'Erro ao atualizar conta' });
    }
});

app.delete('/api/accounts/:id', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { rows: existingRows } = await query(
        `SELECT id FROM accounts WHERE id = $1 AND user_id = $2`,
        [req.params.id, uid]
    );
    const existing = existingRows[0] || null;
    if (!existing) return res.status(404).json({ error: 'Não encontrado' });
    
    await withTransaction(async (client) => {
        await client.query(`DELETE FROM expenses WHERE account_id = $1 AND user_id = $2`, [
            req.params.id,
            uid
        ]);
        await client.query(`DELETE FROM gains WHERE account_id = $1 AND user_id = $2`, [req.params.id, uid]);

        const { rows: goals } = await client.query(
            `SELECT id, linked_account_ids AS "linkedAccountIds"
             FROM goals
             WHERE user_id = $1`,
            [uid]
        );
        for (const g of goals) {
            const ids = parseGoalLinkedAccountIds(g.linkedAccountIds);
            if (!ids.includes(req.params.id)) continue;
            const next = ids.filter((id) => id !== req.params.id);
            await client.query(`UPDATE goals SET linked_account_ids = $2 WHERE id = $1 AND user_id = $3`, [
                g.id,
                serializeGoalLinkedAccountIds(next),
                uid
            ]);
        }

        await client.query(
            `UPDATE investments SET linked_account_id = NULL WHERE linked_account_id = $1 AND user_id = $2`,
            [req.params.id, uid]
        );
        await client.query(
            `UPDATE accounts SET linked_account_id = NULL WHERE linked_account_id = $1 AND user_id = $2`,
            [req.params.id, uid]
        );
        await client.query(`DELETE FROM accounts WHERE id = $1 AND user_id = $2`, [req.params.id, uid]);
    });
    await safeUpsertBalanceSnapshot(uid);
    res.json({ ok: true });
});

// --- Goals ---
app.post('/api/goals', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const rawIds = req.body.linkedAccountIds;
    const ids = Array.isArray(rawIds) ? rawIds.map(String).filter(Boolean) : [];
    const { rows: valid } = await query(
        `SELECT id FROM accounts WHERE user_id = $1 AND id = ANY($2::uuid[])`,
        [uid, ids.length ? ids : []]
    );
    const allowed = new Set(valid.map((v) => v.id));
    const filtered = ids.filter((id) => allowed.has(id));

    const name = String(req.body.name || '').trim();
    const targetAmount = parseFloat(req.body.targetAmount);
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
    if (Number.isNaN(targetAmount) || targetAmount <= 0) {
        return res.status(400).json({ error: 'Valor da meta inválido' });
    }

    const id = crypto.randomUUID();
    const { rows } = await query(
        `INSERT INTO goals (
            id, user_id, name, target_amount, current_amount, goal_type, linked_account_ids
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING
            id,
            user_id AS "userId",
            name,
            target_amount AS "targetAmount",
            current_amount AS "currentAmount",
            goal_type AS "goalType",
            linked_account_ids AS "linkedAccountIds"`,
        [
            id,
            uid,
            name,
            targetAmount,
            parseFloat(req.body.currentAmount) || 0,
            String(req.body.goalType || 'outro').slice(0, 100) || 'outro',
            serializeGoalLinkedAccountIds(filtered)
        ]
    );
    res.json(normalizeGoalRow(rows[0]));
});

app.put('/api/goals/:id', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { rows: existingRows } = await query(
        `SELECT
            id,
            name,
            target_amount AS "targetAmount",
            current_amount AS "currentAmount",
            goal_type AS "goalType",
            linked_account_ids AS "linkedAccountIds"
         FROM goals
         WHERE id = $1 AND user_id = $2`,
        [req.params.id, uid]
    );
    const existing = existingRows[0] || null;
    if (!existing) return res.status(404).json({ error: 'Não encontrado' });

    let linkedPayload = existing.linkedAccountIds;
    if (req.body.linkedAccountIds !== undefined) {
        const rawIds = req.body.linkedAccountIds;
        const ids = Array.isArray(rawIds) ? rawIds.map(String).filter(Boolean) : [];
        const { rows: valid } = await query(
            `SELECT id FROM accounts WHERE user_id = $1 AND id = ANY($2::uuid[])`,
            [uid, ids.length ? ids : []]
        );
        const allowed = new Set(valid.map((v) => v.id));
        const filtered = ids.filter((id) => allowed.has(id));
        linkedPayload = serializeGoalLinkedAccountIds(filtered);
    }

    const nextName =
        req.body.name !== undefined ? String(req.body.name || '').trim() || existing.name : existing.name;
    const nextTarget =
        req.body.targetAmount !== undefined ? parseFloat(req.body.targetAmount) : existing.targetAmount;
    const nextCurrent =
        req.body.currentAmount !== undefined
            ? parseFloat(req.body.currentAmount) || 0
            : existing.currentAmount;
    const nextType =
        req.body.goalType !== undefined
            ? String(req.body.goalType || 'outro').slice(0, 100) || 'outro'
            : existing.goalType;

    const { rows: updatedRows } = await query(
        `UPDATE goals
         SET name = $3,
             target_amount = $4,
             current_amount = $5,
             goal_type = $6,
             linked_account_ids = $7
         WHERE id = $1 AND user_id = $2
         RETURNING
            id,
            user_id AS "userId",
            name,
            target_amount AS "targetAmount",
            current_amount AS "currentAmount",
            goal_type AS "goalType",
            linked_account_ids AS "linkedAccountIds"`,
        [req.params.id, uid, nextName, nextTarget, nextCurrent, nextType, linkedPayload]
    );
    res.json(normalizeGoalRow(updatedRows[0]));
});

app.delete('/api/goals/:id', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { rows: existingRows } = await query(`SELECT id FROM goals WHERE id = $1 AND user_id = $2`, [
        req.params.id,
        uid
    ]);
    const existing = existingRows[0] || null;
    if (!existing) return res.status(404).json({ error: 'Não encontrado' });
    await query(`DELETE FROM goals WHERE id = $1 AND user_id = $2`, [req.params.id, uid]);
    res.json({ ok: true });
});

// --- Investments ---
app.post('/api/investments', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const data = { ...req.body, userId: uid };
    delete data.id;
    if (!data.linkedAccountId) data.linkedAccountId = null;
    const row = {
        ...data,
        currentValue: parseFloat(data.currentValue) || 0
    };
    const id = crypto.randomUUID();
    const { rows } = await query(
        `INSERT INTO investments (
            id, user_id, name, category, institution, current_value, notes, linked_account_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING
            id,
            user_id AS "userId",
            name,
            category,
            institution,
            current_value AS "currentValue",
            notes,
            linked_account_id AS "linkedAccountId"`,
        [
            id,
            uid,
            row.name,
            row.category,
            row.institution ?? null,
            row.currentValue ?? 0,
            row.notes ?? null,
            row.linkedAccountId ?? null
        ]
    );
    const inv = rows[0];
    await safeUpsertBalanceSnapshot(uid);
    res.json(inv);
});

app.put('/api/investments/:id', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { rows: existingRows } = await query(
        `SELECT current_value AS "currentValue" FROM investments WHERE id = $1 AND user_id = $2`,
        [req.params.id, uid]
    );
    const existing = existingRows[0] || null;
    if (!existing) return res.status(404).json({ error: 'Não encontrado' });
    const data = { ...req.body, userId: uid };
    delete data.id;
    if (!data.linkedAccountId) data.linkedAccountId = null;
    const nextCurrent = parseFloat(data.currentValue);
    const currentValue = Number.isFinite(nextCurrent) ? nextCurrent : existing.currentValue ?? 0;
    const { rows: updatedRows } = await query(
        `UPDATE investments
         SET name = COALESCE($3, name),
             category = COALESCE($4, category),
             institution = $5,
             current_value = $6,
             notes = $7,
             linked_account_id = $8
         WHERE id = $1 AND user_id = $2
         RETURNING
            id,
            user_id AS "userId",
            name,
            category,
            institution,
            current_value AS "currentValue",
            notes,
            linked_account_id AS "linkedAccountId"`,
        [
            req.params.id,
            uid,
            data.name !== undefined ? String(data.name) : null,
            data.category !== undefined ? String(data.category) : null,
            data.institution !== undefined ? (data.institution === '' ? null : data.institution) : null,
            currentValue,
            data.notes !== undefined ? (data.notes === '' ? null : data.notes) : null,
            data.linkedAccountId
        ]
    );
    const updated = updatedRows[0];
    await safeUpsertBalanceSnapshot(uid);
    res.json(updated);
});

app.delete('/api/investments/:id', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { rows: existingRows } = await query(
        `SELECT id FROM investments WHERE id = $1 AND user_id = $2`,
        [req.params.id, uid]
    );
    const existing = existingRows[0] || null;
    if (!existing) return res.status(404).json({ error: 'Não encontrado' });
    await query(`DELETE FROM investments WHERE id = $1 AND user_id = $2`, [req.params.id, uid]);
    await safeUpsertBalanceSnapshot(uid);
    res.json({ ok: true });
});

// --- Profile ---
app.get('/api/profile', requireAuth, async (req, res) => {
    const { rows } = await query(
        `SELECT
            id,
            email,
            name,
            password_hash AS "passwordHash",
            created_at AS "createdAt",
            currency,
            has_completed_tour AS "hasCompletedTour",
            profile_photo_url AS "profilePhotoURL",
            role,
            finance_preferences AS "financePreferences"
         FROM users
         WHERE id = $1`,
        [req.session.userId]
    );
    const u = rows[0] || null;
    if (!u) return res.status(404).json({ error: 'Não encontrado' });
    res.json(normalizeUserDoc(userSafe(u)));
});

app.patch('/api/profile', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { rows: userRows } = await query(
        `SELECT
            id,
            password_hash AS "passwordHash",
            name,
            currency,
            profile_photo_url AS "profilePhotoURL",
            finance_preferences AS "financePreferences"
         FROM users
         WHERE id = $1`,
        [uid]
    );
    const u = userRows[0] || null;
    if (!u) return res.status(404).json({ error: 'Usuário não encontrado' });
    const { name, currency, profilePhotoURL, financePreferences } = req.body || {};
    
    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (currency !== undefined) data.currency = currency;
    if (profilePhotoURL === null) data.profilePhotoURL = null;
    else if (profilePhotoURL !== undefined) data.profilePhotoURL = profilePhotoURL;
    if (financePreferences !== undefined) {
        if (financePreferences === null || financePreferences === '') {
            data.financePreferences = null;
        } else if (typeof financePreferences === 'string') {
            data.financePreferences = financePreferences;
        } else {
            data.financePreferences = JSON.stringify(financePreferences);
        }
    }
    
    const sets = [];
    const params = [];
    let i = 1;
    function addSet(col, val) {
        sets.push(`${col} = $${i++}`);
        params.push(val);
    }
    if (data.name !== undefined) addSet('name', data.name);
    if (data.currency !== undefined) addSet('currency', data.currency);
    if (data.profilePhotoURL !== undefined) addSet('profile_photo_url', data.profilePhotoURL);
    if (data.financePreferences !== undefined) addSet('finance_preferences', data.financePreferences);

    if (sets.length === 0) {
        return res.json(userSafe(u));
    }

    params.push(uid);
    const { rows: updatedRows } = await query(
        `UPDATE users
         SET ${sets.join(', ')}
         WHERE id = $${i++}
         RETURNING
            id,
            email,
            name,
            created_at AS "createdAt",
            currency,
            has_completed_tour AS "hasCompletedTour",
            profile_photo_url AS "profilePhotoURL",
            role,
            finance_preferences AS "financePreferences"`,
        params
    );
    res.json(userSafe(updatedRows[0]));
});

app.post('/api/profile/password', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { rows } = await query(
        `SELECT id, password_hash AS "passwordHash" FROM users WHERE id = $1`,
        [uid]
    );
    const u = rows[0] || null;
    const { currentPassword, newPassword } = req.body || {};
    if (!u || !bcrypt.compareSync(String(currentPassword || ''), u.passwordHash)) {
        return res.status(400).json({ code: 'auth/wrong-password', error: 'Senha atual incorreta' });
    }
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ code: 'auth/weak-password', error: 'Senha fraca' });
    }
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [uid, passwordHash]);
    res.json({ ok: true });
});

app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Arquivo ausente' });
    const folder = path.basename(path.dirname(req.file.path));
    const url = `/uploads/${folder}/${req.file.filename}`;
    res.json({ url });
});

// --- Categories and Subcategories ---
app.get('/api/categories', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        const [catRes, subRes] = await Promise.all([
            query(
                `SELECT
                    id,
                    user_id AS "userId",
                    name,
                    type,
                    is_default AS "isDefault",
                    created_at AS "createdAt",
                    updated_at AS "updatedAt"
                 FROM categories
                 WHERE user_id = $1
                 ORDER BY name ASC`,
                [uid]
            ),
            query(
                `SELECT
                    id,
                    user_id AS "userId",
                    category_id AS "categoryId",
                    name,
                    is_default AS "isDefault",
                    created_at AS "createdAt",
                    updated_at AS "updatedAt"
                 FROM subcategories
                 WHERE user_id = $1
                 ORDER BY name ASC`,
                [uid]
            )
        ]);
        const categories = catRes.rows.map((c) => ({ ...c, subcategories: [] }));
        const byCat = new Map(categories.map((c) => [c.id, c]));
        for (const s of subRes.rows) {
            const cat = byCat.get(s.categoryId);
            if (cat) cat.subcategories.push(s);
        }
        res.json(categories);
    } catch (e) {
        console.error('GET /api/categories', e);
        res.status(500).json({ error: e.message || 'Erro ao listar categorias' });
    }
});

app.post('/api/categories', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        const { name, type } = req.body || {};
        if (!name || !String(name).trim()) {
            return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
        }
        const categoryType = type === 'GAIN' ? 'GAIN' : 'EXPENSE';

        const n = String(name).trim();
        const { rows: existingRows } = await query(
            `SELECT id FROM categories WHERE user_id = $1 AND name = $2 LIMIT 1`,
            [uid, n]
        );
        if (existingRows[0]) return res.status(409).json({ error: 'Categoria já existe' });

        const id = crypto.randomUUID();
        const { rows } = await query(
            `INSERT INTO categories (id, user_id, name, type, is_default, created_at, updated_at)
             VALUES ($1,$2,$3,$4,false, now(), now())
             RETURNING
                id,
                user_id AS "userId",
                name,
                type,
                is_default AS "isDefault",
                created_at AS "createdAt",
                updated_at AS "updatedAt"`,
            [id, uid, n, categoryType]
        );
        res.json({ ...rows[0], subcategories: [] });
    } catch (error) {
        console.error('Erro ao criar categoria:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.put('/api/categories/:id', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { name, type } = req.body || {};
    if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
    }
    
    const categoryType = type === 'GAIN' ? 'GAIN' : 'EXPENSE';

    const { rows } = await query(
        `UPDATE categories
         SET name = $3, type = $4, updated_at = now()
         WHERE id = $1 AND user_id = $2
         RETURNING
            id,
            user_id AS "userId",
            name,
            type,
            is_default AS "isDefault",
            created_at AS "createdAt",
            updated_at AS "updatedAt"`,
        [req.params.id, uid, String(name).trim(), categoryType]
    );
    if (!rows[0]) return res.sendStatus(404);
    res.json(rows[0]);
});

app.delete('/api/categories/:id', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { rows: existingRows } = await query(
        `SELECT id FROM categories WHERE id = $1 AND user_id = $2`,
        [req.params.id, uid]
    );
    if (!existingRows[0]) return res.status(404).json({ error: 'Categoria não encontrada' });

    await withTransaction(async (client) => {
        await client.query(`DELETE FROM subcategories WHERE category_id = $1 AND user_id = $2`, [
            req.params.id,
            uid
        ]);
        await client.query(`DELETE FROM categories WHERE id = $1 AND user_id = $2`, [req.params.id, uid]);
    });
    res.json({ ok: true });
});

app.get('/api/categories/:id/subcategories', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { rows } = await query(
        `SELECT
            id,
            user_id AS "userId",
            category_id AS "categoryId",
            name,
            is_default AS "isDefault",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
         FROM subcategories
         WHERE category_id = $1 AND user_id = $2
         ORDER BY name ASC`,
        [req.params.id, uid]
    );
    res.json(rows);
});

app.post('/api/categories/:id/subcategories', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        const categoryId = req.params.id;
        const { name } = req.body || {};
        if (!name || !String(name).trim()) {
            return res.status(400).json({ error: 'Nome da subcategoria é obrigatório' });
        }

        const n = String(name).trim();
        const { rows: catRows } = await query(
            `SELECT id FROM categories WHERE id = $1 AND user_id = $2 LIMIT 1`,
            [categoryId, uid]
        );
        if (!catRows[0]) return res.status(404).json({ error: 'Categoria não encontrada' });

        const { rows: existingRows } = await query(
            `SELECT id FROM subcategories WHERE category_id = $1 AND user_id = $2 AND name = $3 LIMIT 1`,
            [categoryId, uid, n]
        );
        if (existingRows[0]) return res.status(409).json({ error: 'Subcategoria já existe' });

        const id = crypto.randomUUID();
        const { rows } = await query(
            `INSERT INTO subcategories (id, user_id, category_id, name, is_default, created_at, updated_at)
             VALUES ($1,$2,$3,$4,false, now(), now())
             RETURNING
                id,
                user_id AS "userId",
                category_id AS "categoryId",
                name,
                is_default AS "isDefault",
                created_at AS "createdAt",
                updated_at AS "updatedAt"`,
            [id, uid, categoryId, n]
        );
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao criar subcategoria:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.put('/api/subcategories/:id', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { name } = req.body || {};
    if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Nome da subcategoria é obrigatório' });
    }
    const { rows } = await query(
        `UPDATE subcategories
         SET name = $3, updated_at = now()
         WHERE id = $1 AND user_id = $2
         RETURNING
            id,
            user_id AS "userId",
            category_id AS "categoryId",
            name,
            is_default AS "isDefault",
            created_at AS "createdAt",
            updated_at AS "updatedAt"`,
        [req.params.id, uid, String(name).trim()]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Subcategoria não encontrada' });
    res.json(rows[0]);
});

app.delete('/api/subcategories/:id', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const { rows } = await query(
        `DELETE FROM subcategories WHERE id = $1 AND user_id = $2 RETURNING id`,
        [req.params.id, uid]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Subcategoria não encontrada' });
    res.json({ ok: true });
});

// --- Delete own account ---
app.delete('/api/user', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    
    await withTransaction(async (client) => {
        await client.query(`DELETE FROM debt_updates WHERE user_id = $1`, [uid]);
        await client.query(`DELETE FROM debts WHERE user_id = $1`, [uid]);
        await client.query(`DELETE FROM balance_snapshots WHERE user_id = $1`, [uid]);
        await client.query(
            `DELETE FROM expense_split_requests WHERE requester_user_id = $1 OR recipient_user_id = $1`,
            [uid]
        );
        await client.query(`DELETE FROM expenses WHERE user_id = $1`, [uid]);
        await client.query(`DELETE FROM gains WHERE user_id = $1`, [uid]);
        await client.query(`DELETE FROM goals WHERE user_id = $1`, [uid]);
        await client.query(`DELETE FROM investments WHERE user_id = $1`, [uid]);
        await client.query(`DELETE FROM accounts WHERE user_id = $1`, [uid]);
        await client.query(`DELETE FROM admin_logs WHERE user_id = $1`, [uid]);
        await client.query(`DELETE FROM subcategories WHERE user_id = $1`, [uid]);
        await client.query(`DELETE FROM categories WHERE user_id = $1`, [uid]);
        await client.query(`DELETE FROM feedbacks WHERE user_id = $1`, [uid]);
        await client.query(`DELETE FROM kanban_cards WHERE created_by = $1`, [uid]);
        await client.query(`DELETE FROM users WHERE id = $1`, [uid]);
    });
    
    try {
        const dir = path.join(UPLOAD_DIR, 'profile_pictures');
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach((fn) => {
                if (fn.startsWith(uid + '-')) fs.unlinkSync(path.join(dir, fn));
            });
        }
    } catch (e) {
        console.warn('Arquivos usuário:', e.message);
    }
    req.session.destroy(() => res.json({ ok: true }));
});

// ========== Admin API ==========
app.get('/api/admin/meta', requireAdmin, (req, res) => {
    res.json({
        projectLabel: 'local (SQL Server)',
        roles: [ROLE_USER, ROLE_ADMIN],
        appVersion: APP_VERSION,
        uploadsPath: 'data/uploads (perfil e ficheiros locais)'
    });
});

app.get('/api/admin/health', requireAdmin, async (req, res) => {
    try {
        await query(`SELECT 1`);
        res.json({ ok: true, database: true, version: APP_VERSION });
    } catch (e) {
        res.status(503).json({ ok: false, database: false, error: e.message });
    }
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    const now = new Date();
    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 7);
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);

    const [
        usersTotalRes,
        usersNew7dRes,
        usersNew30dRes,
        expensesCountRes,
        gainsCountRes,
        sumGainsRes,
        sumExpensesRes,
        avgBalanceRes,
        expenseCatsRes,
        activeUsersRes
    ] = await Promise.all([
        query(`SELECT COUNT(*)::int AS n FROM users`),
        query(`SELECT COUNT(*)::int AS n FROM users WHERE created_at >= $1`, [d7]),
        query(`SELECT COUNT(*)::int AS n FROM users WHERE created_at >= $1`, [d30]),
        query(`SELECT COUNT(*)::int AS n FROM expenses`),
        query(`SELECT COUNT(*)::int AS n FROM gains`),
        query(`SELECT COALESCE(SUM(amount), 0) AS s FROM gains`),
        query(`SELECT COALESCE(SUM(amount), 0) AS s FROM expenses`),
        query(`SELECT COALESCE(AVG(initial_balance), 0) AS a FROM accounts`),
        query(
            `SELECT category, COUNT(*)::int AS count
             FROM expenses
             GROUP BY category
             ORDER BY COUNT(*) DESC
             LIMIT 8`
        ),
        query(
            `SELECT COUNT(*)::int AS n
             FROM (
                 SELECT DISTINCT user_id FROM expenses WHERE date >= $1
                 UNION
                 SELECT DISTINCT user_id FROM gains WHERE date >= $1
             ) t`,
            [d30]
        )
    ]);

    const usersTotal = usersTotalRes.rows[0]?.n ?? 0;
    const usersNew7d = usersNew7dRes.rows[0]?.n ?? 0;
    const usersNew30d = usersNew30dRes.rows[0]?.n ?? 0;
    const expensesCount = expensesCountRes.rows[0]?.n ?? 0;
    const gainsCount = gainsCountRes.rows[0]?.n ?? 0;
    const gainSum = Number(sumGainsRes.rows[0]?.s) || 0;
    const expenseSum = Number(sumExpensesRes.rows[0]?.s) || 0;
    const avgBal = Number(avgBalanceRes.rows[0]?.a) || 0;
    const activeUsers30d = activeUsersRes.rows[0]?.n ?? 0;
    const retentionRatePct =
        usersTotal > 0 ? Math.round((activeUsers30d / usersTotal) * 1000) / 10 : 0;

    const [growth7, growth30] = await Promise.all([buildUserGrowthSeries(7), buildUserGrowthSeries(30)]);

    res.json({
        usersTotal,
        usersNew7d,
        usersNew30d,
        expensesCount,
        gainsCount,
        transactionsTotal: expensesCount + gainsCount,
        sumGains: gainSum,
        sumExpenses: expenseSum,
        avgAccountBalance: avgBal,
        activeUsers30d,
        retentionRatePct,
        topExpenseCategories: expenseCatsRes.rows.map((c) => ({
            category: c.category || '—',
            count: c.count
        })),
        financeDistribution: { gains: gainSum, expenses: expenseSum },
        userGrowth7: growth7,
        userGrowth30: growth30
    });
});

/** Altera o papel de um usuário (somente ADMIN autenticado). */
app.patch('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
    const targetId = req.params.id;
    const { role } = req.body || {};
    const r = String(role || '').toUpperCase();
    if (r !== ROLE_USER && r !== ROLE_ADMIN) {
        return res.status(400).json({ error: 'role deve ser USER ou ADMIN' });
    }
    if (targetId === req.session.userId && r === ROLE_USER) {
        return res.status(400).json({ error: 'Você não pode remover seu próprio papel de administrador aqui' });
    }
    const { rows: targetRows } = await query(
        `SELECT
            id,
            email,
            name,
            password_hash AS "passwordHash",
            created_at AS "createdAt",
            currency,
            has_completed_tour AS "hasCompletedTour",
            profile_photo_url AS "profilePhotoURL",
            role,
            finance_preferences AS "financePreferences"
         FROM users
         WHERE id = $1`,
        [targetId]
    );
    const target = targetRows[0] || null;
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (r === ROLE_USER && userIsAdmin(target)) {
        const { rows: adminCountRows } = await query(
            `SELECT COUNT(*)::int AS n FROM users WHERE UPPER(role) = $1`,
            [ROLE_ADMIN]
        );
        if ((adminCountRows[0]?.n ?? 0) <= 1) {
            return res.status(400).json({ error: 'Deve existir pelo menos um administrador no sistema' });
        }
    }
    const { rows: updatedRows } = await query(
        `UPDATE users SET role = $2 WHERE id = $1
         RETURNING
            id,
            email,
            name,
            password_hash AS "passwordHash",
            created_at AS "createdAt",
            currency,
            has_completed_tour AS "hasCompletedTour",
            profile_photo_url AS "profilePhotoURL",
            role,
            finance_preferences AS "financePreferences"`,
        [targetId, r]
    );
    res.json(normalizeUserDoc(userSafe(updatedRows[0])));
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
    const usersRes = await query(
        `SELECT
            u.id,
            u.email,
            u.name,
            u.password_hash AS "passwordHash",
            u.created_at AS "createdAt",
            u.currency,
            u.has_completed_tour AS "hasCompletedTour",
            u.profile_photo_url AS "profilePhotoURL",
            u.role,
            u.finance_preferences AS "financePreferences",
            COALESCE(ec.expenses_count, 0) + COALESCE(gc.gains_count, 0) AS "ledgerCount"
         FROM users u
         LEFT JOIN (
            SELECT user_id, COUNT(*)::int AS expenses_count
            FROM expenses
            GROUP BY user_id
         ) ec ON ec.user_id = u.id
         LEFT JOIN (
            SELECT user_id, COUNT(*)::int AS gains_count
            FROM gains
            GROUP BY user_id
         ) gc ON gc.user_id = u.id
         ORDER BY u.created_at DESC`
    );
    const users = usersRes.rows;
    res.json(
        users.map((u) => {
            const doc = normalizeUserDoc(userSafe(u));
            return {
                ...doc,
                ledgerCount: Number(u.ledgerCount) || 0
            };
        })
    );
});

app.get('/api/admin/ledger', requireAdmin, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const { rows } = await query(
        `SELECT *
         FROM (
            SELECT
                'receita' AS type,
                id,
                user_id AS "userId",
                account_id AS "accountId",
                category,
                subcategory,
                amount,
                description,
                date,
                is_paid AS "isPaid"
            FROM gains
            UNION ALL
            SELECT
                'despesa' AS type,
                id,
                user_id AS "userId",
                account_id AS "accountId",
                category,
                subcategory,
                amount,
                description,
                date,
                is_paid AS "isPaid"
            FROM expenses
         ) t
         ORDER BY date DESC
         LIMIT $1`,
        [limit]
    );
    res.json(rows.map((r) => ({ ...normalizeMovement(r), type: r.type })));
});

app.get('/api/admin/logs', requireAdmin, async (req, res) => {
    const action = String(req.query.action || '').trim();
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(String(req.query.pageSize || '25'), 10) || 25));
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    const conds = [];
    const params = [];
    let i = 1;
    if (action) {
        conds.push(`al.action = $${i++}`);
        params.push(action);
    }
    if (from && !Number.isNaN(from.getTime())) {
        conds.push(`al.created_at >= $${i++}`);
        params.push(from);
    }
    if (to && !Number.isNaN(to.getTime())) {
        const toEnd = new Date(to);
        toEnd.setHours(23, 59, 59, 999);
        conds.push(`al.created_at <= $${i++}`);
        params.push(toEnd);
    }
    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const [totalRes, listRes] = await Promise.all([
        query(`SELECT COUNT(*)::int AS n FROM admin_logs al ${whereSql}`, params),
        query(
            `SELECT
                al.id,
                al.user_id AS "userId",
                al.action,
                al.details,
                al.created_at AS "createdAt",
                u.email AS "adminEmail",
                u.name AS "adminName"
             FROM admin_logs al
             JOIN users u ON u.id = al.user_id
             ${whereSql}
             ORDER BY al.created_at DESC
             LIMIT $${i++} OFFSET $${i++}`,
            [...params, pageSize, (page - 1) * pageSize]
        )
    ]);
    const total = totalRes.rows[0]?.n ?? 0;
    const list = listRes.rows;

    res.json({
        items: list.map((l) => ({
            ...l,
            timestamp: l.createdAt,
            adminEmail: l.adminEmail || null,
            adminName: l.adminName || null
        })),
        total,
        page,
        pageSize
    });
});

app.get('/api/admin/feedbacks', requireAdmin, async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(String(req.query.pageSize || '20'), 10) || 20));

    const [totalRes, rowsRes] = await Promise.all([
        query(`SELECT COUNT(*)::int AS n FROM feedbacks`),
        query(
            `SELECT
                f.id,
                f.message,
                f.created_at AS "createdAt",
                u.email AS "userEmail",
                u.name AS "userName"
             FROM feedbacks f
             JOIN users u ON u.id = f.user_id
             ORDER BY f.created_at DESC
             LIMIT $1 OFFSET $2`,
            [pageSize, (page - 1) * pageSize]
        )
    ]);
    const total = totalRes.rows[0]?.n ?? 0;
    const rows = rowsRes.rows;

    res.json({
        items: rows.map((f) => ({
            id: f.id,
            message: f.message,
            createdAt: f.createdAt,
            user: { email: f.userEmail, name: f.userName }
        })),
        total,
        page,
        pageSize
    });
});

app.post('/api/admin/logs', requireAdmin, async (req, res) => {
    const { action, details, adminEmail, adminId, userAgent } = req.body || {};
    const id = crypto.randomUUID();
    await query(
        `INSERT INTO admin_logs (id, user_id, action, details, created_at)
         VALUES ($1,$2,$3,$4, now())`,
        [id, adminId || req.session.userId, action || 'unknown', details ? JSON.stringify(details) : null]
    );
    res.json({ id });
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    const userId = req.params.id;
    if (userId === req.session.userId) {
        return res.status(400).json({ error: 'Não pode excluir a si mesmo' });
    }
    
    await withTransaction(async (client) => {
        await client.query(`DELETE FROM debt_updates WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM debts WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM balance_snapshots WHERE user_id = $1`, [userId]);
        await client.query(
            `DELETE FROM expense_split_requests WHERE requester_user_id = $1 OR recipient_user_id = $1`,
            [userId]
        );
        await client.query(`DELETE FROM expenses WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM gains WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM goals WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM investments WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM accounts WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM admin_logs WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM subcategories WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM categories WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM feedbacks WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM kanban_cards WHERE created_by = $1`, [userId]);
        await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    });
    
    res.json({ ok: true });
});

app.patch('/api/admin/accounts/:id/balance', requireAdmin, async (req, res) => {
    const { type, amount } = req.body || {};
    const { rows: accRows } = await query(
        `SELECT id, initial_balance AS "initialBalance" FROM accounts WHERE id = $1`,
        [req.params.id]
    );
    const acc = accRows[0] || null;
    if (!acc) return res.status(404).json({ error: 'Conta não encontrada' });
    const cur = parseFloat(acc.initialBalance);
    const base = Number.isFinite(cur) ? cur : 0;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Valor inválido' });
    
    const next = type === 'receita' ? base + amt : base - amt;
    const { rows: updatedRows } = await query(
        `UPDATE accounts
         SET initial_balance = $2
         WHERE id = $1
         RETURNING
            id,
            user_id AS "userId",
            name,
            type,
            initial_balance AS "initialBalance",
            holder_name AS "holderName",
            plastic_tone AS "plasticTone",
            plastic_color AS "plasticColor",
            "limit",
            close_day AS "closeDay",
            due_day AS "dueDay",
            linked_account_id AS "linkedAccountId"`,
        [req.params.id, next]
    );
    res.json(updatedRows[0]);
});

app.post('/api/admin/users/:id/reset-password', requireAdmin, async (req, res) => {
    const { rows: userRows } = await query(`SELECT id FROM users WHERE id = $1`, [req.params.id]);
    const u = userRows[0] || null;
    if (!u) return res.status(404).json({ error: 'Usuário não encontrado' });
    const temp = crypto.randomBytes(6).toString('base64url');
    const passwordHash = bcrypt.hashSync(temp, 10);
    await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [req.params.id, passwordHash]);
    res.json({ temporaryPassword: temp });
});

app.get('/api/admin/user/:id/details', requireAdmin, async (req, res) => {
    const userId = req.params.id;
    const [
        accRes,
        goalsRes,
        invRes,
        expCountRes,
        gainCountRes,
        lastExpRes,
        lastGainRes
    ] = await Promise.all([
        query(
            `SELECT
                id,
                user_id AS "userId",
                name,
                type,
                initial_balance AS "initialBalance",
                holder_name AS "holderName",
                plastic_tone AS "plasticTone",
                plastic_color AS "plasticColor",
                "limit",
                close_day AS "closeDay",
                due_day AS "dueDay",
                linked_account_id AS "linkedAccountId"
             FROM accounts
             WHERE user_id = $1`,
            [userId]
        ),
        query(
            `SELECT
                id,
                user_id AS "userId",
                name,
                target_amount AS "targetAmount",
                current_amount AS "currentAmount",
                goal_type AS "goalType",
                linked_account_ids AS "linkedAccountIds"
             FROM goals
             WHERE user_id = $1`,
            [userId]
        ),
        query(
            `SELECT
                id,
                user_id AS "userId",
                name,
                category,
                institution,
                current_value AS "currentValue",
                notes,
                linked_account_id AS "linkedAccountId"
             FROM investments
             WHERE user_id = $1`,
            [userId]
        ),
        query(`SELECT COUNT(*)::int AS n FROM expenses WHERE user_id = $1`, [userId]),
        query(`SELECT COUNT(*)::int AS n FROM gains WHERE user_id = $1`, [userId]),
        query(`SELECT date FROM expenses WHERE user_id = $1 ORDER BY date DESC LIMIT 1`, [userId]),
        query(`SELECT date FROM gains WHERE user_id = $1 ORDER BY date DESC LIMIT 1`, [userId])
    ]);
    const accounts = accRes.rows;
    const goals = goalsRes.rows.map(normalizeGoalRow);
    const investments = invRes.rows;
    const expenseCount = expCountRes.rows[0]?.n ?? 0;
    const gainCount = gainCountRes.rows[0]?.n ?? 0;
    const lastExpense = lastExpRes.rows[0] || null;
    const lastGain = lastGainRes.rows[0] || null;

    let lastActivity = null;
    const le = lastExpense?.date ? new Date(lastExpense.date).getTime() : 0;
    const lg = lastGain?.date ? new Date(lastGain.date).getTime() : 0;
    if (le || lg) {
        lastActivity = new Date(Math.max(le, lg)).toISOString();
    }

    res.json({
        accounts,
        goals,
        investments,
        summary: {
            expenseCount,
            gainCount,
            lastActivity
        }
    });
});

// --- Kanban Cards (compartilhado entre todos usuários) ---
app.get('/api/kanban-cards', requireAuth, async (req, res) => {
    try {
        const { rows } = await query(
            `SELECT
                kc.id,
                kc.title,
                kc.type,
                kc.column,
                kc.description,
                kc.image,
                kc.screen,
                kc.steps,
                kc.expected,
                kc.actual,
                kc.benefit,
                kc.created_by AS "createdBy",
                kc.created_at AS "createdAt",
                kc.updated_at AS "updatedAt",
                json_build_object('id', u.id, 'name', u.name, 'email', u.email) AS creator
             FROM kanban_cards kc
             JOIN users u ON u.id = kc.created_by
             ORDER BY kc.created_at DESC`
        );
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar kanban cards:', error);
        res.status(500).json({ error: 'Erro ao buscar cards' });
    }
});

app.post('/api/kanban-cards', requireAuth, async (req, res) => {
    try {
        const uid = req.session.userId;
        const {
            title, description, column: columnValue, image,
            type, screen, steps, expected, actual, benefit
        } = req.body || {};

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Título é obrigatório' });
        }

        // Validar tipo
        const validTypes = ['bug', 'melhoria'];
        const cardType = validTypes.includes(type) ? type : 'melhoria';

        // Validar tamanho da imagem (max ~1.5MB em Base64)
        if (image && image.length > 2 * 1024 * 1024) {
            return res.status(400).json({ error: 'Imagem muito grande. Máximo 1.5MB.' });
        }

        const validColumns = ['backlog', 'ativo', 'teste', 'finalizado'];
        const column = validColumns.includes(columnValue) ? columnValue : 'backlog';

        const id = crypto.randomUUID();
        const { rows } = await query(
            `INSERT INTO kanban_cards (
                id, title, type, "column",
                description, image,
                screen, steps, expected, actual, benefit,
                created_by, created_at, updated_at
             ) VALUES (
                $1,$2,$3,$4,
                $5,$6,
                $7,$8,$9,$10,$11,
                $12, now(), now()
             )
             RETURNING
                id, title, type, "column", description, image,
                screen, steps, expected, actual, benefit,
                created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"`,
            [
                id,
                title.trim(),
                cardType,
                column,
                description?.trim() || null,
                image || null,
                cardType === 'bug' ? screen?.trim() || null : null,
                cardType === 'bug' ? steps?.trim() || null : null,
                cardType === 'bug' ? expected?.trim() || null : null,
                cardType === 'bug' ? actual?.trim() || null : null,
                cardType === 'melhoria' ? benefit?.trim() || null : null,
                uid
            ]
        );
        const card = rows[0];
        const { rows: creatorRows } = await query(
            `SELECT json_build_object('id', id, 'name', name, 'email', email) AS creator FROM users WHERE id = $1`,
            [uid]
        );
        res.json({ ...card, creator: creatorRows[0]?.creator });
    } catch (error) {
        console.error('Erro ao criar kanban card:', error);
        console.error('Detalhes:', error.message);
        if (error.meta) console.error('Meta:', error.meta);
        res.status(500).json({ error: 'Erro ao criar card', details: error.message });
    }
});

app.put('/api/kanban-cards/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title, description, column: columnValue, image,
            type, screen, steps, expected, actual, benefit
        } = req.body || {};
        const { rows: existingRows } = await query(
            `SELECT created_by AS "createdBy" FROM kanban_cards WHERE id = $1`,
            [id]
        );
        const existing = existingRows[0] || null;
        if (!existing) return res.status(404).json({ error: 'Card não encontrado' });

        // Validar tamanho da imagem (max ~1.5MB em Base64 ~ 2MB original)
        if (image && image.length > 2 * 1024 * 1024) {
            return res.status(400).json({ error: 'Imagem muito grande. Máximo 1.5MB.' });
        }

        const validColumns = ['backlog', 'ativo', 'teste', 'finalizado'];
        const validTypes = ['bug', 'melhoria'];

        const sets = [];
        const params = [];
        let i = 1;
        function addSet(col, val) {
            sets.push(`${col} = $${i++}`);
            params.push(val);
        }
        if (title !== undefined) addSet('title', title.trim());
        if (type !== undefined && validTypes.includes(type)) addSet('type', type);
        if (description !== undefined) addSet('description', description?.trim() || null);
        if (columnValue !== undefined && validColumns.includes(columnValue)) addSet('"column"', columnValue);
        if (image !== undefined) addSet('image', image || null);
        if (screen !== undefined) addSet('screen', screen?.trim() || null);
        if (steps !== undefined) addSet('steps', steps?.trim() || null);
        if (expected !== undefined) addSet('expected', expected?.trim() || null);
        if (actual !== undefined) addSet('actual', actual?.trim() || null);
        if (benefit !== undefined) addSet('benefit', benefit?.trim() || null);
        addSet('updated_at', new Date());

        params.push(id);
        const { rows } = await query(
            `UPDATE kanban_cards
             SET ${sets.join(', ')}
             WHERE id = $${i++}
             RETURNING
                id, title, type, "column", description, image,
                screen, steps, expected, actual, benefit,
                created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"`,
            params
        );
        const card = rows[0];
        const { rows: creatorRows } = await query(
            `SELECT json_build_object('id', id, 'name', name, 'email', email) AS creator FROM users WHERE id = $1`,
            [card.createdBy]
        );
        res.json({ ...card, creator: creatorRows[0]?.creator });
    } catch (error) {
        console.error('Erro ao atualizar kanban card:', error);
        console.error('Detalhes:', error.message, error.stack);
        res.status(500).json({ error: 'Erro ao atualizar card', details: error.message });
    }
});

app.delete('/api/kanban-cards/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await query(`DELETE FROM kanban_cards WHERE id = $1 RETURNING id`, [id]);
        if (!rows[0]) return res.status(404).json({ error: 'Card não encontrado' });
        res.json({ ok: true });
    } catch (error) {
        console.error('Erro ao deletar kanban card:', error);
        res.status(500).json({ error: 'Erro ao deletar card' });
    }
});

registerExpenseSplitRoutes(app, { requireAuth });

/** Produção (Railway etc.): um único processo Node serve o build Vite (`dist`) e a API. */
const distPath = path.join(ROOT, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get(/.*/, (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(path.join(distPath, 'index.html'), (err) => (err ? next(err) : undefined));
    });
}

const server = app.listen(PORT, HOST, () => {
    console.log(`API Full Finanças em http://localhost:${PORT}`);
    logLanUrls(PORT);
});
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(
            `\n[ERRO] A porta ${PORT} já está em uso.\n` +
                '  Feche o outro terminal com "npm run server" ou mate o processo:\n' +
                '  netstat -ano | findstr :' +
                PORT +
                '\n' +
                '  taskkill /PID <PID> /F\n' +
                '  Ou use outra porta: PowerShell: $env:PORT=3002; npm run dev\n'
        );
        process.exit(1);
    }
    throw err;
});
