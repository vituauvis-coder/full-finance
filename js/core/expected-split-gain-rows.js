/**
 * Linhas sintéticas «Expectativa de estorno» para pedidos de split aceitos sem Gain persistido.
 * Usado na lista de entradas e nos totais do painel (cards / gráfico).
 */

import { getMonthKeysInPeriod } from './period-filters.js';
import { isCreditCardType, movementDateToJsDate } from './utils.js';
import {
    isAcceptedSettledSplitRequest,
    isSplitReimbursementGain,
    movementMonthKey,
    normalizeSplitScope
} from './split-net.js';

/** Normaliza "2026-5", "2026-05" ou ISO para comparação com chave YYYY-MM. */
function normalizeYyyyMmFromPeriodKey(value) {
    if (value == null || value === '') return '';
    const s = String(value).trim();
    const m = s.match(/^(\d{4})-(\d{1,2})(?:-\d+)?/);
    if (m) {
        return `${m[1]}-${String(m[2]).padStart(2, '0')}`;
    }
    return '';
}

/**
 * @param {string} period
 * @param {Date} now
 * @param {object[]} expenses
 * @param {object[]} accounts
 * @param {object[]} outgoingSplitsRaw pedidos outgoing (filtra aceitos dentro da função)
 * @param {object[]} existingGains lista completa de ganhos persistidos (para evitar duplicar estorno já lançado)
 * @returns {object[]}
 */
export function buildSyntheticExpectedSplitGainsRows(
    period,
    now,
    expenses,
    accounts,
    outgoingSplitsRaw,
    existingGains
) {
    if (!period) return [];
    const incomeRows = existingGains || [];
    const outgoing = (outgoingSplitsRaw || []).filter((s) => isAcceptedSettledSplitRequest(s));
    const months = getMonthKeysInPeriod(period, now);
    if (!months.length) return [];

    const out = [];
    const seenRowIds = new Set();

    for (const mk of months) {
        for (const s of outgoing) {
            const srcId = String(s.sourceExpenseId ?? s.sourceExpense?.id ?? '');
            const src = (expenses || []).find((e) => e && String(e.id) === srcId) || s.sourceExpense;
            if (!src || !src.accountId) continue;
            const acc = (accounts || []).find((a) => a.id === src.accountId);

            const scope = normalizeSplitScope(s.splitScope);
            const nInst = Math.max(1, parseInt(String(src.installmentCount ?? '1'), 10) || 1);
            const isCard = acc && isCreditCardType(acc.type);
            const deferFull =
                scope === 'FULL_EXPENSE' && nInst >= 2 && acc && !isCard;

            if (scope === 'INSTALLMENT') {
                if (normalizeYyyyMmFromPeriodKey(s.targetPeriodKey) !== mk) continue;
                if (s.createdGainId) continue;
            } else if (scope === 'FULL_EXPENSE') {
                if (deferFull) continue;
                if (s.createdGainId) continue;
                if (movementMonthKey(src.date) !== mk) continue;
            } else {
                continue;
            }

            const creditAcc = String(s.requesterCreditAccountId ?? '').trim();
            if (!creditAcc) continue;

            const alreadyHaveEstorno = incomeRows.some(
                (g) =>
                    g &&
                    g.relatedExpenseId &&
                    String(g.relatedExpenseId) === String(srcId) &&
                    isSplitReimbursementGain(g) &&
                    movementMonthKey(g.date) === mk
            );
            if (alreadyHaveEstorno) continue;

            const y = Number(mk.slice(0, 4));
            const m = Number(mk.slice(5, 7)) - 1;
            const dateInMonth = new Date(
                y,
                m,
                Math.min(movementDateToJsDate(src.date).getDate(), new Date(y, m + 1, 0).getDate()),
                12,
                0,
                0,
                0
            );

            const amt = Number(s.amount) || 0;
            if (amt <= 0) continue;

            const rowId = `__expSplit__${s.id}`;
            if (seenRowIds.has(rowId)) continue;

            const descBase = String(src.description ?? 'Compra').trim() || 'Compra';
            out.push({
                id: rowId,
                accountId: creditAcc,
                category: 'Reembolsos',
                subcategory: null,
                amount: amt,
                description: `Expectativa de estorno — ${descBase}`,
                date: dateInMonth.toISOString(),
                isPaid: false,
                recurrenceGroupId: null,
                relatedExpenseId: src.id,
                __syntheticExpectedSplit: true,
                __splitRequestId: s.id
            });
            seenRowIds.add(rowId);
        }
    }

    return out;
}
