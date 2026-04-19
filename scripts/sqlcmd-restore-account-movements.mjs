/**
 * Restaura despesas e ganhos do SQL Server (backup) para o Supabase, para uma conta.
 * Uso: node scripts/sqlcmd-restore-account-movements.mjs <account-uuid>
 *
 * Requer: sqlcmd, DATABASE_URL no .env, pool em server/db.js
 * Env: MSSQL_SERVER (default NOTE-VICTOR), MSSQL_DATABASE (default FullFinan)
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../server/db.js';

const accountId = process.argv[2]?.trim();
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!accountId || !uuidRe.test(accountId)) {
    console.error('Uso: node scripts/sqlcmd-restore-account-movements.mjs <uuid-da-conta>');
    process.exit(1);
}

const server = process.env.MSSQL_SERVER || 'NOTE-VICTOR';
const database = process.env.MSSQL_DATABASE || 'FullFinan';

function runSqlcmdJson(query, outPath) {
    execFileSync('sqlcmd', ['-S', server, '-E', '-d', database, '-f', '65001', '-y', '0', '-w', '65535', '-Q', query, '-o', outPath], {
        stdio: 'inherit'
    });
}

function parseJsonArrayFile(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    const line = raw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .find((s) => s.startsWith('[') || s.startsWith('{'));
    if (!line) return [];
    try {
        const data = JSON.parse(line);
        return Array.isArray(data) ? data : [data];
    } catch {
        return [];
    }
}

function parseDate(v) {
    if (v == null) return new Date();
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? new Date() : d;
}

async function splitRequestExists(client, id) {
    if (!id) return false;
    const r = await client.query('SELECT 1 FROM expense_split_requests WHERE id = $1', [id]);
    return r.rows.length > 0;
}

async function expenseExists(client, id) {
    if (!id) return false;
    const r = await client.query('SELECT 1 FROM expenses WHERE id = $1', [id]);
    return r.rows.length > 0;
}

async function main() {
    const accCheck = await pool.query('SELECT id, user_id, name FROM accounts WHERE id = $1', [accountId]);
    if (!accCheck.rows.length) {
        console.error(`Conta não existe no Supabase: ${accountId}. Restaure a conta antes.`);
        process.exit(1);
    }
    console.log('Conta no Supabase:', accCheck.rows[0]);

    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const expPath = path.join(dataDir, `restore-expenses-${accountId}.json`);
    const gainPath = path.join(dataDir, `restore-gains-${accountId}.json`);

    const qExp = `SET NOCOUNT ON; SELECT id, userId, accountId, category, subcategory, amount, description, date, createdAt, isPaid, isInvestment, installmentCount, cashOutConfirmedPeriods, recurringMonthly, recurrenceGroupId, splitRequestId FROM dbo.Expense WHERE accountId = '${accountId}' FOR JSON PATH;`;
    const qGain = `SET NOCOUNT ON; SELECT id, userId, accountId, category, subcategory, amount, description, date, isPaid, recurrenceGroupId, relatedExpenseId FROM dbo.Gain WHERE accountId = '${accountId}' FOR JSON PATH;`;

    console.log('Exportando SQL Server → JSON...');
    runSqlcmdJson(qExp, expPath);
    runSqlcmdJson(qGain, gainPath);

    const expenses = parseJsonArrayFile(expPath);
    const gains = parseJsonArrayFile(gainPath);
    console.log(`Encontrado: ${expenses.length} despesa(s), ${gains.length} ganho(s).`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let expOk = 0;
        for (const row of expenses) {
            let splitId = row.splitRequestId || null;
            if (splitId && !(await splitRequestExists(client, splitId))) {
                splitId = null;
            }

            await client.query(
                `INSERT INTO expenses (
                    id, user_id, account_id, category, subcategory, amount, description, date, created_at,
                    is_paid, is_investment, installment_count, cash_out_confirmed_periods, recurring_monthly,
                    recurrence_group_id, split_request_id
                ) VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,
                    $10,$11,$12,$13,$14,
                    $15,$16
                )
                ON CONFLICT (id) DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    account_id = EXCLUDED.account_id,
                    category = EXCLUDED.category,
                    subcategory = EXCLUDED.subcategory,
                    amount = EXCLUDED.amount,
                    description = EXCLUDED.description,
                    date = EXCLUDED.date,
                    created_at = EXCLUDED.created_at,
                    is_paid = EXCLUDED.is_paid,
                    is_investment = EXCLUDED.is_investment,
                    installment_count = EXCLUDED.installment_count,
                    cash_out_confirmed_periods = EXCLUDED.cash_out_confirmed_periods,
                    recurring_monthly = EXCLUDED.recurring_monthly,
                    recurrence_group_id = EXCLUDED.recurrence_group_id,
                    split_request_id = EXCLUDED.split_request_id`,
                [
                    row.id,
                    row.userId,
                    row.accountId,
                    row.category,
                    row.subcategory ?? null,
                    Number(row.amount),
                    row.description,
                    parseDate(row.date),
                    parseDate(row.createdAt),
                    row.isPaid !== false,
                    row.isInvestment === true,
                    row.installmentCount != null ? Number(row.installmentCount) : null,
                    row.cashOutConfirmedPeriods ?? null,
                    row.recurringMonthly === true,
                    normalizeUuid(row.recurrenceGroupId),
                    splitId
                ]
            );
            expOk++;
        }

        let gainOk = 0;
        for (const row of gains) {
            let rel = row.relatedExpenseId || null;
            if (rel && !(await expenseExists(client, rel))) {
                rel = null;
            }

            await client.query(
                `INSERT INTO gains (
                    id, user_id, account_id, category, subcategory, amount, description, date, is_paid,
                    recurrence_group_id, related_expense_id
                ) VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
                )
                ON CONFLICT (id) DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    account_id = EXCLUDED.account_id,
                    category = EXCLUDED.category,
                    subcategory = EXCLUDED.subcategory,
                    amount = EXCLUDED.amount,
                    description = EXCLUDED.description,
                    date = EXCLUDED.date,
                    is_paid = EXCLUDED.is_paid,
                    recurrence_group_id = EXCLUDED.recurrence_group_id,
                    related_expense_id = EXCLUDED.related_expense_id`,
                [
                    row.id,
                    row.userId,
                    row.accountId,
                    row.category,
                    row.subcategory ?? null,
                    Number(row.amount),
                    row.description,
                    parseDate(row.date),
                    row.isPaid !== false,
                    normalizeUuid(row.recurrenceGroupId),
                    rel
                ]
            );
            gainOk++;
        }

        await client.query('COMMIT');
        console.log(`Concluído: ${expOk} despesa(s), ${gainOk} ganho(s) gravados no Supabase.`);
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

function normalizeUuid(v) {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    return uuidRe.test(s) ? s : null;
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
