export const COFRINHOS_LEDGER_ACCOUNT_NAV_KEY = 'cofrinhos.ledger.accountId';

export function stashCofrinhosLedgerAccountNav(accountId: string) {
    const id = String(accountId ?? '').trim();
    if (!id) return;
    try {
        sessionStorage.setItem(COFRINHOS_LEDGER_ACCOUNT_NAV_KEY, id);
    } catch {
        /* ignore */
    }
}

export function takeCofrinhosLedgerAccountNav(): string {
    try {
        const raw = sessionStorage.getItem(COFRINHOS_LEDGER_ACCOUNT_NAV_KEY);
        sessionStorage.removeItem(COFRINHOS_LEDGER_ACCOUNT_NAV_KEY);
        return String(raw ?? '').trim();
    } catch {
        return '';
    }
}