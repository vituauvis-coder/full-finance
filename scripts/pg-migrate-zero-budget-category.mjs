/**
 * Aplica em PostgreSQL a migração category_name em zero_budget_blocks
 * (resolve: column "category_name" does not exist).
 *
 * Uso: npm run db:zero-budget:category
 * Requer DATABASE_URL no .env (mesmo do servidor).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from '../server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(
    __dirname,
    '../prisma/migrations/20260502183000_zero_budget_category_on_block/migration_pg.sql'
);

const sql = fs.readFileSync(sqlPath, 'utf8');

try {
    await query(sql);
    console.log('Migração zero_budget category_name aplicada com sucesso.');
} catch (e) {
    console.error('Falha ao aplicar migração:', e.message || e);
    process.exitCode = 1;
} finally {
    await pool.end();
}
