/**
 * Aplica migração de alocação de investimentos (caixinhas + aplicações + metas).
 * Uso: node scripts/pg-migrate-investment-allocation.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from '../server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(
    __dirname,
    '../prisma/migrations/20260517120000_investment_allocation/migration_pg.sql'
);

const sql = fs.readFileSync(sqlPath, 'utf8');

try {
    await query(sql);
    console.log('Migração investment_allocation aplicada com sucesso.');
} catch (e) {
    console.error('Falha ao aplicar migração:', e.message || e);
    process.exitCode = 1;
} finally {
    await pool.end();
}
