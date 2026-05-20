/**
 * Campos de card de dívida (cor, valor inicial, desconto da oferta).
 * Uso: node scripts/pg-migrate-debt-card-fields.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from '../server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(
    __dirname,
    '../prisma/migrations/20260520120000_debt_card_fields/migration_pg.sql'
);

const sql = fs.readFileSync(sqlPath, 'utf8');

try {
    await query(sql);
    console.log('Migração debt_card_fields aplicada com sucesso.');
} catch (e) {
    console.error('Falha ao aplicar migração:', e.message || e);
    process.exitCode = 1;
} finally {
    await pool.end();
}
