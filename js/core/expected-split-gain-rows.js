/**
 * Linhas sintéticas «Expectativa de estorno» para pedidos de split aceitos sem Gain persistido.
 * Usado na lista de entradas e nos totais do painel (cards / gráfico).
 */

import { getMonthKeysInPeriod } from './period-filters.js';
import { isCreditCardType, movementDateToJsDate, movementDateToUnixSeconds } from './utils.js';
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

/** Já existe estorno real (lançado ou por confirmação de saída) para esse mês e despesa de origem do pedido. */
function hasRealSplitReimbursementForMonth(existingGains, splitSourceExpenseId, monthKeyYyyyMm) {
    const mk = String(monthKeyYyyyMm ?? '');
    if (!mk || !splitSourceExpenseId) return false;
    return (existingGains || []).some((g) => {
        if (!g || String(g.relatedExpenseId) !== String(splitSourceExpenseId)) return false;
        if (!isSplitReimbursementGain(g)) return false;
        const desc = String(g.description ?? '').trim().toLowerCase();
        if (desc.startsWith('estorno parcela') || desc.startsWith('extorno parcela')) {
            const m = desc.match(/parcela\s+(\d{4})-(\d{1,2})/);
            if (m) {
                const gMk = `${m[1]}-${String(m[2]).padStart(2, '0')}`;
                return gMk === mk;
            }
        }
        return movementMonthKey(g.date) === mk;
    });
}

/**
 * Série mensal (vários lançamentos com mesmo `recurrenceGroupId`, `installmentCount` 1 em cada):
 * devolve uma entrada por mês para exibir «Expectativa de estorno» em todos os meses da série
 * quando o pedido é FULL e o estorno foi adiado (ex.: `sourceInstallmentCount` ≥ 2).
 * @returns {{ monthKey: string, dateLike: unknown }[] | null}
 */
function getMonthlySeriesMonthHitsForFullSplit(splitRow, src, allExpenses) {
    if (!src) return null;
    const nInst = Math.max(1, parseInt(String(src.installmentCount ?? '1'), 10) || 1);
    if (nInst >= 2) return null;

    const gid = String(src.recurrenceGroupId ?? src.recurrence_group_id ?? '').trim();
    if (!gid) return null;

    let siblings = (allExpenses || []).filter(
        (e) => e && String(e.recurrenceGroupId ?? e.recurrence_group_id ?? '').trim() === gid
    );
    siblings.sort((a, b) => movementDateToUnixSeconds(a.date) - movementDateToUnixSeconds(b.date));

    const fromSplit = parseInt(String(splitRow?.sourceInstallmentCount ?? ''), 10);
    const fromLen = parseInt(
        String(
            splitRow?.sourceExpense?.recurrenceSeriesLength ??
                src?.recurrenceSeriesLength ??
                src?.recurrence_series_length ??
                ''
        ),
        10
    );
    const countHint = Math.max(
        siblings.length,
        Number.isFinite(fromSplit) && fromSplit >= 2 ? fromSplit : 0,
        Number.isFinite(fromLen) && fromLen >= 2 ? fromLen : 0
    );
    const count = Math.min(99, Math.max(0, countHint >= 2 ? countHint : 0));
    if (count < 2) return null;

    if (siblings.length >= 2) {
        return siblings.map((e) => ({
            monthKey: movementMonthKey(e.date),
            dateLike: e.date
        }));
    }

    const d0 = movementDateToJsDate(src.date);
    if (Number.isNaN(d0.getTime())) return null;
    const out = [];
    const day0 = d0.getDate();
    for (let i = 0; i < count; i++) {
        const y = d0.getFullYear();
        const m = d0.getMonth() + i;
        const lastDay = new Date(y, m + 1, 0).getDate();
        const d = new Date(y, m, Math.min(day0, lastDay), 12, 0, 0, 0);
        out.push({ monthKey: movementMonthKey(d), dateLike: d.toISOString() });
    }
    return out;
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

            const seriesHits =
                scope === 'FULL_EXPENSE' ? getMonthlySeriesMonthHitsForFullSplit(s, src, expenses) : null;

            /** @type {{ monthKey: string, dateLike: unknown } | null} */
            let monthHit = null;
            if (scope === 'INSTALLMENT') {
                if (normalizeYyyyMmFromPeriodKey(s.targetPeriodKey) !== mk) continue;
                if (s.createdGainId) continue;
            } else if (scope === 'FULL_EXPENSE') {
                if (deferFull) continue;
                if (s.createdGainId) continue;

                if (seriesHits?.length) {
                    monthHit = seriesHits.find((h) => h.monthKey === mk) || null;
                    if (!monthHit) continue;
                } else {
                    if (movementMonthKey(src.date) !== mk) continue;
                    monthHit = { monthKey: mk, dateLike: src.date };
                }
            } else {
                continue;
            }

            const creditAcc = String(s.requesterCreditAccountId ?? '').trim();
            if (!creditAcc) continue;

            if (hasRealSplitReimbursementForMonth(incomeRows, srcId, mk)) continue;

            const anchorDate = movementDateToJsDate(monthHit ? monthHit.dateLike : src.date);
            if (Number.isNaN(anchorDate.getTime())) continue;

            const y = Number(mk.slice(0, 4));
            const m = Number(mk.slice(5, 7)) - 1;
            const dateInMonth = new Date(
                y,
                m,
                Math.min(anchorDate.getDate(), new Date(y, m + 1, 0).getDate()),
                12,
                0,
                0,
                0
            );

            const amt = Number(s.amount) || 0;
            if (amt <= 0) continue;

            const rowId =
                scope === 'FULL_EXPENSE' && seriesHits?.length
                    ? `__expSplit__${s.id}__${mk}`
                    : `__expSplit__${s.id}`;
            if (seenRowIds.has(rowId)) continue;

            const descBase = String(src.description ?? 'Compra').trim() || 'Compra';
            out.push({
                id: rowId,
                accountId: creditAcc,
                category: 'Reembolsos',
                subcategory: 'PIX',
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
