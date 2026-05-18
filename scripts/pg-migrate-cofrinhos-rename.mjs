/**
 * Aplica rename investimentos → cofrinhos (tabelas, is_cofrinho, drop goals).
 * Uso: node scripts/pg-migrate-cofrinhos-rename.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from '../server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(
    __dirname,
    '../prisma/migrations/20260517130000_cofrinhos_rename/migration_pg.sql'
);

const sql = fs.readFileSync(sqlPath, 'utf8');

try {
    await query(sql);
    console.log('Migração cofrinhos_rename aplicada com sucesso.');
} catch (e) {
    console.error('Falha ao aplicar migração:', e.message || e);
    process.exitCode = 1;
} finally {
    await pool.end();
}
