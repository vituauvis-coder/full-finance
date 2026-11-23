import { requireAuth } from '../middleware/auth.js';
import { query } from '../db.js';
import {
    expensesOnHouseholdAccountsSql,
    gainsOnHouseholdAccountsSql,
    queryAccountsForUser
} from '../household.js';

export const EXPENSE_TRACE_SELECT = `
    e.source,
    e.external_ref AS "externalRef",
    e.receipt_url AS "receiptUrl"`;

export const GAIN_TRACE_SELECT = `
    g.source,
    g.external_ref AS "externalRef",
    g.receipt_url AS "receiptUrl"`;

function parseRangeQuery(fromRaw, toRaw) {
    const from = fromRaw ? new Date(String(fromRaw).trim()) : null;
    const to = toRaw ? new Date(String(toRaw).trim()) : null;
    if (from && Number.isNaN(from.getTime())) return { error: 'Parâmetro from inválido' };
    if (to && Number.isNaN(to.getTime())) return { error: 'Parâmetro to inválido' };
    return { from, to };
}

export function registerFinanceAgentRoutes(app, { normalizeMovement }) {
    app.get('/api/accounts', requireAuth, async (req, res) => {
        try {
            const uid = req.session.userId;
            const accounts = await queryAccountsForUser(uid);
            res.json(
                accounts.map((a) => ({
                    id: a.id,
                    name: a.name,
                    type: a.type,
                    isPrimaryCash: Boolean(a.isPrimaryCash),
                    linkedAccountId: a.linkedAccountId ?? null
                }))
            );
        } catch (e) {
            console.error('GET /api/accounts', e);
            res.status(500).json({ error: e.message || 'Erro ao listar contas' });
        }
    });

    app.get('/api/expenses', requireAuth, async (req, res) => {
        try {
            const uid = req.session.userId;
            const range = parseRangeQuery(req.query.from, req.query.to);
            if (range.error) return res.status(400).json({ error: range.error });

            const params = [uid];
            let sql = `
                SELECT
                    e.id,
                    e.user_id AS "userId",
                    e.account_id AS "accountId",
                    e.category,
                    e.subcategory,
                    e.amount,
                    e.description,
                    e.date,
                    e.created_at AS "createdAt",
                    e.is_paid AS "isPaid",
                    e.is_cofrinho AS "isCofrinho",
                    e.installment_count AS "installmentCount",
                    e.cash_out_confirmed_periods AS "cashOutConfirmedPeriods",
                    e.recurring_monthly AS "recurringMonthly",
                    e.recurrence_group_id AS "recurrenceGroupId",
                    e.split_request_id AS "splitRequestId",
                    e.reference_only AS "referenceOnly",
                    e.is_fixed AS "isFixed",
                    e.trip_id AS "tripId",
                    e.trip_expense_id AS "tripExpenseId",
                    e.paid_from_cofrinho AS "paidFromCofrinho",
                    ${EXPENSE_TRACE_SELECT}
                 FROM expenses e
                 WHERE ${expensesOnHouseholdAccountsSql(1)}`;

            if (range.from) {
                params.push(range.from);
                sql += ` AND e.date >= $${params.length}`;
            }
            if (range.to) {
                params.push(range.to);
                sql += ` AND e.date <= $${params.length}`;
            }
            sql += ` ORDER BY e.date DESC, e.created_at DESC LIMIT 500`;

            const { rows } = await query(sql, params);
            res.json(rows.map(normalizeMovement));
        } catch (e) {
            console.error('GET /api/expenses', e);
            res.status(500).json({ error: e.message || 'Erro ao listar saídas' });
        }
    });

    app.get('/api/gains', requireAuth, async (req, res) => {
        try {
            const uid = req.session.userId;
            const range = parseRangeQuery(req.query.from, req.query.to);
            if (range.error) return res.status(400).json({ error: range.error });

            const params = [uid];
            let sql = `
                SELECT
                    g.id,
                    g.user_id AS "userId",
                    g.account_id AS "accountId",
                    g.category,
                    g.subcategory,
                    g.amount,
                    g.description,
                    g.date,
                    g.is_paid AS "isPaid",
                    g.recurrence_group_id AS "recurrenceGroupId",
                    g.related_expense_id AS "relatedExpenseId",
                    g.reference_only AS "referenceOnly",
                    ${GAIN_TRACE_SELECT}
                 FROM gains g
                 WHERE ${gainsOnHouseholdAccountsSql(1)}`;

            if (range.from) {
                params.push(range.from);
                sql += ` AND g.date >= $${params.length}`;
            }
            if (range.to) {
                params.push(range.to);
                sql += ` AND g.date <= $${params.length}`;
            }
            sql += ` ORDER BY g.date DESC LIMIT 500`;

            const { rows } = await query(sql, params);
            res.json(rows.map(normalizeMovement));
        } catch (e) {
            console.error('GET /api/gains', e);
            res.status(500).json({ error: e.message || 'Erro ao listar entradas' });
        }
    });
}