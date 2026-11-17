/**
 * Lê uma conta do SQL Server local (backup FullFinan) e insere em public.accounts no Postgres (Supabase).
 *
 * Uso (PowerShell, na raiz do projeto):
 *   $env:SUPABASE_USER_EMAIL="seu@email.com"
 *   $env:MSSQL_USE_LOCALDB="1"
 *   $env:MSSQL_DATABASE="FullFinan"
 *   node scripts/restore-account-sqlserver-to-supabase.mjs
 *
 * Opcional:
 *   $env:ACCOUNT_NAME_FILTER="Itaú"   # padrão: Itaú
 *   $env:DRY_RUN="1"                 # só mostra o que faria
 *
 * Conexão SQL Server alternativa:
 *   Autenticação Windows (SSMS / Integrated Security) — use objeto de config, NÃO connection string com Trusted_Connection (o driver enviaria user vazio):
 *   $env:MSSQL_INTEGRATED_SECURITY="1"
 *   $env:MSSQL_SERVER="NOTE-VICTOR"
 *   $env:MSSQL_DATABASE="FullFinan"
 *
 *   SQL Login:
 *   $env:MSSQL_SERVER="localhost"
 *   $env:MSSQL_USER="sa"
 *   $env:MSSQL_PASSWORD="..."
 *   $env:MSSQL_DATABASE="FullFinan"
 *
 *   $env:MSSQL_CONNECTION_STRING="..."  (apenas com User Id + Password; sem Integrated Security)
 */
import 'dotenv/config';
import sql from 'mssql';
import pg from 'pg';

const { Pool } = pg;

const ACCOUNT_FILTER = (process.env.ACCOUNT_NAME_FILTER || 'Itaú').trim();
const DRY = ['1', 'true', 'yes'].includes(String(process.env.DRY_RUN || '').toLowerCase());
const TARGET_EMAIL =
    process.argv[2]?.trim().toLowerCase() || process.env.SUPABASE_USER_EMAIL?.trim().toLowerCase();

const pgUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
if (!pgUrl) {
    console.error('Defina DATABASE_URL ou TARGET_DATABASE_URL no .env (Postgres/Supabase).');
    process.exit(1);
}
if (!TARGET_EMAIL) {
    console.error(
        'Passe o e-mail do usuário no Supabase: node scripts/restore-account-sqlserver-to-supabase.mjs seu@email.com\n' +
            'Ou defina SUPABASE_USER_EMAIL.'
    );
    process.exit(1);
}

function mssqlConfig() {
    const db = process.env.MSSQL_DATABASE || 'FullFinan';
    const integrated = ['1', 'true', 'yes'].includes(
        String(process.env.MSSQL_INTEGRATED_SECURITY || process.env.MSSQL_USE_WINDOWS_AUTH || '').toLowerCase()
    );
    if (integrated) {
        const server = process.env.MSSQL_SERVER?.trim() || 'NOTE-VICTOR';
        const encrypt = !['0', 'false', 'no'].includes(String(process.env.MSSQL_ENCRYPT || '').toLowerCase());
        const trust = !['0', 'false', 'no'].includes(String(process.env.MSSQL_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase());
        return {
            server,
            database: db,
            options: {
                encrypt,
                trustServerCertificate: trust,
                enableArithAbort: true
            }
        };
    }
    if (process.env.MSSQL_CONNECTION_STRING?.trim()) {
        return process.env.MSSQL_CONNECTION_STRING.trim();
    }
    if (['1', 'true', 'yes'].includes(String(process.env.MSSQL_USE_LOCALDB || '').toLowerCase())) {
        return (
            `Server=(localdb)\\MSSQLLocalDB;Database=${db};` +
            `Trusted_Connection=yes;TrustServerCertificate=yes;Encrypt=false`
        );
    }
    const server = process.env.MSSQL_SERVER || 'localhost';
    const user = process.env.MSSQL_USER;
    const password = process.env.MSSQL_PASSWORD;
    if (!user || password === undefined) {
        console.error(
            'SQL Server: use MSSQL_INTEGRATED_SECURITY=1 + MSSQL_SERVER + MSSQL_DATABASE (Windows), ou MSSQL_USE_LOCALDB=1, ou MSSQL_USER + MSSQL_PASSWORD + MSSQL_SERVER.'
        );
        process.exit(1);
    }
    return {
        server,
        user,
        password,
        database: db,
        options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true }
    };
}

async function fetchAccountFromMssql(pool) {
    const q = `
        SELECT TOP 10
            id,
            userId,
            name,
            type,
            initialBalance,
            holderName,
            plasticTone,
            plasticColor,
            [limit] AS lim,
            closeDay,
            dueDay,
            linkedAccountId
        FROM [dbo].[Account]
        WHERE name LIKE @pat1 OR name LIKE N'%(Mi)%'
        ORDER BY name ASC
    `;
    const r = await pool.request().input('pat1', sql.NVarChar, `%${ACCOUNT_FILTER}%`).query(q);
    return r.recordset;
}

async function fetchLinkedAccountName(pool, linkedId) {
    if (!linkedId) return null;
    const r = await pool
        .request()
        .input('id', sql.NVarChar, linkedId)
        .query(`SELECT name, type FROM [dbo].[Account] WHERE id = @id`);
    return r.recordset[0] || null;
}

async function main() {
    const mssqlPool = await sql.connect(mssqlConfig());
    let rows;
    try {
        rows = await fetchAccountFromMssql(mssqlPool);
    } finally {
        await mssqlPool.close();
    }

    if (!rows.length) {
        console.error(`Nenhuma conta no SQL Server com nome parecido com "${ACCOUNT_FILTER}" ou "(Mi)".`);
        process.exit(1);
    }

    const pick =
        rows.find((r) => /Itaú/i.test(r.name) && /\(Mi\)/i.test(r.name)) ||
        rows.find((r) => /Itaú/i.test(r.name)) ||
        rows[0];
    console.log('Conta encontrada no SQL Server:', {
        id: pick.id,
        name: pick.name,
        type: pick.type,
        userId: pick.userId,
        linkedAccountId: pick.linkedAccountId
    });

    const pool = new Pool({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
    try {
        const { rows: urows } = await pool.query(
            `SELECT id, email FROM users WHERE lower(email) = $1 LIMIT 1`,
            [TARGET_EMAIL]
        );
        const u = urows[0];
        if (!u) {
            console.error(`Usuário não encontrado no Supabase: ${TARGET_EMAIL}`);
            process.exit(1);
        }
        const userId = u.id;

        let linkedPg = null;
        if (pick.linkedAccountId) {
            const m2 = await sql.connect(mssqlConfig());
            let linkedName = null;
            try {
                const info = await fetchLinkedAccountName(m2, pick.linkedAccountId);
                linkedName = info?.name || null;
            } finally {
                await m2.close();
            }
            if (linkedName) {
                const { rows: lrows } = await pool.query(
                    `SELECT id, name FROM accounts WHERE user_id = $1 AND name = $2 LIMIT 1`,
                    [userId, linkedName]
                );
                linkedPg = lrows[0]?.id || null;
                if (!linkedPg) {
                    console.warn(
                        `Aviso: conta vinculada "${linkedName}" não existe no Supabase para este usuário. linked_account_id ficará NULL.`
                    );
                    if (pick.type === 'cartao_credito' || pick.type === 'cartao_debito') {
                        console.error(
                            'Cartão exige conta bancária vinculada no app. Crie a conta bancária no Supabase ou importe-a antes e rode de novo.'
                        );
                        process.exit(1);
                    }
                }
            }
        }

        const initialBalance = Number(pick.initialBalance) || 0;
        const lim = pick.lim != null && pick.lim !== '' ? Number(pick.lim) : null;

        const insertSql = `
            INSERT INTO accounts (
                id, user_id, name, type, initial_balance, holder_name,
                plastic_tone, plastic_color, "limit", close_day, due_day, linked_account_id
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11, $12
            )
            ON CONFLICT (id) DO NOTHING
            RETURNING id
        `;

        const params = [
            pick.id,
            userId,
            pick.name,
            pick.type,
            initialBalance,
            pick.holderName ?? null,
            pick.plasticTone ?? null,
            pick.plasticColor ?? null,
            lim,
            pick.closeDay ?? null,
            pick.dueDay ?? null,
            linkedPg
        ];

        if (DRY) {
            console.log('[DRY_RUN] INSERT params:', params);
            return;
        }

        const ins = await pool.query(insertSql, params);
        if (ins.rowCount === 0) {
            const { rows: ex } = await pool.query(`SELECT id, name FROM accounts WHERE id = $1`, [pick.id]);
            if (ex.length) {
                console.log('Conta já existia no Supabase (mesmo id):', ex[0]);
            } else {
                console.log('INSERT não retornou linha (ON CONFLICT DO NOTHING).');
            }
        } else {
            console.log('Conta inserida no Supabase:', ins.rows[0]);
        }

        console.log('OK. Abra o app e confira a lista de contas (o saldo snapshot atualiza ao usar o sistema).');
    } finally {
        await pool.end();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
