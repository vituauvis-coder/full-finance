import { query } from '../db.js';
import { userIsAdmin } from '../lib/roles.js';

export function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Não autenticado' });
    }
    next();
}

export async function requireAdmin(req, res, next) {
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