import { query } from '../db.js';

export function registerHealthRoutes(app) {
    app.get('/api/health', async (_req, res) => {
        try {
            await query('SELECT 1');
            res.json({ ok: true, db: true });
        } catch (err) {
            console.error('[api/health]', {
                message: err?.message,
                code: err?.code,
                errno: err?.errno,
                address: err?.address,
                port: err?.port,
                detail: err?.detail
            });
            res.status(503).json({ ok: false, db: false, error: 'database_unavailable' });
        }
    });
}