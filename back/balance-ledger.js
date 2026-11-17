/**
 * Livro de saldo simplificado ao extremo:
 * Não usamos mais a tabela balance_ledger_entries.
 * O saldo é calculado dinamicamente (soma das contas + ganhos - despesas)
 * e o ajuste manual salva uma diferença (balance_offset) no perfil do usuário.
 */
import { query } from './db.js';

/** 
 * Compatibilidade: não faz nada, pois o saldo é calculado em tempo real.
 */
export async function addLedgerEntryForMovement() {}

/** 
 * Define um novo saldo base manualmente, ajustando o balance_offset do usuário.
 */
export async function setManualBalance(userId, newTotal) {
    const amount = Number(newTotal) || 0;
    
    // 1. Calcula qual seria o saldo total atual SEM o offset
    const [accRes, expRes, gainRes] = await Promise.all([
        query(`SELECT id, type, initial_balance AS "initialBalance", linked_account_id AS "linkedAccountId" FROM accounts WHERE user_id = $1`, [userId]),
        query(`SELECT account_id AS "accountId", amount, date, is_paid AS "isPaid", reference_only AS "referenceOnly", installment_count AS "installmentCount", cash_out_confirmed_periods AS "cashOutConfirmedPeriods", recurring_monthly AS "recurringMonthly" FROM expenses WHERE user_id = $1`, [userId]),
        query(`SELECT account_id AS "accountId", amount, date, is_paid AS "isPaid", reference_only AS "referenceOnly" FROM gains WHERE user_id = $1`, [userId])
    ]);

    // Importação dinâmica para evitar dependência circular
    const { computeTotalBalance } = await import('./balance-snapshot.js');
    
    // Passamos um userProfile mockado com balanceOffset = 0 para ver o saldo "puro"
    const rawNetBalance = computeTotalBalance(
        accRes.rows, 
        expRes.rows.filter(e => !e.referenceOnly), 
        gainRes.rows.filter(g => !g.referenceOnly), 
        [], 
        { balanceOffset: 0 }
    );

    // 2. A diferença entre o que o usuário quer e o que o sistema calculou é o novo offset
    const offset = amount - rawNetBalance;
    
    // 3. Salva no banco
    await query(`UPDATE users SET balance_offset = $1 WHERE id = $2`, [offset, userId]);
}

/** Saldo total atual (calculado em tempo real). */
export async function getCurrentBalance(userId) {
    const [userRes, accRes, expRes, gainRes] = await Promise.all([
        query(`SELECT finance_preferences AS "financePreferences", balance_offset AS "balanceOffset" FROM users WHERE id = $1`, [userId]),
        query(`SELECT id, type, initial_balance AS "initialBalance", linked_account_id AS "linkedAccountId" FROM accounts WHERE user_id = $1`, [userId]),
        query(`SELECT account_id AS "accountId", amount, date, is_paid AS "isPaid", reference_only AS "referenceOnly", installment_count AS "installmentCount", cash_out_confirmed_periods AS "cashOutConfirmedPeriods", recurring_monthly AS "recurringMonthly" FROM expenses WHERE user_id = $1`, [userId]),
        query(`SELECT account_id AS "accountId", amount, date, is_paid AS "isPaid", reference_only AS "referenceOnly" FROM gains WHERE user_id = $1`, [userId])
    ]);

    const user = userRes.rows[0] || null;
    const userProfile = user ? { financePreferences: user.financePreferences, balanceOffset: Number(user.balanceOffset) || 0 } : null;

    const { computeTotalBalance } = await import('./balance-snapshot.js');
    return computeTotalBalance(
        accRes.rows, 
        expRes.rows.filter(e => !e.referenceOnly), 
        gainRes.rows.filter(g => !g.referenceOnly), 
        [], 
        userProfile
    );
}

// Funções mantidas apenas para compatibilidade de exportação
export async function rebuildBalanceLedgerForUser() {}
export async function safeRebuildBalanceLedger() {}
export async function getDashboardBalanceAtPeriodEnd(userId) {
    const balance = await getCurrentBalance(userId);
    return { balance, source: 'computed_live' };
}
