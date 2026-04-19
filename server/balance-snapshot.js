/**
 * Saldo gravado no snapshot = mesma soma que o card «Saldo total» (js/core/cash-balance.js):
 * parcelas de empréstimo e de cartão na conta vinculada, sem investimentos.
 */
import { query } from './db.js';
import { computeCashBalanceTotalAsOf } from '../js/core/cash-balance.js';

export function computeTotalBalance(accounts, expenses, gains, _investments, userProfile = null) {
    const asOf = new Date();
    asOf.setHours(23, 59, 59, 999);
    return computeCashBalanceTotalAsOf(accounts, expenses, gains, asOf, userProfile);
}

/** Início do dia civil local do servidor (para gravar na coluna date). */
export function startOfTodayDate() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

export async function upsertBalanceSnapshotForUser(userId) {
    // O snapshot diário continua existindo para o gráfico de evolução de patrimônio
    const [userRes, accRes, expRes, gainRes, invRes] = await Promise.all([
        query(
            `SELECT finance_preferences AS "financePreferences", balance_offset AS "balanceOffset"
             FROM users WHERE id = $1`,
            [userId]
        ),
        query(
            `SELECT id, user_id AS "userId", name, type, initial_balance AS "initialBalance"
             FROM accounts WHERE user_id = $1`,
            [userId]
        ),
        query(
            `SELECT id, amount, date, is_paid AS "isPaid", reference_only AS "referenceOnly"
             FROM expenses WHERE user_id = $1`,
            [userId]
        ),
        query(
            `SELECT id, amount, date, is_paid AS "isPaid", reference_only AS "referenceOnly"
             FROM gains WHERE user_id = $1`,
            [userId]
        ),
        query(
            `SELECT id, current_value AS "currentValue"
             FROM investments WHERE user_id = $1`,
            [userId]
        )
    ]);

    const user = userRes.rows[0] || null;
    const userAccounts = accRes.rows;
    const userExpenses = expRes.rows.filter((e) => !e.referenceOnly);
    const userGains = gainRes.rows.filter((g) => !g.referenceOnly);
    const userInvestments = invRes.rows;

    const userProfile = user ? { financePreferences: user.financePreferences, balanceOffset: Number(user.balanceOffset) || 0 } : null;
    const total = computeTotalBalance(userAccounts, userExpenses, userGains, userInvestments, userProfile);
    const date = startOfTodayDate();

    await query(
        `INSERT INTO balance_snapshots (id, user_id, date, total_balance, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, now())
         ON CONFLICT (user_id, date)
         DO UPDATE SET total_balance = EXCLUDED.total_balance, updated_at = now()`,
        [userId, date, total]
    );
}

export async function safeUpsertBalanceSnapshot(userId) {
    try {
        await upsertBalanceSnapshotForUser(userId);
    } catch (e) {
        console.error('[balance-snapshot] upsert failed', e);
    }
}
