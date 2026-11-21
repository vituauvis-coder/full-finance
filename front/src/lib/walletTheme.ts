/** Combinações nome de banco → classe visual do plástico (paridade com transactions.js). */
function normalizeAccountNameForBankTheme(name: string) {
    return String(name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
}

export function resolveBankThemeClass(name: string) {
    const s = normalizeAccountNameForBankTheme(name);
    if (!s.trim()) return '';
    const rules: Array<[string, () => boolean]> = [
        ['account-card--bank-caixa', () => s.includes('caixa economica') || s.includes('cef') || (s.includes('caixa') && s.includes('federal'))],
        ['account-card--bank-bb', () => s.includes('banco do brasil') || /\bbb\b/.test(s)],
        ['account-card--bank-mercado-pago', () => s.includes('mercado pago') || s.includes('mercadopago')],
        [
            'account-card--bank-inter',
            () =>
                s.includes('banco inter') ||
                s === 'inter' ||
                (s.includes('inter') && !s.includes('internacional'))
        ],
        ['account-card--bank-itau', () => s.includes('itaú') || s.includes('itau')],
        ['account-card--bank-bradesco', () => s.includes('bradesco')],
        ['account-card--bank-nubank', () => s.includes('nubank') || s.includes('nu pagamentos')],
        ['account-card--bank-santander', () => s.includes('santander')],
        ['account-card--bank-c6', () => s.includes('c6 bank') || s === 'c6'],
        ['account-card--bank-picpay', () => s.includes('picpay')],
        ['account-card--bank-alelo', () => s.includes('alelo')]
    ];
    for (const [cls, ok] of rules) {
        if (ok()) return cls;
    }
    return '';
}