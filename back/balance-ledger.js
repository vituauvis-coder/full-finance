/**
 * Livro de saldo simplificado ao extremo:
 * Não usamos mais a tabela balance_ledger_entries.
 * O saldo é calculado dinamicamente (soma das contas + ganhos - despesas)
 * e o ajuste manual salva uma diferença (balance_offset) no perfil do usuário.
 */
import { computeCashBalanceForAccountIdAsOf } from '../legacy-web/js/core/cash-balance.js';
import { isCashBalanceAccountType } from '../legacy-web/js/core/utils.js';
import { computeDisplayedCashBalance } from '../motor/dinheiro/displayed-cash-balance.js';
import { pickPrimaryCashAccounts } from '../motor/dinheiro/primary-cash-balance.js';
import { query } from './db.js';
import { fetchCashBalanceInputs } from './household.js';

/**
 * Compatibilidade: não faz nada, pois o saldo é calculado em tempo real.
 */
export async function addLedgerEntryForMovement() {}

/**
 * Define um novo saldo base manualmente.
 * Com conta principal: ajusta o saldo inicial dessa conta.
 * Sem principal: usa balance_offset no perfil (soma de todas as contas).
 */
export async function setManualBalance(userId, newTotal) {
    const amount = Number(newTotal) || 0;
    const { userProfile, userAccounts, userExpenses, userGains } = await fetchCashBalanceInputs(userId);
    const asOf = new Date();
    asOf.setHours(23, 59, 59, 999);

    const primaryPick = pickPrimaryCashAccounts(userAccounts, isCashBalanceAccountType);
    if (primaryPick?.length === 1) {
        const accountId = primaryPick[0].id;
        const raw = computeCashBalanceForAccountIdAsOf(
            accountId,
            userAccounts,
            userExpenses,
            userGains,
            asOf,
            { ...userProfile, balanceOffset: 0 }
        );
        const delta = amount - raw;
        await query(
            `UPDATE accounts SET initial_balance = COALESCE(initial_balance, 0) + $1 WHERE id = $2`,
            [delta, accountId]
        );
        await query(`UPDATE users SET balance_offset = 0 WHERE id = $1`, [userId]);
        return;
    }

    const rawNetBalance = computeDisplayedCashBalance(
        userAccounts,
        userExpenses,
        userGains,
        asOf,
        { ...userProfile, balanceOffset: 0 }
    );
    const offset = amount - rawNetBalance;
    await query(`UPDATE users SET balance_offset = $1 WHERE id = $2`, [offset, userId]);
}

/** Saldo total atual (calculado em tempo real). */
export async function getCurrentBalance(userId) {
    const { userProfile, userAccounts, userExpenses, userGains } = await fetchCashBalanceInputs(userId);
    const asOf = new Date();
    asOf.setHours(23, 59, 59, 999);
    return computeDisplayedCashBalance(userAccounts, userExpenses, userGains, asOf, userProfile);
}

// Funções mantidas apenas para compatibilidade de exportação
export async function rebuildBalanceLedgerForUser() {}
export async function safeRebuildBalanceLedger() {}
export async function getDashboardBalanceAtPeriodEnd(userId) {
    const balance = await getCurrentBalance(userId);
    return { balance, source: 'computed_live' };
}