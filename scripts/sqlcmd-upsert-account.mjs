/**
 * Exporta uma conta do SQL Server via sqlcmd (Windows auth) e faz upsert em public.accounts.
 * Uso: node scripts/sqlcmd-upsert-account.mjs <account-uuid>
 * Requer: sqlcmd no PATH, SQL Server acessível com -E (trusted).
 * Env: MSSQL_SERVER (default NOTE-VICTOR), MSSQL_DATABASE (default FullFinan)
 *      DATABASE_URL no .env
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../server/db.js';

const accountId = process.argv[2]?.trim();
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!accountId || !uuidRe.test(accountId)) {
    console.error('Uso: node scripts/sqlcmd-upsert-account.mjs <uuid-da-conta>');
    process.exit(1);
}

const server = process.env.MSSQL_SERVER || 'NOTE-VICTOR';
const database = process.env.MSSQL_DATABASE || 'FullFinan';
const outPath = path.join('data', `sqlcmd-account-${accountId}.json`);
const q = `SET NOCOUNT ON; SELECT id, name, type, userId, linkedAccountId, initialBalance, closeDay, dueDay, holderName, plasticTone, plasticColor, [limit] FROM dbo.Account WHERE id = '${accountId}' FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;`;

execFileSync(
    'sqlcmd',
    ['-S', server, '-E', '-d', database, '-f', '65001', '-y', '0', '-w', '65535', '-Q', q, '-o', outPath],
    { stdio: 'inherit' }
);

const raw = fs.readFileSync(outPath, 'utf8');
const line = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s.startsWith('{'));
if (!line) {
    console.error('JSON não encontrado na saída do sqlcmd:', outPath);
    process.exit(1);
}

const row = JSON.parse(line);

try {
    const u = await pool.query('SELECT id, email FROM users WHERE id = $1', [row.userId]);
    if (!u.rows.length) {
        console.error(`users.id não existe no Supabase: ${row.userId}`);
        process.exit(1);
    }
    console.log('Usuário OK:', u.rows[0].email);

    let linked = row.linkedAccountId ?? null;
    if (linked) {
        const chk = await pool.query('SELECT 1 FROM accounts WHERE id = $1 AND user_id = $2', [linked, row.userId]);
        if (!chk.rows.length) {
            console.warn(`linked_account_id ${linked} não existe no Supabase — definindo NULL.`);
            linked = null;
            if (row.type === 'cartao_credito' || row.type === 'cartao_debito') {
                console.error('Cartão sem conta vinculada no destino. Importe a conta bancária antes.');
                process.exit(1);
            }
        }
    }

    const ins = await pool.query(
        `INSERT INTO accounts (
            id, user_id, name, type, initial_balance, holder_name,
            plastic_tone, plastic_color, "limit", close_day, due_day, linked_account_id
        ) VALUES (
            $1,$2,$3,$4,$5,$6,
            $7,$8,$9,$10,$11,$12
        )
        ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            name = EXCLUDED.name,
            type = EXCLUDED.type,
            initial_balance = EXCLUDED.initial_balance,
            holder_name = EXCLUDED.holder_name,
            plastic_tone = EXCLUDED.plastic_tone,
            plastic_color = EXCLUDED.plastic_color,
            "limit" = EXCLUDED."limit",
            close_day = EXCLUDED.close_day,
            due_day = EXCLUDED.due_day,
            linked_account_id = EXCLUDED.linked_account_id
        RETURNING id, name`,
        [
            row.id,
            row.userId,
            row.name,
            row.type,
            Number(row.initialBalance) || 0,
            row.holderName ?? null,
            row.plasticTone ?? null,
            row.plasticColor ?? null,
            row.limit != null && row.limit !== '' ? Number(row.limit) : null,
            row.closeDay ?? null,
            row.dueDay ?? null,
            linked
        ]
    );
    console.log('Upsert OK:', ins.rows[0]);
} finally {
    await pool.end().catch(() => {});
}
