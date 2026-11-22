/**
 * Saldo gravado no snapshot = mesma soma que o card «Saldo total» (js/core/cash-balance.js):
 * parcelas de empréstimo e de cartão na conta vinculada, sem investimentos.
 */
import { query } from './db.js';
import { computeDisplayedCashBalance } from '../motor/dinheiro/displayed-cash-balance.js';
import { fetchCashBalanceInputs } from './household.js';

export function computeTotalBalance(accounts, expenses, gains, _investments, userProfile = null) {
    const asOf = new Date();
    asOf.setHours(23, 59, 59, 999);
    return computeDisplayedCashBalance(accounts, expenses, gains, asOf, userProfile);
}

/** Início do dia civil local do servidor (para gravar na coluna date). */
export function startOfTodayDate() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

export async function upsertBalanceSnapshotForUser(userId) {
    const { userProfile, userAccounts, userExpenses, userGains } = await fetchCashBalanceInputs(userId);
    const total = computeTotalBalance(userAccounts, userExpenses, userGains, null, userProfile);
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