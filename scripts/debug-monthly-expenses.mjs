/**
 * Decompõe o total «Despesas do mês» (mesma regra do Dashboard) por lançamento.
 * Uso:
 *   node scripts/debug-monthly-expenses.mjs
 *   node scripts/debug-monthly-expenses.mjs --email=seu@email.com
 *   node scripts/debug-monthly-expenses.mjs --month=2026-04
 */
import { query, pool } from '../server/db.js';
import { creditCardCashOutForCalendarMonth } from '../js/core/credit-installments.js';
import { expenseCountsAsCashOut, formatCurrency, isCreditCardType } from '../js/core/utils.js';

function parseArgs() {
    const out = { email: null, month: null };
    for (const a of process.argv.slice(2)) {
        if (a.startsWith('--email=')) out.email = a.slice(8).trim().toLowerCase();
        if (a.startsWith('--month=')) out.month = a.slice(8).trim();
    }
    return out;
}

function accountToView(a) {
    return {
        id: a.id,
        type: a.type,
        name: a.name,
        closeDay: a.closeDay,
        dueDay: a.dueDay,
        closingDay: a.closeDay,
        dueDate: a.dueDay
    };
}

function expenseContributionToMonth(t, acc, currentMonthKey, now) {
    if (acc && isCreditCardType(acc.type)) {
        return creditCardCashOutForCalendarMonth(t, acc, currentMonthKey, now);
    }
    const d = t.date instanceof Date ? t.date : new Date(t.date);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (mk !== currentMonthKey) return 0;
    if (!expenseCountsAsCashOut(t, acc)) return 0;
    return Number(t.amount) || 0;
}

async function main() {
    const { email, month: monthArg } = parseArgs();
    /** Relógio real — parcelas de cartão só contam até «hoje» (igual ao Dashboard). */
    const now = new Date();
    let y = now.getFullYear();
    let mo = now.getMonth();
    if (monthArg && /^\d{4}-\d{2}$/.test(monthArg)) {
        const [yy, mm] = monthArg.split('-').map(Number);
        y = yy;
        mo = mm - 1;
    }
    const currentMonthKey = `${y}-${String(mo + 1).padStart(2, '0')}`;

    const user = email
        ? (
              await query(
                  `SELECT id, email, name, currency FROM users WHERE email = $1 ORDER BY created_at ASC LIMIT 1`,
                  [email]
              )
          ).rows[0]
        : (await query(`SELECT id, email, name, currency FROM users ORDER BY created_at ASC LIMIT 1`)).rows[0];

    if (!user) {
        console.error(email ? `Usuário não encontrado: ${email}` : 'Nenhum usuário no banco.');
        process.exit(1);
    }

    const [accRes, expRes] = await Promise.all([
        query(
            `SELECT
                id, type, name,
                close_day AS "closeDay",
                due_day AS "dueDay"
             FROM accounts
             WHERE user_id = $1`,
            [user.id]
        ),
        query(
            `SELECT
                id,
                user_id AS "userId",
                account_id AS "accountId",
                category,
                subcategory,
                amount,
                description,
                date,
                is_paid AS "isPaid",
                installment_count AS "installmentCount",
                is_investment AS "isInvestment",
                recurring_monthly AS "recurringMonthly",
                recurrence_group_id AS "recurrenceGroupId",
                cash_out_confirmed_periods AS "cashOutConfirmedPeriods"
             FROM expenses
             WHERE user_id = $1
             ORDER BY date DESC`,
            [user.id]
        )
    ]);
    const accounts = accRes.rows;
    const expenses = expRes.rows;

    const byId = new Map(accounts.map((a) => [a.id, accountToView(a)]));

    const rows = [];
    let sum = 0;
    for (const e of expenses) {
        const acc = byId.get(e.accountId);
        const contrib = expenseContributionToMonth(e, acc, currentMonthKey, now);
        if (contrib <= 0) continue;
        sum += contrib;
        rows.push({
            contrib,
            id: e.id,
            description: e.description,
            amount: e.amount,
            date: e.date,
            category: e.subcategory ? `${e.category} > ${e.subcategory}` : e.category,
            account: acc?.name ?? '?',
            accType: acc?.type ?? '?',
            isPaid: e.isPaid,
            installments: e.installmentCount
        });
    }

    rows.sort((a, b) => b.contrib - a.contrib);

    console.log(`\nUsuário: ${user.email} (${user.name})`);
    console.log(`Mês calendário: ${currentMonthKey}`);
    console.log(`Moeda: ${user.currency || 'BRL'}`);
    console.log(`\n--- Linhas que entram no total (mesma regra do Dashboard) ---\n`);

    const cur = user.currency || 'BRL';
    for (const r of rows) {
        const d = r.date instanceof Date ? r.date : new Date(r.date);
        const line = [
            formatCurrency(r.contrib, cur).padEnd(14),
            r.description.slice(0, 42).padEnd(44),
            d.toLocaleDateString('pt-BR'),
            r.category.slice(0, 28),
            r.account.slice(0, 20),
            r.accType === 'cartao_credito' ? `CC ${r.installments ?? 1}x` : r.accType
        ].join('  |  ');
        console.log(line);
    }

    console.log('\n--- Totais ---');
    console.log(`Soma das contribuições: ${formatCurrency(sum, cur)}`);
    console.log(`Número de lançamentos com contribuição > 0: ${rows.length}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => pool.end());
