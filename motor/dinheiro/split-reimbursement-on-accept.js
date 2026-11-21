/**
 * Decide se o aceite de rateio deve lançar o Gain de estorno agora.
 * Estorno só quando a parte do destinatário está paga (ou confirmação por parcela).
 */

import { normalizeSplitScope } from './split-net.js';

/**
 * @param {{
 *   sourcePaymentType?: string|null,
 *   splitScope?: string|null,
 *   sourceInstallmentCount?: number|string|null,
 *   recipientExpenseIsPaid?: boolean|null
 * }} opts
 * @returns {{ post: boolean, settle: boolean, reason: string }}
 */
export function shouldPostSplitReimbursementOnAccept(opts = {}) {
    const payType = String(opts.sourcePaymentType ?? '');
    if (payType === 'cartao_credito') {
        return { post: false, settle: false, reason: 'credit_card' };
    }

    const scope = normalizeSplitScope(opts.splitScope);
    const n = Math.max(1, parseInt(String(opts.sourceInstallmentCount ?? '1'), 10) || 1);
    if (scope === 'FULL_EXPENSE' && n >= 2) {
        return { post: false, settle: false, reason: 'defer_installments' };
    }

    if (!opts.recipientExpenseIsPaid) {
        return { post: false, settle: false, reason: 'recipient_unpaid' };
    }

    return { post: true, settle: true, reason: 'recipient_paid' };
}

/**
 * Quando o destinatário marca a saída do rateio como paga depois do aceite.
 * @param {{
 *   sourcePaymentType?: string|null,
 *   splitScope?: string|null,
 *   sourceInstallmentCount?: number|string|null,
 *   splitStatus?: string|null,
 *   alreadyHasGain?: boolean|null
 * }} opts
 * @returns {{ post: boolean, reason: string }}
 */
export function shouldPostSplitReimbursementOnRecipientPaid(opts = {}) {
    if (opts.alreadyHasGain) {
        return { post: false, reason: 'already_posted' };
    }
    const st = String(opts.splitStatus ?? '').trim().toUpperCase();
    if (st !== 'ACCEPTED') {
        return { post: false, reason: 'not_accepted' };
    }

    const decision = shouldPostSplitReimbursementOnAccept({
        sourcePaymentType: opts.sourcePaymentType,
        splitScope: opts.splitScope,
        sourceInstallmentCount: opts.sourceInstallmentCount,
        recipientExpenseIsPaid: true
    });
    if (!decision.post) {
        return { post: false, reason: decision.reason };
    }
    return { post: true, reason: 'recipient_marked_paid' };
}
