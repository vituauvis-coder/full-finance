export function isPixBankAccountType(type) {
    const t = String(type ?? '');
    return t === 'conta_corrente' || t === 'poupanca';
}

export function isCreditCardType(type) {
    const t = String(type ?? '').toLowerCase();
    return t.includes('credito') || t.includes('crédito') || t === 'cartao_credito' || t === 'credit';
}