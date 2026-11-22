/**
 * Conta principal («Saldo em conta») — uma conta de caixa elegível por household.
 */

const TYPE_RANK = new Map([
    ['conta_corrente', 0],
    ['poupanca', 1],
    ['dinheiro', 2],
    ['outros', 3]
]);

/**
 * @param {(type: string | undefined) => boolean} isCashBalanceAccountType
 */
function isPrimaryCashMarked(a) {
    const v = a?.isPrimaryCash;
    return v === true || v === 'true' || v === 1 || v === '1';
}

export function pickPrimaryCashAccounts(allAccounts, isCashBalanceAccountType) {
    const all = allAccounts || [];
    const flagged = all.filter(isPrimaryCashMarked);
    if (flagged.length === 0) return null;
    const marked = flagged.filter((a) => isCashBalanceAccountType(a.type));
    if (marked.length === 0) return null;
    if (marked.length === 1) return marked;

    const ranked = [...marked].sort((a, b) => {
        const ra = TYPE_RANK.get(String(a.type ?? '')) ?? 9;
        const rb = TYPE_RANK.get(String(b.type ?? '')) ?? 9;
        if (ra !== rb) return ra - rb;
        return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR');
    });
    return [ranked[0]];
}