/**
 * Rotas REST para solicitações de rateio de despesas entre usuários.
 */
import crypto from 'node:crypto';
import { query, withTransaction } from './db.js';
import { safeUpsertBalanceSnapshot } from './balance-snapshot.js';
import { referenceOnlyForUserMovement } from './reference-only.js';

function httpError(message, statusCode = 400) {
    const e = new Error(message);
    e.statusCode = statusCode;
    return e;
}

function toFirestoreLikeDate(isoOrObj) {
    if (!isoOrObj) {
        const d = new Date(0);
        return { seconds: 0, nanoseconds: 0, toDate: () => d };
    }
    let d;
    if (typeof isoOrObj === 'object' && isoOrObj.seconds != null) {
        d = new Date(isoOrObj.seconds * 1000);
    } else if (typeof isoOrObj === 'string') {
        d = new Date(isoOrObj);
    } else {
        d = new Date(isoOrObj);
    }
    if (Number.isNaN(d.getTime())) d = new Date();
    const seconds = Math.floor(d.getTime() / 1000);
    return { seconds, nanoseconds: 0, toDate: () => d };
}

function normalizeMovement(t) {
    const out = { ...t, date: toFirestoreLikeDate(t.date) };
    if (t.createdAt != null) out.createdAt = toFirestoreLikeDate(t.createdAt);
    if (t.referenceOnly != null) out.referenceOnly = Boolean(t.referenceOnly);
    return out;
}

/** Campos da despesa de origem expostos ao destinatário (para pré-preencher o modal da parte dele). */
const SOURCE_EXPENSE_API_SELECT = {
    id: true,
    description: true,
    amount: true,
    date: true,
    category: true,
    subcategory: true,
    isInvestment: true
};

/** Saída pode ser origem de rateio: não recorrente/parcelada de forma ambígua. */
export function expenseAllowsSplit(expense) {
    if (!expense) return false;
    return true;
}

function normalizeSplitScope(raw) {
    const scope = String(raw ?? 'FULL_EXPENSE').trim().toUpperCase();
    return scope === 'INSTALLMENT' ? 'INSTALLMENT' : 'FULL_EXPENSE';
}

function getSplitTargetGrossAmount(expense, splitScope, targetInstallmentIndex) {
    const total = Number(expense?.amount) || 0;
    const n = Math.max(1, parseInt(String(expense?.installmentCount ?? '1'), 10) || 1);
    if (splitScope === 'INSTALLMENT') {
        if (n < 2) return total;
        return total / n;
    }
    return total;
}

async function sumAllocatedSplitAmount(
    sourceExpenseId,
    splitScope = 'FULL_EXPENSE',
    targetInstallmentIndex = null,
    excludeRequestId = null
) {
    const params = [sourceExpenseId, splitScope];
    let sql = `SELECT COALESCE(SUM(amount), 0) AS total
               FROM expense_split_requests
               WHERE source_expense_id = $1
                 AND COALESCE(split_scope, 'FULL_EXPENSE') = $2
                 AND status IN ('PENDING','ACCEPTED')`;
    if (splitScope === 'INSTALLMENT') {
        params.push(targetInstallmentIndex);
        sql += ` AND target_installment_index = $${params.length}`;
    }
    if (excludeRequestId) {
        params.push(excludeRequestId);
        sql += ` AND id <> $${params.length}`;
    }
    const { rows } = await query(sql, params);
    return Number(rows[0]?.total) || 0;
}

function baseSplitSelectSql(extraWhereSql = '') {
    return `
        SELECT
            esr.id,
            esr.source_expense_id AS "sourceExpenseId",
            esr.requester_user_id AS "requesterUserId",
            esr.recipient_user_id AS "recipientUserId",
            esr.amount,
            esr.requester_credit_account_id AS "requesterCreditAccountId",
            esr.status,
            COALESCE(esr.split_scope, 'FULL_EXPENSE') AS "splitScope",
            esr.target_installment_index AS "targetInstallmentIndex",
            esr.target_period_key AS "targetPeriodKey",
            COALESCE(esr.is_settled, false) AS "isSettled",
            esr.sender_proof_url AS "senderProofUrl",
            esr.created_gain_id AS "createdGainId",
            esr.source_installment_count AS "sourceInstallmentCount",
            esr.created_at AS "createdAt",
            esr.updated_at AS "updatedAt",
            json_build_object('id', req.id, 'name', req.name, 'email', req.email) AS requester,
            json_build_object('id', rec.id, 'name', rec.name, 'email', rec.email) AS recipient,
            json_build_object(
                'id', se.id,
                'description', se.description,
                'amount', se.amount,
                'date', se.date,
                'category', se.category,
                'subcategory', se.subcategory,
                'isInvestment', se.is_investment,
                'installmentCount', se.installment_count,
                'cashOutConfirmedPeriods', se.cash_out_confirmed_periods,
                'recurringMonthly', se.recurring_monthly,
                'recurrenceGroupId', se.recurrence_group_id,
                'recurrenceSeriesLength', (
                    CASE
                        WHEN se.recurrence_group_id IS NULL OR btrim(se.recurrence_group_id::text) = '' THEN NULL
                        ELSE (
                            SELECT COUNT(*)::int FROM expenses se_cnt
                            WHERE se_cnt.user_id = se.user_id
                              AND se_cnt.recurrence_group_id = se.recurrence_group_id
                        )
                    END
                )
            ) AS "sourceExpense"
        FROM expense_split_requests esr
        JOIN users req ON req.id = esr.requester_user_id
        JOIN users rec ON rec.id = esr.recipient_user_id
        JOIN expenses se ON se.id = esr.source_expense_id
        ${extraWhereSql}
    `;
}

export function normalizeSplitRow(row) {
    if (!row) return null;
    const {
        requester,
        recipient,
        sourceExpense,
        recipientExpense,
        ...rest
    } = row;
    const out = {
        ...rest,
        requester: requester
            ? { id: requester.id, name: requester.name, email: requester.email }
            : undefined,
        recipient: recipient
            ? { id: recipient.id, name: recipient.name, email: recipient.email }
            : undefined,
        sourceExpense: sourceExpense
            ? {
                  id: sourceExpense.id,
                  description: sourceExpense.description,
                  amount: sourceExpense.amount,
                  date: sourceExpense.date,
                  category: sourceExpense.category,
                  subcategory: sourceExpense.subcategory ?? null,
                  isInvestment: Boolean(sourceExpense.isInvestment),
                  installmentCount:
                      sourceExpense.installmentCount ??
                      sourceExpense.installment_count ??
                      null,
                  recurrenceGroupId: sourceExpense.recurrenceGroupId ?? null,
                  recurrenceSeriesLength: sourceExpense.recurrenceSeriesLength ?? null
              }
            : undefined
    };
    if (sourceExpense?.date) {
        out.sourceExpense.date = toFirestoreLikeDate(sourceExpense.date);
    }
    const stored = rest.sourceInstallmentCount;
    const fromExp = out.sourceExpense?.installmentCount;
    const fromSeries = out.sourceExpense?.recurrenceSeriesLength;
    const seriesPick =
        fromSeries != null && Number.isFinite(Number(fromSeries)) && Number(fromSeries) >= 2
            ? Math.min(99, Math.floor(Number(fromSeries)))
            : null;
    const pick =
        stored != null && Number.isFinite(Number(stored)) && Number(stored) >= 2
            ? Math.min(99, Math.floor(Number(stored)))
            : fromExp != null && Number.isFinite(Number(fromExp)) && Number(fromExp) >= 2
              ? Math.min(99, Math.floor(Number(fromExp)))
              : seriesPick;
    out.sourceInstallmentCount = pick;
    return out;
}

const splitInclude = {
    requester: { select: { id: true, name: true, email: true } },
    recipient: { select: { id: true, name: true, email: true } },
    sourceExpense: { select: SOURCE_EXPENSE_API_SELECT }
};

/** Usado em GET /api/data para o primeiro paint. */
export async function fetchExpenseSplitBundleForUser(uid) {
    const [incomingRes, outgoingRes] = await Promise.all([
        query(
            baseSplitSelectSql(`WHERE esr.recipient_user_id = $1 ORDER BY esr.created_at DESC LIMIT 100`),
            [uid]
        ),
        query(
            baseSplitSelectSql(`WHERE esr.requester_user_id = $1 ORDER BY esr.created_at DESC LIMIT 100`),
            [uid]
        )
    ]);
    const incoming = incomingRes.rows;
    const outgoing = outgoingRes.rows;
    return {
        incoming: incoming.map(normalizeSplitRow),
        outgoing: outgoing.map(normalizeSplitRow)
    };
}

export function registerExpenseSplitRoutes(app, { requireAuth }) {
    app.get('/api/users/lookup', requireAuth, async (req, res) => {
        try {
            const email = String(req.query.email ?? '')
                .trim()
                .toLowerCase();
            if (!email || !email.includes('@')) {
                return res.status(400).json({ error: 'E-mail inválido' });
            }
            const { rows } = await query(
                `SELECT id, name, email FROM users WHERE email = $1 LIMIT 1`,
                [email]
            );
            const u = rows[0] || null;
            if (!u) return res.json({ user: null });
            const uid = req.session.userId;
            if (u.id === uid) return res.json({ user: null });
            res.json({ user: u });
        } catch (e) {
            console.error('GET /api/users/lookup', e);
            res.status(500).json({ error: 'Erro ao buscar usuário' });
        }
    });

    /** Lista usuários para escolher destinatário do rateio (exceto o logado). */
    app.get('/api/users/for-split', requireAuth, async (req, res) => {
        try {
            const uid = req.session.userId;
            const { rows: users } = await query(
                `SELECT id, name, email
                 FROM users
                 WHERE id <> $1
                 ORDER BY email ASC
                 LIMIT 500`,
                [uid]
            );
            res.json({ users });
        } catch (e) {
            console.error('GET /api/users/for-split', e);
            res.status(500).json({ error: 'Erro ao listar usuários' });
        }
    });

    app.get('/api/expense-splits', requireAuth, async (req, res) => {
        try {
            const uid = req.session.userId;
            const status = req.query.status ? String(req.query.status).toUpperCase() : null;
            const incomingWhere = status
                ? `WHERE esr.recipient_user_id = $1 AND esr.status = $2 ORDER BY esr.created_at DESC`
                : `WHERE esr.recipient_user_id = $1 ORDER BY esr.created_at DESC`;
            const outgoingWhere = status
                ? `WHERE esr.requester_user_id = $1 AND esr.status = $2 ORDER BY esr.created_at DESC`
                : `WHERE esr.requester_user_id = $1 ORDER BY esr.created_at DESC`;

            const [incomingRes, outgoingRes] = await Promise.all([
                query(baseSplitSelectSql(incomingWhere), status ? [uid, status] : [uid]),
                query(baseSplitSelectSql(outgoingWhere), status ? [uid, status] : [uid])
            ]);
            const incoming = incomingRes.rows;
            const outgoing = outgoingRes.rows;
            res.json({
                incoming: incoming.map(normalizeSplitRow),
                outgoing: outgoing.map(normalizeSplitRow)
            });
        } catch (e) {
            console.error('GET /api/expense-splits', e);
            res.status(500).json({ error: 'Erro ao listar rateios' });
        }
    });

    app.post('/api/expense-splits', requireAuth, async (req, res) => {
        try {
            const uid = req.session.userId;
            const sourceExpenseId = String(req.body?.sourceExpenseId ?? '').trim();
            const amount = Number(req.body?.amount);
            const requesterCreditAccountId = String(req.body?.requesterCreditAccountId ?? '').trim();
            const splitScope = normalizeSplitScope(req.body?.splitScope);
            const targetInstallmentIndexRaw = req.body?.targetInstallmentIndex;
            const targetInstallmentIndex =
                targetInstallmentIndexRaw == null || targetInstallmentIndexRaw === ''
                    ? null
                    : parseInt(String(targetInstallmentIndexRaw), 10);
            const targetPeriodKey =
                req.body?.targetPeriodKey == null ? null : String(req.body.targetPeriodKey).trim() || null;
            let recipientUserId = String(req.body?.recipientUserId ?? '').trim();
            const recipientEmail = String(req.body?.recipientEmail ?? '')
                .trim()
                .toLowerCase();

            if (!sourceExpenseId) throw httpError('Despesa de origem obrigatória');
            if (!Number.isFinite(amount) || amount <= 0) throw httpError('Valor inválido');
            if (!requesterCreditAccountId) throw httpError('Conta para receber o estorno é obrigatória');

            if (!recipientUserId && recipientEmail) {
                const { rows } = await query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [
                    recipientEmail
                ]);
                if (rows[0]) recipientUserId = rows[0].id;
            }
            if (!recipientUserId) throw httpError('Destinatário obrigatório');
            if (recipientUserId === uid) throw httpError('Não é possível dividir com você mesmo');

            const { rows: expenseRows } = await query(
                `SELECT
                    id,
                    amount,
                    date,
                    recurrence_group_id AS "recurrenceGroupId",
                    recurring_monthly AS "recurringMonthly",
                    installment_count AS "installmentCount"
                 FROM expenses
                 WHERE id = $1 AND user_id = $2
                 LIMIT 1`,
                [sourceExpenseId, uid]
            );
            const expense = expenseRows[0] || null;
            if (!expense) throw httpError('Saída não encontrada', 404);
            if (!expenseAllowsSplit(expense)) {
                throw httpError(
                    'Esta saída não pode ser dividida (recorrente, parcelada ou série no ano).'
                );
            }

            const rawDb = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
            const bodySrcN = parseInt(String(req.body?.sourceInstallmentCount ?? ''), 10);
            const nFromBody =
                Number.isFinite(bodySrcN) && bodySrcN >= 2 && bodySrcN <= 99 ? bodySrcN : null;
            let nFromSeries = 1;
            const rg = expense.recurrenceGroupId && String(expense.recurrenceGroupId).trim();
            if (rg) {
                const { rows: serRows } = await query(
                    `SELECT COUNT(*)::int AS c FROM expenses
                     WHERE user_id = $1 AND recurrence_group_id = $2`,
                    [uid, rg]
                );
                nFromSeries = Math.max(1, parseInt(String(serRows[0]?.c ?? '1'), 10) || 1);
            }
            const nInst = Math.max(rawDb, nFromBody != null ? nFromBody : 1, nFromSeries);
            const sourceInstallmentToStore = nInst >= 2 ? nInst : null;
            if (splitScope === 'INSTALLMENT') {
                if (nInst < 2) {
                    throw httpError('Esta saída não possui parcelas para divisão por parcela.');
                }
                if (!Number.isFinite(targetInstallmentIndex) || targetInstallmentIndex < 1 || targetInstallmentIndex > nInst) {
                    throw httpError(`Parcela inválida. Escolha entre 1 e ${nInst}.`);
                }
            }
            const normalizedTargetPeriodKey =
                splitScope === 'INSTALLMENT'
                    ? targetPeriodKey ||
                      (() => {
                          const d = new Date(expense.date);
                          if (Number.isNaN(d.getTime())) return null;
                          d.setMonth(d.getMonth() + Math.max(0, Number(targetInstallmentIndex || 1) - 1));
                          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                      })()
                    : null;

            const totalTarget = getSplitTargetGrossAmount(expense, splitScope, targetInstallmentIndex);
            const already = await sumAllocatedSplitAmount(
                sourceExpenseId,
                splitScope,
                splitScope === 'INSTALLMENT' ? targetInstallmentIndex : null
            );
            if (already + amount > totalTarget + 0.01) {
                throw httpError(
                    `O valor dividido não pode ultrapassar o total disponível no alvo (${totalTarget}).`
                );
            }

            const { rows: creditAccRows } = await query(
                `SELECT id FROM accounts WHERE id = $1 AND user_id = $2 LIMIT 1`,
                [requesterCreditAccountId, uid]
            );
            if (!creditAccRows[0]) throw httpError('Conta para estorno inválida');

            const id = crypto.randomUUID();
            await query(
                `INSERT INTO expense_split_requests (
                    id, source_expense_id, requester_user_id, recipient_user_id,
                    amount, requester_credit_account_id, status, split_scope, target_installment_index, target_period_key, is_settled, source_installment_count, created_at, updated_at
                 ) VALUES ($1,$2,$3,$4,$5,$6,'PENDING',$7,$8,$9,false, $10, now(), now())`,
                [
                    id,
                    sourceExpenseId,
                    uid,
                    recipientUserId,
                    amount,
                    requesterCreditAccountId,
                    splitScope,
                    splitScope === 'INSTALLMENT' ? targetInstallmentIndex : null,
                    normalizedTargetPeriodKey,
                    sourceInstallmentToStore
                ]
            );
            const { rows: splitRows } = await query(
                baseSplitSelectSql(`WHERE esr.id = $1 LIMIT 1`),
                [id]
            );
            const row = splitRows[0] || null;

            res.status(201).json(normalizeSplitRow(row));
        } catch (e) {
            console.error('POST /api/expense-splits', e);
            const code = e.statusCode || 500;
            res.status(code).json({ error: e.message || 'Erro ao criar rateio' });
        }
    });

    app.post('/api/expense-splits/:id/accept', requireAuth, async (req, res) => {
        try {
            const uid = req.session.userId;
            const id = String(req.params.id ?? '').trim();

            const result = await withTransaction(async (client) => {
                const { rows: splitRows } = await client.query(
                    `SELECT
                        id,
                        source_expense_id AS "sourceExpenseId",
                        requester_user_id AS "requesterUserId",
                        recipient_user_id AS "recipientUserId",
                        amount,
                        requester_credit_account_id AS "requesterCreditAccountId",
                        COALESCE(split_scope, 'FULL_EXPENSE') AS "splitScope",
                        target_installment_index AS "targetInstallmentIndex",
                        target_period_key AS "targetPeriodKey",
                        COALESCE(is_settled, false) AS "isSettled",
                        created_gain_id AS "createdGainId",
                        status
                     FROM expense_split_requests
                     WHERE id = $1 AND recipient_user_id = $2
                     FOR UPDATE`,
                    [id, uid]
                );
                const split = splitRows[0] || null;
                if (!split) throw httpError('Solicitação não encontrada', 404);
                const status = String(split.status ?? '').toUpperCase();
                if (status === 'ACCEPTED') {
                    const { rows: fullRows } = await client.query(
                        baseSplitSelectSql(`WHERE esr.id = $1 LIMIT 1`),
                        [split.id]
                    );
                    const fullSplit = fullRows[0] || null;
                    let gain = null;
                    if (split.createdGainId) {
                        const { rows: gainRows } = await client.query(
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
                             WHERE id = $1
                             LIMIT 1`,
                            [split.createdGainId]
                        );
                        gain = gainRows[0] || null;
                    }
                    return { gain, split: fullSplit };
                }
                if (status !== 'PENDING') {
                    throw httpError(`Solicitação não pode ser aceita (status: ${status || '—'})`);
                }

                const gainAccountId = String(split.requesterCreditAccountId ?? '').trim();
                if (!gainAccountId)
                    throw httpError('Conta de estorno não configurada nesta solicitação');

                const { rows: accRows } = await client.query(
                    `SELECT id
                     FROM accounts
                     WHERE id = $1 AND user_id = $2
                     LIMIT 1`,
                    [gainAccountId, split.requesterUserId]
                );
                if (!accRows[0]) throw httpError('Conta do solicitante inválida');

                const { rows: sourceRows } = await client.query(
                    `SELECT
                        e.description,
                        COALESCE(e.installment_count, 1) AS "installmentCount",
                        a.type AS "paymentType"
                     FROM expenses e
                     JOIN accounts a ON a.id = e.account_id AND a.user_id = e.user_id
                     WHERE e.id = $1 AND e.user_id = $2
                     LIMIT 1`,
                    [split.sourceExpenseId, split.requesterUserId]
                );
                const sourceDesc =
                    String(sourceRows[0]?.description ?? 'Compra').trim() || 'Compra';
                const srcInstallments = Math.max(
                    1,
                    parseInt(String(sourceRows[0]?.installmentCount ?? '1'), 10) || 1
                );
                const scope = String(split.splitScope ?? 'FULL_EXPENSE').trim().toUpperCase();
                const payType = String(sourceRows[0]?.paymentType ?? '');
                const disableReimbursement = payType === 'cartao_credito';
                const deferReimbursement =
                    !disableReimbursement && scope === 'FULL_EXPENSE' && srcInstallments >= 2;
                let gain = null;
                if (disableReimbursement) {
                    // Cartão: split não gera reembolso/entrada (nem no aceite nem por parcela).
                    await client.query(
                        `UPDATE expense_split_requests
                         SET status = 'ACCEPTED', created_gain_id = NULL, is_settled = false, updated_at = now()
                         WHERE id = $1`,
                        [split.id]
                    );
                } else if (deferReimbursement) {
                    // Parcelado: não cria extorno total no aceite. O extorno entra por parcela,
                    // conforme o pagador confirma o pagamento no próprio lançamento.
                    await client.query(
                        `UPDATE expense_split_requests
                         SET status = 'ACCEPTED', created_gain_id = NULL, is_settled = false, updated_at = now()
                         WHERE id = $1`,
                        [split.id]
                    );
                } else {
                    const gainDescription = `Estorno parcial — ${sourceDesc}`;
                    const gainAmount = Number(split.amount) || 0;
                    const refGainAccept = await referenceOnlyForUserMovement(
                        split.requesterUserId,
                        new Date()
                    );
                    const gainId = crypto.randomUUID();
                    const { rows: gainRows } = await client.query(
                        `INSERT INTO gains (
                            id, user_id, account_id, category, subcategory, amount, description,
                            date, is_paid, recurrence_group_id, related_expense_id, reference_only
                         ) VALUES (
                            $1,$2,$3,'Reembolsos',NULL,$4,$5,
                            now(), true, NULL, $6, $7
                         )
                         RETURNING
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
                            reference_only AS "referenceOnly"`,
                        [
                            gainId,
                            split.requesterUserId,
                            gainAccountId,
                            gainAmount,
                            gainDescription,
                            split.sourceExpenseId,
                            refGainAccept
                        ]
                    );
                    gain = gainRows[0];
                    await client.query(
                        `UPDATE expense_split_requests
                         SET status = 'ACCEPTED', created_gain_id = $2, is_settled = true, updated_at = now()
                         WHERE id = $1`,
                        [split.id, gain.id]
                    );
                }

                const { rows: fullRows } = await client.query(
                    baseSplitSelectSql(`WHERE esr.id = $1 LIMIT 1`),
                    [split.id]
                );
                const fullSplit = fullRows[0] || null;
                return { gain, split: fullSplit };
            });

            await safeUpsertBalanceSnapshot(result.split.requesterUserId);

            res.json({
                split: normalizeSplitRow(result.split),
                gain: result.gain ? normalizeMovement(result.gain) : null
            });
        } catch (e) {
            console.error('POST /api/expense-splits/:id/accept', e);
            const code = e.statusCode || 500;
            res.status(code).json({ error: e.message || 'Erro ao aceitar rateio' });
        }
    });

    app.post('/api/expense-splits/:id/reject', requireAuth, async (req, res) => {
        try {
            const uid = req.session.userId;
            const id = String(req.params.id ?? '').trim();
            const { rows: updatedRows } = await query(
                `UPDATE expense_split_requests
                 SET status = 'REJECTED', updated_at = now()
                 WHERE id = $1 AND recipient_user_id = $2 AND status = 'PENDING'
                 RETURNING id`,
                [id, uid]
            );
            if (!updatedRows[0]) return res.status(404).json({ error: 'Não encontrado' });
            const { rows } = await query(baseSplitSelectSql(`WHERE esr.id = $1 LIMIT 1`), [id]);
            res.json(normalizeSplitRow(rows[0]));
        } catch (e) {
            console.error('POST /api/expense-splits/:id/reject', e);
            res.status(500).json({ error: e.message || 'Erro ao recusar' });
        }
    });

    app.delete('/api/expense-splits/:id', requireAuth, async (req, res) => {
        try {
            const uid = req.session.userId;
            const id = String(req.params.id ?? '').trim();
            const { rows: splitRows } = await query(
                `SELECT status FROM expense_split_requests WHERE id = $1 AND requester_user_id = $2 LIMIT 1`,
                [id, uid]
            );
            const split = splitRows[0] || null;
            if (!split) return res.status(404).json({ error: 'Não encontrado' });
            const st = String(split.status ?? '').toUpperCase();
            if (st === 'ACCEPTED') {
                return res.status(409).json({
                    error: 'Não é possível remover uma divisão já aceita.',
                    code: 'SPLIT_ALREADY_ACCEPTED'
                });
            }
            /** Remove o registro (não só «cancelado») para liberar a FK da saída de origem. */
            await query(`DELETE FROM expense_split_requests WHERE id = $1 AND requester_user_id = $2`, [
                id,
                uid
            ]);
            res.json({ ok: true });
        } catch (e) {
            console.error('DELETE /api/expense-splits/:id', e);
            res.status(500).json({ error: e.message || 'Erro ao remover divisão' });
        }
    });

    app.patch('/api/expense-splits/:id', requireAuth, async (req, res) => {
        try {
            const uid = req.session.userId;
            const id = String(req.params.id ?? '').trim();
            const body = req.body || {};
            if (!Object.prototype.hasOwnProperty.call(body, 'senderProofUrl')) {
                return res.status(400).json({ error: 'senderProofUrl obrigatório (string ou null)' });
            }
            const raw = body.senderProofUrl;
            if (raw !== null && typeof raw !== 'string') {
                return res.status(400).json({ error: 'senderProofUrl inválido' });
            }
            const url = raw === null ? null : String(raw).trim() || null;
            const { rows: updatedRows } = await query(
                `UPDATE expense_split_requests
                 SET sender_proof_url = $3, updated_at = now()
                 WHERE id = $1 AND requester_user_id = $2
                 RETURNING id`,
                [id, uid, url]
            );
            if (!updatedRows[0]) return res.status(404).json({ error: 'Não encontrado' });
            const { rows } = await query(baseSplitSelectSql(`WHERE esr.id = $1 LIMIT 1`), [id]);
            res.json(normalizeSplitRow(rows[0]));
        } catch (e) {
            console.error('PATCH /api/expense-splits/:id', e);
            res.status(500).json({ error: e.message || 'Erro ao atualizar' });
        }
    });
}
