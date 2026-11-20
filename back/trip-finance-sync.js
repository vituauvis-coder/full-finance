import crypto from 'node:crypto';
import { query } from './db.js';
import { assertAccountAccessible } from './household.js';
import { isCreditCardType } from '../motor/dinheiro/account-type.js';
import { normalizePaymentMethod } from '../motor/viagens/trip-expense-payment.js';
import { buildFinanceExpenseDraft } from '../motor/viagens/trip-finance-fields.js';
import { referenceOnlyForUserMovement } from './reference-only.js';
import { safeUpsertBalanceSnapshot } from './balance-snapshot.js';
import { ensureExpenseTripLinkColumns } from './migrations/expense-trip-link.js';

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

async function deleteFinanceExpense(userId, expenseId) {
    if (!expenseId) return;
    await query(`DELETE FROM expenses WHERE id = $1 AND user_id = $2`, [expenseId, userId]);
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
                 trip_expense_id = $12
             WHERE id = $13 AND user_id = $14
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
            is_fixed, reference_only, trip_id, trip_expense_id
         ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8, now(), $9,$10,$11,
            $12,$13,$14,
            $15,$16,$17,$18
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
            draft.tripExpenseId
        ]
    );
    return rows[0]?.id ?? expenseId;
}

/**
 * Sincroniza um lançamento da viagem com o módulo Dinheiro.
 * @returns {{ expense: object, patched: boolean }}
 */
export async function syncFinanceExpenseForTripExpense(userId, tripId, tripExpense) {
    const method = normalizePaymentMethod(tripExpense?.paymentMethod ?? tripExpense?.payment_method);
    const financeId = tripExpense?.financeExpenseId ?? tripExpense?.finance_expense_id ?? null;

    if (method !== 'credit_card') {
        if (financeId) {
            await deleteFinanceExpense(userId, financeId);
            return {
                expense: { ...tripExpense, financeExpenseId: null, finance_expense_id: null },
                patched: true
            };
        }
        return { expense: tripExpense, patched: false };
    }

    const draft = buildFinanceExpenseDraft(tripExpense, tripId);
    if (!draft) {
        const e = new Error(
            'Gasto no cartão incompleto: informe valor, data e selecione o cartão para espelhar no Dinheiro'
        );
        e.statusCode = 400;
        throw e;
    }

    await assertCreditAccountBelongsToUser(userId, draft.accountId);
    const newId = await upsertFinanceFromDraft(userId, draft);
    if (newId === financeId && financeId) {
        return { expense: tripExpense, patched: false };
    }
    return {
        expense: {
            ...tripExpense,
            financeExpenseId: newId,
            finance_expense_id: newId,
            accountId: draft.accountId,
            account_id: draft.accountId
        },
        patched: true
    };
}

/**
 * Varre payload.expenses: remove órfãos no Dinheiro e espelha cartões.
 */
export async function syncTripExpensesToFinance(userId, tripId, payload) {
    await ensureExpenseTripLinkColumns();
    const expenses = Array.isArray(payload?.expenses) ? [...payload.expenses] : [];
    const warnings = [];
    let changed = false;

    const aliveIds = new Set(expenses.map((e) => e.id));
    const { rows: linked } = await query(
        `SELECT id, trip_expense_id AS "tripExpenseId"
         FROM expenses WHERE user_id = $1 AND trip_id = $2`,
        [userId, tripId]
    );
    for (const link of linked) {
        const teId = link.tripExpenseId;
        if (teId && !aliveIds.has(teId)) {
            await deleteFinanceExpense(userId, link.id);
            changed = true;
        }
    }

    const nextExpenses = [];
    for (const ex of expenses) {
        try {
            const { expense, patched } = await syncFinanceExpenseForTripExpense(userId, tripId, ex);
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