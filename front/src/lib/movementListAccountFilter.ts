import type { Account } from './types/finance';
import { buildPaymentMethodOptions } from './accounts';
import { accountUniquenessKey } from '@motor/dinheiro/account-uniqueness.js';

export type MovementListAccountOption = { value: string; label: string };

/** Opções do filtro «Conta» — mesmas contas do pagamento em Saídas, sem duplicar titular+função. */
export function buildMovementListAccountFilterOptions(accounts: Account[]): MovementListAccountOption[] {
    const payment = buildPaymentMethodOptions(accounts);
    const byId = new Map(accounts.map((a) => [String(a.id), a]));
    const seenUniq = new Set<string>();
    const out: MovementListAccountOption[] = [];

    for (const p of payment) {
        const acc = byId.get(String(p.value));
        const ukey = acc ? accountUniquenessKey(acc) : null;
        const dedupeKey = ukey ?? String(p.value);
        if (seenUniq.has(dedupeKey)) continue;
        seenUniq.add(dedupeKey);

        let label = p.label;
        if (p.group === 'pix') label = label.replace(/^PIX — /, '');
        out.push({ value: String(p.value), label });
    }

    return out.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

/** Lançamentos em contas duplicadas (mesma chave de unicidade) entram no mesmo filtro. */
export function expandAccountFilterIds(accountId: string, accounts: Account[]): Set<string> {
    const id = String(accountId ?? '').trim();
    if (!id) return new Set();
    const seed = accounts.find((a) => String(a.id) === id);
    const key = seed ? accountUniquenessKey(seed) : null;
    if (!key) return new Set([id]);
    const ids = new Set<string>();
    for (const a of accounts) {
        if (accountUniquenessKey(a) === key) ids.add(String(a.id));
    }
    return ids.size ? ids : new Set([id]);
}