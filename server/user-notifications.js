/**
 * Notificações persistidas (aviso ao solicitante de rateio quando o outro confirma pagamento).
 */
import { query } from './db.js';

const MONTH_NAMES_PT = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
];

export function formatPeriodKeyPt(periodKey) {
    const s = String(periodKey ?? '').trim();
    const m = s.match(/^(\d{4})-(\d{1,2})/);
    if (!m) return s || 'o período indicado';
    const monthIndex = Math.min(11, Math.max(0, parseInt(m[2], 10) - 1));
    return `${MONTH_NAMES_PT[monthIndex]} de ${m[1]}`;
}

export function formatMoneyBrl(amount, currency = 'BRL') {
    const n = Number(amount) || 0;
    try {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(n);
    } catch {
        return `R$ ${n.toFixed(2).replace('.', ',')}`;
    }
}

/**
 * @param {object} p
 * @param {string} p.requesterUserId
 * @param {string} p.payerUserId
 * @param {string} p.periodKey
 * @param {boolean} p.payerAccountIsCreditCard
 * @param {boolean} p.reimbursementPosted
 * @param {number|null|undefined} p.reimbursementAmount
 */
export async function insertSplitPayerConfirmedNotification(p) {
    const [{ rows: payerRows }, { rows: reqRows }] = await Promise.all([
        query(`SELECT name FROM users WHERE id = $1 LIMIT 1`, [p.payerUserId]),
        query(`SELECT currency FROM users WHERE id = $1 LIMIT 1`, [p.requesterUserId])
    ]);
    const payerName = String(payerRows[0]?.name || '').trim() || 'O outro participante';
    const cur = String(reqRows[0]?.currency || 'BRL').trim() || 'BRL';

    const periodLabel = formatPeriodKeyPt(p.periodKey);
    let detail;
    if (p.payerAccountIsCreditCard) {
        detail = `${payerName} marcou como paga a parte dele no cartão referente a ${periodLabel}. Não foi gerado estorno automático nas suas entradas (regra para pagamentos no cartão).`;
    } else if (p.reimbursementPosted && p.reimbursementAmount != null) {
        const amt = formatMoneyBrl(p.reimbursementAmount, cur);
        detail = `${payerName} confirmou o pagamento da parte dele referente a ${periodLabel}. O estorno de ${amt} foi lançado nas suas entradas.`;
    } else {
        detail = `${payerName} confirmou o pagamento da parte dele referente a ${periodLabel}.`;
    }

    await query(
        `INSERT INTO user_notifications (user_id, kind, title, detail)
         VALUES ($1, $2, $3, $4)`,
        [p.requesterUserId, 'split_payer_confirmed', 'Divisão: outro usuário pagou a parte dele', detail]
    );
}

export async function fetchNotificationsForUser(userId, limit = 80) {
    const lim = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 80));
    const { rows } = await query(
        `SELECT
            id,
            user_id AS "userId",
            kind,
            title,
            detail,
            read_at AS "readAt",
            created_at AS "createdAt"
         FROM user_notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, lim]
    );
    return rows;
}

export async function markNotificationsReadForUser(userId, kind = null) {
    if (kind) {
        await query(
            `UPDATE user_notifications
             SET read_at = NOW()
             WHERE user_id = $1 AND kind = $2 AND read_at IS NULL`,
            [userId, kind]
        );
    } else {
        await query(
            `UPDATE user_notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
            [userId]
        );
    }
}

export async function notifySplitRequesterOnRecipientCashOutConfirm({
    alreadyHad,
    effectiveSplitRequestId,
    payerUserId,
    periodKey,
    payerExpenseAccountType,
    reimbursementPosted,
    reimbursementAmount
}) {
    if (alreadyHad || !effectiveSplitRequestId || !payerUserId || !periodKey) return;

    const { rows } = await query(
        `SELECT requester_user_id AS "requesterUserId", recipient_user_id AS "recipientUserId", status
         FROM expense_split_requests
         WHERE id = $1`,
        [effectiveSplitRequestId]
    );
    const sr = rows[0] || null;
    if (!sr) return;
    if (String(sr.status ?? '').toUpperCase() !== 'ACCEPTED') return;
    if (String(sr.recipientUserId) !== String(payerUserId)) return;

    await insertSplitPayerConfirmedNotification({
        requesterUserId: sr.requesterUserId,
        payerUserId,
        periodKey,
        payerAccountIsCreditCard: payerExpenseAccountType === 'cartao_credito',
        reimbursementPosted: Boolean(reimbursementPosted),
        reimbursementAmount: reimbursementAmount != null ? Number(reimbursementAmount) : null
    });
}
