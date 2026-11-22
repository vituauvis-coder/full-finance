import { movementDateToJsDate } from './movement-date.js';

const COFRINHO_CATEGORY = 'Cofrinhos';

function movementAmount(movement) {
    return Math.max(0, Number(movement?.amount) || 0);
}

function movementDate(movement) {
    const d = movementDateToJsDate(movement?.date);
    return Number.isNaN(d.getTime()) ? null : d;
}

function expenseIsMarkedCofrinho(movement) {
    if (movement?.referenceOnly) return false;
    const v = movement?.isCofrinho ?? movement?.is_cofrinho;
    if (v === true || v === 'true' || v === 1 || v === '1') return true;
    return String(movement?.category ?? '').trim() === COFRINHO_CATEGORY;
}

function movementPaidFromTripCofrinho(movement) {
    const v = movement?.paidFromCofrinho ?? movement?.paid_from_cofrinho;
    return v === true || v === 'true' || v === 1 || v === '1';
}

/** Saída que envia valor da conta para o cofrinho (tipo B / marcado cofrinho). */
export function isCofrinhoDepositFromAccount(movement) {
    if (movement?.referenceOnly) return false;
    if (movement?.isPaid === false) return false;
    if (movementPaidFromTripCofrinho(movement)) return false;
    return expenseIsMarkedCofrinho(movement);
}

/** Gasto pago com saldo já reservado no cofrinho (tipo C; não é novo aporte). */
export function isCofrinhoWithdrawalOnAccount(movement) {
    if (movement?.referenceOnly) return false;
    return movementPaidFromTripCofrinho(movement);
}

function inCivilMonth(d, year, monthIndex) {
    return d.getFullYear() === year && d.getMonth() === monthIndex;
}

/**
 * @param {object[]} expenses
 * @param {Set<string> | string[]} accountIds — contas de débito (corrente/poupança)
 * @param {{ year?: number, monthIndex?: number }} [scope]
 */
export function summarizeWalletAccountCofrinho(expenses, accountIds, scope = {}) {
    const ids = accountIds instanceof Set ? accountIds : new Set(accountIds);
    let accumulated = 0;
    let withdrawn = 0;
    let monthAccumulated = 0;
    let monthWithdrawn = 0;
    let lastEventAt = null;

    const hasMonth =
        Number.isFinite(scope.year) &&
        Number.isFinite(scope.monthIndex) &&
        scope.monthIndex >= 0 &&
        scope.monthIndex <= 11;

    for (const m of expenses ?? []) {
        const accountId = String(m?.accountId ?? '').trim();
        if (!accountId || !ids.has(accountId)) continue;

        const d = movementDate(m);
        const amt = movementAmount(m);
        const deposit = isCofrinhoDepositFromAccount(m);
        const withdrawal = isCofrinhoWithdrawalOnAccount(m);
        if (!deposit && !withdrawal) continue;

        if (deposit) {
            accumulated += amt;
            if (hasMonth && d && inCivilMonth(d, scope.year, scope.monthIndex)) monthAccumulated += amt;
        }
        if (withdrawal) {
            withdrawn += amt;
            if (hasMonth && d && inCivilMonth(d, scope.year, scope.monthIndex)) monthWithdrawn += amt;
        }

        if (d) {
            const iso = d.toISOString().slice(0, 10);
            if (!lastEventAt || iso > lastEventAt) lastEventAt = iso;
        }
    }

    const net = Math.round((accumulated - withdrawn) * 100) / 100;
    return {
        accumulated: Math.round(accumulated * 100) / 100,
        withdrawn: Math.round(withdrawn * 100) / 100,
        net,
        monthAccumulated: Math.round(monthAccumulated * 100) / 100,
        monthWithdrawn: Math.round(monthWithdrawn * 100) / 100,
        lastEventAt
    };
}