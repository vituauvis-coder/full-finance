import crypto from 'node:crypto';
import { query } from './db.js';
import { accountsVisibleToUserSql, assertAccountAccessible } from './household.js';
import { isCreditCardType, isPixBankAccountType } from '../motor/dinheiro/account-type.js';
import { normalizePaymentMethod, paidFromCofrinho } from '../motor/viagens/trip-expense-payment.js';
import { buildFinanceExpenseDraft } from '../motor/viagens/trip-finance-fields.js';
import { referenceOnlyForUserMovement } from './reference-only.js';
import { safeUpsertBalanceSnapshot } from './balance-snapshot.js';
import { ensureExpenseTripLinkColumns } from './migrations/expense-trip-link.js';
import { ensureViagensCatalogForHousehold } from './trip-finance-categories.js';

function parseSpentOnDate(spentOn) {
    const s = String(spentOn ?? '').trim().slice(0, 10);
    if (s) {
        const d = new Date(`${s}T12:00:00`);
        if (!Number.isNaN(d.getTime())) return d;
    }
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
}

async function assertCreditAccountBelongsToUser(userId, accountId) {
    await assertAccountAccessible(accountId, userId);
    const { rows } = await query(`SELECT type FROM accounts WHERE id = $1 LIMIT 1`, [accountId]);
    const acc = rows[0];
    if (!acc || !isCreditCardType(acc.type)) {
        const e = new Error('Selecione um cartão de crédito da Carteira');
        e.statusCode = 400;
        throw e;
    }
}

async function assertPixBankAccountBelongsToUser(userId, accountId) {
    await assertAccountAccessible(accountId, userId);
    const { rows } = await query(`SELECT type FROM accounts WHERE id = $1 LIMIT 1`, [accountId]);
    const acc = rows[0];
    if (!acc || !isPixBankAccountType(acc.type)) {
        const e = new Error('Selecione uma conta corrente ou poupança da Carteira');
        e.statusCode = 400;
        throw e;
    }
}

async function deleteFinanceExpense(userId, expenseId) {
    if (!expenseId) return;
    await query(`DELETE FROM expenses WHERE id = $1 AND user_id = $2`, [expenseId, userId]);
}

/** Primeira conta corrente/poupança visível ao usuário (Pix à vista sem conta escolhida). */
async function defaultPixBankAccountId(userId) {
    const { rows } = await query(
        `SELECT a.id FROM accounts a
         WHERE ${accountsVisibleToUserSql(1)}
           AND a.type IN ('conta_corrente', 'poupanca')
         ORDER BY a.name ASC
         LIMIT 1`,
        [userId]
    );
    return rows[0]?.id ?? null;
}

function withPixAccountIfMissing(tripExpense, accountId) {
    if (!accountId) return tripExpense;
    const cur = String(tripExpense?.accountId ?? tripExpense?.account_id ?? '').trim();
    if (cur) return tripExpense;
    return { ...tripExpense, accountId, account_id: accountId };
}

async function findFinanceExpenseId(userId, tripId, tripExpenseId, hintId) {
    if (hintId) {
        const { rows } = await query(
            `SELECT id FROM expenses WHERE id = $1 AND user_id = $2 LIMIT 1`,
            [hintId, userId]
        );
        if (rows[0]?.id) return rows[0].id;
    }
    const { rows } = await query(
        `SELECT id FROM expenses WHERE user_id = $1 AND trip_id = $2 AND trip_expense_id = $3 LIMIT 1`,
        [userId, tripId, tripExpenseId]
    );
    return rows[0]?.id ?? null;
}

/** Primeiro espelho Dinheiro da linha do orçamento (qualquer membro da casa). */
async function findCanonicalFinanceExpenseForTripLine(tripId, tripExpenseId) {
    if (!tripExpenseId) return null;
    const { rows } = await query(
        `SELECT id, user_id AS "userId"
         FROM expenses
         WHERE trip_id = $1 AND trip_expense_id = $2
         ORDER BY created_at ASC
         LIMIT 1`,
        [tripId, tripExpenseId]
    );
    return rows[0] ?? null;
}

async function upsertFinanceFromDraft(userId, draft) {
    const movementDate = parseSpentOnDate(draft.date);
    const refOnly = await referenceOnlyForUserMovement(userId, movementDate);
    const installmentCount = Math.max(1, Number(draft.installmentCount) || 1);

    const existingId = await findFinanceExpenseId(
        userId,
        draft.tripId,
        draft.tripExpenseId,
        draft.existingFinanceExpenseId
    );

    if (existingId) {
        const { rows } = await query(
            `UPDATE expenses
             SET account_id = $1,
                 category = $2,
                 subcategory = $3,
                 amount = $4,
                 description = $5,
                 date = $6,
                 is_paid = $7,
                 is_cofrinho = $8,
                 installment_count = $9,
                 reference_only = $10,
                 trip_id = $11,
                 trip_expense_id = $12,
                 paid_from_cofrinho = $13
             WHERE id = $14 AND user_id = $15
             RETURNING id`,
            [
                draft.accountId,
                draft.category,
                draft.subcategory,
                draft.amount,
                draft.description,
                movementDate,
                draft.isPaid,
                draft.isCofrinho,
                installmentCount,
                refOnly,
                draft.tripId,
                draft.tripExpenseId,
                draft.paidFromCofrinho === true,
                existingId,
                userId
            ]
        );
        return rows[0]?.id ?? existingId;
    }

    const expenseId = crypto.randomUUID();
    const { rows } = await query(
        `INSERT INTO expenses (
            id, user_id, account_id, category, subcategory, amount, description,
            date, created_at, is_paid, is_cofrinho, installment_count,
            cash_out_confirmed_periods, recurring_monthly, recurrence_group_id,
            is_fixed, reference_only, trip_id, trip_expense_id, paid_from_cofrinho
         ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8, now(), $9,$10,$11,
            $12,$13,$14,
            $15,$16,$17,$18,$19
         )
         RETURNING id`,
        [
            expenseId,
            userId,
            draft.accountId,
            draft.category,
            draft.subcategory,
            draft.amount,
            draft.description,
            movementDate,
            draft.isPaid,
            draft.isCofrinho,
            installmentCount,
            null,
            false,
            null,
            false,
            refOnly,
            draft.tripId,
            draft.tripExpenseId,
            draft.paidFromCofrinho === true
        ]
    );
    return rows[0]?.id ?? expenseId;
}

/**
 * Sincroniza um lançamento da viagem com o módulo Dinheiro.
 * @returns {{ expense: object, patched: boolean }}
 */
export async function syncFinanceExpenseForTripExpense(userId, tripId, tripExpense, opts = {}) {
    const method = normalizePaymentMethod(tripExpense?.paymentMethod ?? tripExpense?.payment_method);
    const financeId = tripExpense?.financeExpenseId ?? tripExpense?.finance_expense_id ?? null;

    if (method !== 'credit_card' && method !== 'pix') {
        if (financeId) {
            await deleteFinanceExpense(userId, financeId);
            return {
                expense: { ...tripExpense, financeExpenseId: null, finance_expense_id: null },
                patched: true
            };
        }
        return { expense: tripExpense, patched: false };
    }

    let working = tripExpense;
    if (method === 'pix' || paidFromCofrinho(tripExpense)) {
        const fallback = await defaultPixBankAccountId(userId);
        working = withPixAccountIfMissing(tripExpense, fallback);
    }

    const draft = buildFinanceExpenseDraft(working, tripId, { tripTitle: opts.tripTitle });
    if (!draft) {
        const e = new Error(
            method === 'pix'
                ? 'Gasto Pix incompleto: informe valor, data e selecione a conta para espelhar no Dinheiro'
                : 'Gasto no cartão incompleto: informe valor, data e selecione o cartão para espelhar no Dinheiro'
        );
        e.statusCode = 400;
        throw e;
    }

    if (!draft.paidFromCofrinho) {
        if (method === 'pix') {
            await assertPixBankAccountBelongsToUser(userId, draft.accountId);
        } else {
            await assertCreditAccountBelongsToUser(userId, draft.accountId);
        }
    } else if (!draft.accountId) {
        const e = new Error('Gasto do cofrinho incompleto: cadastre uma conta corrente na Carteira');
        e.statusCode = 400;
        throw e;
    }
    await ensureViagensCatalogForHousehold(userId, opts.tripTitle);

    const tripExpenseId = tripExpense?.id ?? draft.tripExpenseId;
    let ownId = await findFinanceExpenseId(userId, tripId, tripExpenseId, financeId);
    const canonical = await findCanonicalFinanceExpenseForTripLine(tripId, tripExpenseId);

    if (ownId && canonical && String(ownId) !== String(canonical.id) && String(canonical.userId) !== String(userId)) {
        await deleteFinanceExpense(userId, ownId);
        ownId = null;
    }

    const mirrorOwnerId =
        ownId != null
            ? userId
            : canonical?.userId
              ? canonical.userId
              : userId;
    const existingFinanceExpenseId = ownId ?? canonical?.id ?? financeId;

    const newId = await upsertFinanceFromDraft(mirrorOwnerId, {
        ...draft,
        existingFinanceExpenseId
    });
    const expenseOut = {
        ...working,
        financeExpenseId: newId,
        finance_expense_id: newId,
        accountId: draft.accountId,
        account_id: draft.accountId
    };
    return { expense: expenseOut, patched: true };
}

async function loadTripTitle(tripId) {
    const { rows } = await query(`SELECT title FROM trips WHERE id = $1 LIMIT 1`, [tripId]);
    return rows[0]?.title ?? '';
}

/**
 * Varre payload.expenses: remove órfãos no Dinheiro e espelha cartão + Pix.
 * Categoria financeira: Viagens / subcategoria: nome da viagem.
 */
export async function syncTripExpensesToFinance(userId, tripId, payload) {
    await ensureExpenseTripLinkColumns();
    const expenses = Array.isArray(payload?.expenses) ? [...payload.expenses] : [];
    const warnings = [];
    let changed = false;
    const tripTitle = await loadTripTitle(tripId);
    await ensureViagensCatalogForHousehold(userId, tripTitle);

    const aliveIds = new Set(expenses.map((e) => e.id));
    const payloadById = new Map(expenses.map((e) => [e.id, e]));
    const { rows: linked } = await query(
        `SELECT id, trip_expense_id AS "tripExpenseId"
         FROM expenses WHERE user_id = $1 AND trip_id = $2`,
        [userId, tripId]
    );
    for (const link of linked) {
        const teId = link.tripExpenseId;
        const pe = teId ? payloadById.get(teId) : null;
        if (teId && !aliveIds.has(teId)) {
            await deleteFinanceExpense(userId, link.id);
            changed = true;
        }
    }

    const nextExpenses = [];
    for (const ex of expenses) {
        try {
            const { expense, patched } = await syncFinanceExpenseForTripExpense(userId, tripId, ex, {
                tripTitle
            });
            nextExpenses.push(expense);
            if (patched) changed = true;
        } catch (e) {
            warnings.push({
                tripExpenseId: ex.id,
                message: e instanceof Error ? e.message : 'Falha ao sincronizar com Dinheiro'
            });
            nextExpenses.push(ex);
        }
    }

    if (changed) {
        await safeUpsertBalanceSnapshot(userId);
    }

    return { expenses: nextExpenses, changed, warnings };
}