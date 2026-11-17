import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { publicAuthUser, ROLE_USER } from '../lib/roles.js';

export function registerAuthRoutes(app) {
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
            const { rows } = await query(
                `INSERT INTO users (email, name, password_hash, currency, has_completed_tour, role, finance_anchor_month)
             VALUES ($1, $2, $3, 'BRL', false, $4, date_trunc('month', now())::date)
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
}