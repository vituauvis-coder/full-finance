/** Carteiras / VA que não devem liderar o rótulo «Saldo em conta» sem serem a conta principal. */
const AUXILIARY_CASH_LABEL =
    /mercado\s*pago|mercadopago|\bcaju\b|\balelo\b|\bswile\b|\bticket\b|\bsodexo\b|\bben\b/i;

export function cashBalanceLabelPenalty(accountName) {
    const n = String(accountName ?? '').trim();
    return AUXILIARY_CASH_LABEL.test(n) ? 1 : 0;
}

/** Quantos plásticos vinculados a esta instituição (proxy de «banco principal»). */
export function linkedPlasticCountForInstitution(institutionId, allAccounts) {
    const id = String(institutionId ?? '').trim();
    if (!id) return 0;
    let n = 0;
    for (const a of allAccounts || []) {
        if (String(a?.linkedAccountId ?? '').trim() === id) n += 1;
    }
    return n;
}