/**
 * Saldo gravado no snapshot = mesma soma que o card «Saldo total» (js/core/cash-balance.js):
 * parcelas de empréstimo e de cartão na conta vinculada, sem investimentos.
 */
import { query } from './db.js';
import { computeCashBalanceTotalAsOf } from '../js/core/cash-balance.js';
import { safeRebuildBalanceLedger } from './balance-ledger.js';

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
    const [userRes, accRes, expRes, gainRes, invRes] = await Promise.all([
        query(
            `SELECT finance_preferences AS "financePreferences"
             FROM users
             WHERE id = $1`,
            [userId]
        ),
        query(
            `SELECT
                id,
                user_id AS "userId",
                name,
                type,
                initial_balance AS "initialBalance",
                holder_name AS "holderName",
                plastic_tone AS "plasticTone",
                plastic_color AS "plasticColor",
                "limit",
                close_day AS "closeDay",
                due_day AS "dueDay",
                linked_account_id AS "linkedAccountId"
             FROM accounts
             WHERE user_id = $1`,
            [userId]
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
                created_at AS "createdAt",
                is_paid AS "isPaid",
                is_investment AS "isInvestment",
                installment_count AS "installmentCount",
                cash_out_confirmed_periods AS "cashOutConfirmedPeriods",
                recurring_monthly AS "recurringMonthly",
                recurrence_group_id AS "recurrenceGroupId",
                split_request_id AS "splitRequestId",
                reference_only AS "referenceOnly"
             FROM expenses
             WHERE user_id = $1`,
            [userId]
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
                recurrence_group_id AS "recurrenceGroupId",
                related_expense_id AS "relatedExpenseId",
                reference_only AS "referenceOnly"
             FROM gains
             WHERE user_id = $1`,
            [userId]
        ),
        query(
            `SELECT
                id,
                user_id AS "userId",
                name,
                category,
                institution,
                current_value AS "currentValue",
                notes,
                linked_account_id AS "linkedAccountId"
             FROM investments
             WHERE user_id = $1`,
            [userId]
        )
    ]);
    const user = userRes.rows[0] || null;
    const userAccounts = accRes.rows;
    const userExpenses = expRes.rows.filter((e) => !e.referenceOnly);
    const userGains = gainRes.rows.filter((g) => !g.referenceOnly);
    const userInvestments = invRes.rows;

    const userProfile = user ? { financePreferences: user.financePreferences } : null;
    const total = computeTotalBalance(userAccounts, userExpenses, userGains, userInvestments, userProfile);
    const date = startOfTodayDate();

    await query(
        `INSERT INTO balance_snapshots (id, user_id, date, total_balance, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, now())
         ON CONFLICT (user_id, date)
         DO UPDATE SET total_balance = EXCLUDED.total_balance, updated_at = now()`,
        [userId, date, total]
    );
    await safeRebuildBalanceLedger(userId);
}

export async function safeUpsertBalanceSnapshot(userId) {
    try {
        await upsertBalanceSnapshotForUser(userId);
    } catch (e) {
        console.error('[balance-snapshot] upsert failed', e);
    }
}
