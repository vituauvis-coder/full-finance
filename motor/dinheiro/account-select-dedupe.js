import { normalizeInstitutionKey } from './account-uniqueness.js';

/** Contas que recebem estorno / Pix no Dinheiro — não cartão nem VA/cofrinho. */
export const SPLIT_CREDIT_ACCOUNT_TYPES = new Set(['conta_corrente', 'poupanca', 'dinheiro', 'outros']);

export function accountEligibleForSplitCredit(acc) {
    return SPLIT_CREDIT_ACCOUNT_TYPES.has(String(acc?.type ?? ''));
}

function splitCreditTypeRank(type) {
    const t = String(type ?? '');
    if (t === 'conta_corrente') return 0;
    if (t === 'poupanca') return 1;
    if (t === 'outros' || t === 'dinheiro') return 2;
    return 9;
}

function preferSplitCreditRow(a, b) {
    const ar = splitCreditTypeRank(a?.type);
    const br = splitCreditTypeRank(b?.type);
    if (ar !== br) return ar < br ? a : b;
    const aPri = a?.isPrimaryCash ? 0 : 1;
    const bPri = b?.isPrimaryCash ? 0 : 1;
    if (aPri !== bPri) return aPri < bPri ? a : b;
    return String(a?.id ?? '').localeCompare(String(b?.id ?? '')) <= 0 ? a : b;
}

/**
 * Uma linha por instituição (nome normalizado) — corta migrações com duas «Itaú» corrente.
 */
export function dedupeAccountsByInstitutionName(accounts) {
    const map = new Map();
    for (const acc of accounts ?? []) {
        const inst = normalizeInstitutionKey(acc?.name);
        if (!inst) continue;
        const prev = map.get(inst);
        map.set(inst, prev ? preferSplitCreditRow(acc, prev) : acc);
    }
    return [...map.values()].sort((a, b) =>
        String(a?.name ?? '').localeCompare(String(b?.name ?? ''), 'pt-BR')
    );
}