/**
 * Livro de saldo: uma linha por movimento oficial (não referência), com totais alinhados a cash-balance.js.
 */
import { query } from './db.js';
import {
    computeCashAccountRawBalance,
    computeCashBalanceTotalAsOf
} from '../js/core/cash-balance.js';
import { projectedCashBalanceAfterFuturePeriod } from '../js/core/projected-period-net.js';

function toJsDate(d) {
    if (!d) return new Date(0);
    if (d instanceof Date) return d;
    return new Date(d);
}

/** Fim do dia civil no fuso do servidor (alinhado a `reports.js` / cartões do dashboard). */
function endOfTodayInclusive() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59, 59, 999);
}

/** Só movimentos já «acontecidos» entram no ledger — sem projeção de recorrências futuras. */
function isRealizedMovementDate(d) {
    const t = toJsDate(d).getTime();
    if (Number.isNaN(t)) return false;
    return t <= endOfTodayInclusive().getTime();
}

async function loadLedgerFinanceBundle(userId) {
    const [userRes, accRes, expRes, gainRes] = await Promise.all([
        query(
            `SELECT finance_preferences AS "financePreferences",
                    finance_anchor_month AS "financeAnchorMonth",
                    created_at AS "createdAt"
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
        )
    ]);
    const user = userRes.rows[0] || null;
    const userProfile = user ? { financePreferences: user.financePreferences } : null;
    return {
        user,
        userProfile,
        accounts: accRes.rows,
        expenses: expRes.rows,
        gains: gainRes.rows
    };
}

/**
 * Reconstrói o ledger completo do usuário (após qualquer mutação relevante).
 */
export async function rebuildBalanceLedgerForUser(userId) {
    const { userProfile, accounts, expenses, gains } = await loadLedgerFinanceBundle(userId);
    const officialExpenses = (expenses || []).filter(
        (e) => !e.referenceOnly && isRealizedMovementDate(e.date)
    );
    const officialGains = (gains || []).filter(
        (g) => !g.referenceOnly && isRealizedMovementDate(g.date)
    );

    const events = [];
    for (const g of officialGains) {
        events.push({
            kind: 'gain',
            id: g.id,
            accountId: g.accountId,
            date: toJsDate(g.date),
            amount: Number(g.amount) || 0,
            raw: g
        });
    }
    for (const e of officialExpenses) {
        events.push({
            kind: 'expense',
            id: e.id,
            accountId: e.accountId,
            date: toJsDate(e.date),
            amount: Number(e.amount) || 0,
            raw: e
        });
    }

    events.sort((a, b) => {
        const ta = a.date.getTime();
        const tb = b.date.getTime();
        if (ta !== tb) return ta - tb;
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        return String(a.id).localeCompare(String(b.id));
    });

    await query(`DELETE FROM balance_ledger_entries WHERE user_id = $1`, [userId]);

    const includedGainIds = new Set();
    const includedExpIds = new Set();

    let seq = 0;
    for (const ev of events) {
        seq += 1;
        if (ev.kind === 'gain') includedGainIds.add(ev.id);
        else includedExpIds.add(ev.id);

        const expSubset = officialExpenses.filter((e) => includedExpIds.has(e.id));
        const gainSubset = officialGains.filter((g) => includedGainIds.has(g.id));

        const asOf = ev.date;
        const total = computeCashBalanceTotalAsOf(
            accounts,
            expSubset,
            gainSubset,
            asOf,
            userProfile
        );

        const acc = accounts.find((a) => a.id === ev.accountId);
        const balanceAfterAccount = acc
            ? computeCashAccountRawBalance(acc, accounts, expSubset, gainSubset, asOf, userProfile)
            : 0;

        const amountSigned = ev.kind === 'gain' ? ev.amount : -ev.amount;

        await query(
            `INSERT INTO balance_ledger_entries (
                id, user_id, seq, movement_type, movement_id, account_id,
                movement_date, amount_signed, balance_after_account, balance_after_total
             ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5,
                $6, $7, $8, $9
             )`,
            [
                userId,
                seq,
                ev.kind,
                ev.id,
                ev.accountId,
                asOf,
                amountSigned,
                balanceAfterAccount,
                total
            ]
        );
    }
}

export async function safeRebuildBalanceLedger(userId) {
    try {
        await rebuildBalanceLedgerForUser(userId);
    } catch (e) {
        console.error('[balance-ledger] rebuild failed', e);
    }
}

/** Saldo total «hoje» (último estado oficial até o fim do dia atual). */
async function getBalanceAsOfEndOfToday(userId) {
    const endToday = endOfTodayInclusive();
    const { rows } = await query(
        `SELECT balance_after_total AS "balanceAfterTotal"
         FROM balance_ledger_entries
         WHERE user_id = $1 AND movement_date <= $2
         ORDER BY movement_date DESC, seq DESC
         LIMIT 1`,
        [userId, endToday]
    );
    if (rows[0]) {
        return { balance: Number(rows[0].balanceAfterTotal), source: 'ledger_as_of_today' };
    }
    const bundle = await loadLedgerFinanceBundle(userId);
    const officialExpenses = (bundle.expenses || []).filter(
        (e) => !e.referenceOnly && isRealizedMovementDate(e.date)
    );
    const officialGains = (bundle.gains || []).filter(
        (g) => !g.referenceOnly && isRealizedMovementDate(g.date)
    );
    const total = computeCashBalanceTotalAsOf(
        bundle.accounts,
        officialExpenses,
        officialGains,
        endToday,
        bundle.userProfile
    );
    return { balance: total, source: 'computed_as_of_today' };
}

/**
 * Saldo total (soma contas de caixa) no fim do período: último movimento oficial no [from, to],
 * ou último antes de `from`, ou cálculo direto se o ledger ainda estiver vazio.
 * Período só no futuro: saldo atual + Σ (entradas previstas − saídas previstas) por mês (alinhado aos cards).
 */
export async function getDashboardBalanceAtPeriodEnd(userId, from, to) {
    const fromD = from instanceof Date ? from : new Date(from);
    const toD = to instanceof Date ? to : new Date(to);
    if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) {
        return { balance: null, source: 'invalid_dates' };
    }

    const endToday = endOfTodayInclusive();

    // Período inteiramente no futuro (início já é amanhã ou depois):
    // não há entradas no ledger → projeta fluxo sobre o saldo de hoje.
    if (fromD.getTime() > endToday.getTime()) {
        const base = await getBalanceAsOfEndOfToday(userId);
        const bundle = await loadLedgerFinanceBundle(userId);
        const projected = projectedCashBalanceAfterFuturePeriod(
            base.balance,
            fromD,
            toD,
            new Date(),
            bundle.accounts,
            bundle.expenses,
            bundle.gains,
            bundle.userProfile
        );
        return { balance: projected, source: 'projected_future_cashflow' };
    }

    // Período cobre hoje ou o passado: usa o ledger real; se toD é futuro, corta em hoje.
    const capTo = toD.getTime() > endToday.getTime() ? endToday : toD;

    const { rows: inRange } = await query(
        `SELECT balance_after_total AS "balanceAfterTotal"
         FROM balance_ledger_entries
         WHERE user_id = $1 AND movement_date >= $2 AND movement_date <= $3
         ORDER BY movement_date DESC, seq DESC
         LIMIT 1`,
        [userId, fromD, capTo]
    );
    if (inRange[0]) {
        return { balance: Number(inRange[0].balanceAfterTotal), source: 'ledger_in_range' };
    }

    const { rows: before } = await query(
        `SELECT balance_after_total AS "balanceAfterTotal"
         FROM balance_ledger_entries
         WHERE user_id = $1 AND movement_date < $2
         ORDER BY movement_date DESC, seq DESC
         LIMIT 1`,
        [userId, fromD]
    );
    if (before[0]) {
        return { balance: Number(before[0].balanceAfterTotal), source: 'ledger_before_period' };
    }

    const bundle = await loadLedgerFinanceBundle(userId);
    const officialExpenses = (bundle.expenses || []).filter(
        (e) => !e.referenceOnly && isRealizedMovementDate(e.date)
    );
    const officialGains = (bundle.gains || []).filter(
        (g) => !g.referenceOnly && isRealizedMovementDate(g.date)
    );
    const asOf = capTo;
    const total = computeCashBalanceTotalAsOf(
        bundle.accounts,
        officialExpenses,
        officialGains,
        asOf,
        bundle.userProfile
    );
    return { balance: total, source: 'computed_empty_ledger' };
}
