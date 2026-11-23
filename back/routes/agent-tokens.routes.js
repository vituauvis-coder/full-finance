import crypto from 'node:crypto';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { rejectAgentSession, generateAgentTokenPlain, hashAgentToken } from '../middleware/agent-auth.js';

const DEFAULT_SCOPES = ['finance:read', 'finance:write'];

function normalizeScopes(raw) {
    if (raw == null) return DEFAULT_SCOPES;
    if (!Array.isArray(raw)) return null;
    const allowed = new Set(['finance:read', 'finance:write']);
    const scopes = [...new Set(raw.map((s) => String(s).trim()).filter((s) => allowed.has(s)))];
    return scopes.length > 0 ? scopes : null;
}

export function registerAgentTokenRoutes(app) {
    app.get('/api/agent-tokens', requireAuth, rejectAgentSession, async (req, res) => {
        try {
            const uid = req.session.userId;
            const { rows } = await query(
                `SELECT
                    id,
                    name,
                    scopes,
                    created_at AS "createdAt",
                    last_used_at AS "lastUsedAt",
                    revoked_at AS "revokedAt"
                 FROM agent_tokens
                 WHERE user_id = $1
                 ORDER BY created_at DESC`,
                [uid]
            );
            res.json(rows.filter((r) => !r.revokedAt));
        } catch (e) {
            console.error('GET /api/agent-tokens', e);
            res.status(500).json({ error: e.message || 'Erro ao listar tokens' });
        }
    });

    app.post('/api/agent-tokens', requireAuth, rejectAgentSession, async (req, res) => {
        try {
            const uid = req.session.userId;
            const name = String(req.body?.name ?? '').trim();
            if (!name) return res.status(400).json({ error: 'Nome do token é obrigatório' });
            const scopes = normalizeScopes(req.body?.scopes);
            if (!scopes) return res.status(400).json({ error: 'scopes inválidos' });

            const plain = generateAgentTokenPlain();
            const tokenHash = hashAgentToken(plain);
            const id = crypto.randomUUID();
            const { rows } = await query(
                `INSERT INTO agent_tokens (id, user_id, name, token_hash, scopes, created_at)
                 VALUES ($1,$2,$3,$4,$5, now())
                 RETURNING
                    id,
                    name,
                    scopes,
                    created_at AS "createdAt"`,
                [id, uid, name, tokenHash, scopes]
            );
            res.status(201).json({
                token: plain,
                tokenMeta: rows[0],
                warning: 'Guarde o token agora; ele não será exibido novamente.'
            });
        } catch (e) {
            console.error('POST /api/agent-tokens', e);
            res.status(500).json({ error: e.message || 'Erro ao criar token' });
        }
    });

    app.delete('/api/agent-tokens/:id', requireAuth, rejectAgentSession, async (req, res) => {
        try {
            const uid = req.session.userId;
            const id = String(req.params.id ?? '').trim();
            const { rows } = await query(
                `UPDATE agent_tokens
                 SET revoked_at = now()
                 WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
                 RETURNING id`,
                [id, uid]
            );
            if (!rows[0]) return res.status(404).json({ error: 'Token não encontrado' });
            res.json({ ok: true, id: rows[0].id });
        } catch (e) {
            console.error('DELETE /api/agent-tokens/:id', e);
            res.status(500).json({ error: e.message || 'Erro ao revogar token' });
        }
    });
}