import assert from 'node:assert/strict';
import test from 'node:test';

// Espelho mínimo do bundler — lógica importada via caminhos relativos ao motor.
import { accountUniquenessKey } from '../../../motor/dinheiro/account-uniqueness.js';

function buildMovementListAccountFilterOptions(accounts) {
    const isCard = (type) => {
        const t = String(type ?? '').toLowerCase();
        return t.includes('credito') || t.includes('debito') || t === 'cartao_credito' || t === 'cartao_debito';
    };
    const banks = accounts.filter((a) => !isCard(a.type)).sort((a, b) => a.name.localeCompare(b.name));
    const cards = accounts.filter((a) => isCard(a.type));
    const payment = [
        ...banks.map((b) => ({ value: b.id, label: `PIX — ${b.name}`, group: 'pix' })),
        ...cards.map((c) => ({
            value: c.id,
            label: `${c.name} (crédito)`,
            group: 'card'
        }))
    ];
    const byId = new Map(accounts.map((a) => [String(a.id), a]));
    const seenUniq = new Set();
    const out = [];
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
    return out;
}

test('filtro de conta deduplica mesma titular+instituição', () => {
    const holder = 'user-1';
    const accounts = [
        {
            id: 'itau-a',
            name: 'Itaú',
            type: 'conta_corrente',
            holderUserId: holder
        },
        {
            id: 'itau-b',
            name: 'Itaú',
            type: 'conta_corrente',
            holderUserId: holder
        },
        { id: 'caju', name: 'Caju', type: 'conta_corrente', holderUserId: holder }
    ];
    const opts = buildMovementListAccountFilterOptions(accounts);
    const itau = opts.filter((o) => o.label === 'Itaú');
    assert.equal(itau.length, 1);
    assert.equal(opts.length, 2);
});