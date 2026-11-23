import crypto from 'node:crypto';
import { query } from '../db.js';

export const AGENT_TOKEN_PREFIX = 'mm_agent_';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 120;

/** @type {Map<string, { windowStart: number, count: number }>} */
const rateByTokenId = new Map();

/**
 * Rotas permitidas com token de agente e escopo exigido.
 * Demais rotas autenticadas via agente → 403.
 */
export const AGENT_FINANCE_ROUTES = [
    { method: 'GET', pattern: /^\/api\/accounts\/?$/, scope: 'finance:read' },
    { method: 'GET', pattern: /^\/api\/categories\/?$/, scope: 'finance:read' },
    { method: 'GET', pattern: /^\/api\/expenses\/?$/, scope: 'finance:read' },
    { method: 'GET', pattern: /^\/api\/gains\/?$/, scope: 'finance:read' },
    { method: 'POST', pattern: /^\/api\/expenses\/?$/, scope: 'finance:write' },
    { method: 'POST', pattern: /^\/api\/gains\/?$/, scope: 'finance:write' },
    { method: 'PUT', pattern: /^\/api\/expenses\/[^/]+$/, scope: 'finance:write' },
    { method: 'PATCH', pattern: /^\/api\/expenses\/[^/]+$/, scope: 'finance:write' },
    { method: 'DELETE', pattern: /^\/api\/expenses\/[^/]+$/, scope: 'finance:write' },
    { method: 'PUT', pattern: /^\/api\/gains\/[^/]+$/, scope: 'finance:write' },
    { method: 'PATCH', pattern: /^\/api\/gains\/[^/]+$/, scope: 'finance:write' },
    { method: 'DELETE', pattern: /^\/api\/gains\/[^/]+$/, scope: 'finance:write' }
];

export function hashAgentToken(plain) {
    return crypto.createHash('sha256').update(plain, 'utf8').digest('hex');
}

export function generateAgentTokenPlain() {
    return `${AGENT_TOKEN_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
}

function parseBearerAgentToken(req) {
    const h = req.headers.authorization;
    if (!h || typeof h !== 'string') return null;
    const m = /^Bearer\s+(\S+)\s*$/i.exec(h);
    if (!m) return null;
    const token = m[1];
    if (!token.startsWith(AGENT_TOKEN_PREFIX)) return null;
    return token;
}

function matchAgentRoute(method, path) {
    const m = String(method || 'GET').toUpperCase();
    const p = path.split('?')[0];
    for (const rule of AGENT_FINANCE_ROUTES) {
        if (rule.method === m && rule.pattern.test(p)) return rule.scope;
    }
    return null;
}

function hasScope(scopes, required) {
    const set = new Set((scopes || []).map((s) => String(s).trim()));
    return set.has(required);
}

function checkAgentRateLimit(tokenId) {
    const now = Date.now();
    let bucket = rateByTokenId.get(tokenId);
    if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
        bucket = { windowStart: now, count: 0 };
        rateByTokenId.set(tokenId, bucket);
    }
    bucket.count += 1;
    if (bucket.count > RATE_MAX_PER_WINDOW) {
        const err = new Error('Muitas requisições; tente novamente em instantes.');
        err.statusCode = 429;
        throw err;
    }
}

/**
 * Valida Bearer mm_agent_* e preenche req.session como login por cookie.
 */
export async function agentBearerMiddleware(req, res, next) {
    const plain = parseBearerAgentToken(req);
    if (!plain) return next();

    try {
        const tokenHash = hashAgentToken(plain);
        const { rows } = await query(
            `SELECT id, user_id AS "userId", scopes, revoked_at AS "revokedAt"
             FROM agent_tokens
             WHERE token_hash = $1
             LIMIT 1`,
            [tokenHash]
        );
        const row = rows[0];
        if (!row || row.revokedAt) {
            return res.status(401).json({ error: 'Token de agente inválido ou revogado' });
        }

        checkAgentRateLimit(row.id);

        req.session.userId = row.userId;
        req.session.authVia = 'agent';
        req.session.agentTokenId = row.id;
        req.session.agentScopes = Array.isArray(row.scopes) ? row.scopes : [];

        query(`UPDATE agent_tokens SET last_used_at = now() WHERE id = $1`, [row.id]).catch(() => {});

        next();
    } catch (e) {
        const code = e.statusCode || 500;
        res.status(code).json({ error: e.message || 'Erro de autenticação do agente' });
    }
}

/** Bloqueia agentes fora das rotas financeiras ou sem escopo. */
export function agentScopeGuard(req, res, next) {
    if (req.session?.authVia !== 'agent') return next();

    const required = matchAgentRoute(req.method, req.path);
    if (!required) {
        return res.status(403).json({ error: 'Rota não permitida para token de agente' });
    }
    if (!hasScope(req.session.agentScopes, required)) {
        return res.status(403).json({ error: `Escopo obrigatório: ${required}` });
    }
    return next();
}

/** Impede criação de token usando outro token de agente. */
export function rejectAgentSession(req, res, next) {
    if (req.session?.authVia === 'agent') {
        return res.status(403).json({ error: 'Use a sessão do app para gerenciar tokens de agente' });
    }
    next();
}