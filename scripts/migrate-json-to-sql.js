import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, withTransaction } from '../server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Caminho absoluto ou relativo para um backup store.json (não fica no repositório). */
const STORE_PATH = process.env.STORE_JSON_PATH;

function toDate(isoOrObj) {
    if (!isoOrObj) return new Date(0);
    if (typeof isoOrObj === 'object' && isoOrObj.seconds != null) {
        return new Date(isoOrObj.seconds * 1000);
    }
    const d = new Date(isoOrObj);
    if (Number.isNaN(d.getTime())) return new Date();
    return d;
}

async function main() {
    if (!STORE_PATH) {
        console.log(
            'Defina STORE_JSON_PATH com o caminho para um backup store.json, por exemplo:\n' +
                '  set STORE_JSON_PATH=C:\\backups\\store.json\n' +
                '  node scripts/migrate-json-to-sql.js'
        );
        return;
    }
    if (!fs.existsSync(STORE_PATH)) {
        console.log(`Arquivo não encontrado: ${STORE_PATH}\nNada a migrar.`);
        return;
    }

    console.log('Lendo JSON...', STORE_PATH);
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const store = JSON.parse(raw);

    console.log('Migrando usuários...');
    await withTransaction(async (client) => {
        for (const u of Object.values(store.users || {})) {
            await client.query(
                `INSERT INTO users (
                    id, email, name, password_hash, created_at,
                    currency, has_completed_tour, profile_photo_url, role, finance_preferences
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'USER',NULL)
                 ON CONFLICT (id) DO NOTHING`,
                [
                    u.id,
                    u.email,
                    u.name,
                    u.passwordHash,
                    toDate(u.createdAt),
                    u.currency || 'BRL',
                    u.hasCompletedTour || false,
                    u.profilePhotoURL || null
                ]
            );
        }
    });

    console.log('Migrando contas...');
    await withTransaction(async (client) => {
        for (const a of store.accounts || []) {
            await client.query(
                `INSERT INTO accounts (
                    id, user_id, name, type,
                    initial_balance, holder_name, plastic_tone, plastic_color,
                    "limit", close_day, due_day, linked_account_id
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULL)
                 ON CONFLICT (id) DO NOTHING`,
                [
                    a.id,
                    a.userId,
                    a.name,
                    a.type,
                    parseFloat(a.initialBalance) || 0,
                    a.holderName || null,
                    a.plasticTone || null,
                    a.plasticColor || null,
                    a.limit != null && a.limit !== '' ? parseFloat(a.limit) || null : null,
                    a.closeDay != null && a.closeDay !== '' ? parseInt(a.closeDay, 10) || null : null,
                    a.dueDay != null && a.dueDay !== '' ? parseInt(a.dueDay, 10) || null : null
                ]
            );
        }
    });

    console.log('Migrando despesas...');
    await withTransaction(async (client) => {
        for (const e of store.expenses || []) {
            await client.query(
                `INSERT INTO expenses (
                    id, user_id, account_id,
                    category, subcategory,
                    amount, description,
                    date, created_at,
                    is_paid, is_investment,
                    installment_count,
                    cash_out_confirmed_periods,
                    recurring_monthly,
                    recurrence_group_id,
                    split_request_id
                 ) VALUES (
                    $1,$2,$3,
                    $4,$5,
                    $6,$7,
                    $8, now(),
                    $9,$10,
                    $11,
                    NULL,
                    false,
                    NULL,
                    NULL
                 )
                 ON CONFLICT (id) DO NOTHING`,
                [
                    e.id,
                    e.userId,
                    e.accountId,
                    e.category,
                    e.subcategory || null,
                    parseFloat(e.amount) || 0,
                    e.description,
                    toDate(e.date),
                    e.isPaid !== false,
                    e.isInvestment === true,
                    e.installmentCount != null && e.installmentCount !== ''
                        ? parseInt(String(e.installmentCount), 10) || null
                        : null
                ]
            );
        }
    });

    console.log('Migrando ganhos...');
    await withTransaction(async (client) => {
        for (const g of store.gains || []) {
            await client.query(
                `INSERT INTO gains (
                    id, user_id, account_id,
                    category, subcategory,
                    amount, description,
                    date, is_paid,
                    recurrence_group_id,
                    related_expense_id
                 ) VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,$8,NULL,NULL)
                 ON CONFLICT (id) DO NOTHING`,
                [g.id, g.userId, g.accountId, g.category, parseFloat(g.amount) || 0, g.description, toDate(g.date), g.isPaid !== false]
            );
        }
    });

    console.log('Migrando objetivos...');
    await withTransaction(async (client) => {
        for (const g of store.goals || []) {
            let linkedJson = null;
            if (Array.isArray(g.linkedAccountIds)) {
                linkedJson = JSON.stringify(g.linkedAccountIds.map(String).filter(Boolean));
            } else if (typeof g.linkedAccountIds === 'string' && g.linkedAccountIds.trim()) {
                linkedJson = g.linkedAccountIds;
            } else if (g.linkedAccountId != null && g.linkedAccountId !== '') {
                linkedJson = JSON.stringify([String(g.linkedAccountId)]);
            }
            await client.query(
                `INSERT INTO goals (
                    id, user_id, name, target_amount, current_amount, goal_type, linked_account_ids
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7)
                 ON CONFLICT (id) DO NOTHING`,
                [
                    g.id,
                    g.userId,
                    g.name,
                    parseFloat(g.targetAmount) || 0,
                    parseFloat(g.currentAmount) || 0,
                    g.goalType || 'outro',
                    linkedJson
                ]
            );
        }
    });

    console.log('Migrando investimentos...');
    await withTransaction(async (client) => {
        for (const i of store.investments || []) {
            await client.query(
                `INSERT INTO investments (
                    id, user_id, name, category, institution, current_value, notes, linked_account_id
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                 ON CONFLICT (id) DO NOTHING`,
                [
                    i.id,
                    i.userId,
                    i.name,
                    i.category,
                    i.institution || null,
                    parseFloat(i.currentValue) || 0,
                    i.notes || null,
                    i.linkedAccountId || null
                ]
            );
        }
    });

    console.log('Migrando admin logs...');
    await withTransaction(async (client) => {
        for (const l of store.admin_logs || []) {
            await client.query(
                `INSERT INTO admin_logs (id, user_id, action, details, created_at)
                 VALUES ($1,$2,$3,$4,$5)
                 ON CONFLICT (id) DO NOTHING`,
                [
                    l.id,
                    l.adminId || l.userId,
                    l.action,
                    typeof l.details === 'object' ? JSON.stringify(l.details) : l.details,
                    toDate(l.timestamp || l.createdAt)
                ]
            );
        }
    });

    console.log('Migrando feedbacks...');
    await withTransaction(async (client) => {
        for (const f of store.feedback || []) {
            await client.query(
                `INSERT INTO feedbacks (id, user_id, message, created_at)
                 VALUES ($1,$2,$3,$4)
                 ON CONFLICT (id) DO NOTHING`,
                [f.id, f.userId, f.message, toDate(f.createdAt)]
            );
        }
    });

    console.log('Migração concluída com sucesso!');
}

main()
    .catch(e => {
        console.error('Erro na migração:', e);
        process.exit(1);
    })
    .finally(async () => {
        await pool.end();
    });
