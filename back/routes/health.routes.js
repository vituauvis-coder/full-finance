import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db.js';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const reactIndex = path.join(repoRoot, 'front', 'dist', 'index.html');

export function registerHealthRoutes(app) {
    app.get('/api/health', async (_req, res) => {
        const front = fs.existsSync(reactIndex);
        try {
            await query('SELECT 1');
            res.json({ ok: true, db: true, front });
        } catch (err) {
            console.error('[api/health]', {
                message: err?.message,
                code: err?.code,
                errno: err?.errno,
                address: err?.address,
                port: err?.port,
                detail: err?.detail
            });
            res.status(503).json({ ok: false, db: false, front, error: 'database_unavailable' });
        }
    });
}