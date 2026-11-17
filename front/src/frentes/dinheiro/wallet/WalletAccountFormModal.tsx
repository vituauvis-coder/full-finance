import { FormEvent, useEffect, useState } from 'react';
import { ModalShell } from '../../../components/finance/ModalShell';
import { sortedBankAccounts } from '../../../lib/accounts';
import type { Account } from '../../../lib/types/finance';
import { createAccount, updateAccount, type AccountFormPayload } from '../api/wallet';

type Props = {
    open: boolean;
    accounts: Account[];
    editing: Account | null;
    defaultLinkedBankId?: string;
    defaultKind?: 'bank' | 'credit';
    onClose: () => void;
    onSaved: () => void | Promise<void>;
};

export function WalletAccountFormModal({
    open,
    accounts,
    editing,
    defaultLinkedBankId,
    defaultKind = 'bank',
    onClose,
    onSaved
}: Props) {
    const [kind, setKind] = useState<'bank' | 'credit' | 'debit'>('bank');
    const [name, setName] = useState('');
    const [balance, setBalance] = useState('');
    const [limit, setLimit] = useState('');
    const [dueDay, setDueDay] = useState('');
    const [linkedAccountId, setLinkedAccountId] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        setError('');
        if (editing) {
            setName(editing.name);
            setBalance(String(editing.balance ?? ''));
            setLimit(String((editing as Account & { limit?: number }).limit ?? ''));
            setDueDay(String((editing as Account & { dueDay?: number }).dueDay ?? ''));
            setLinkedAccountId(String((editing as Account & { linkedAccountId?: string }).linkedAccountId ?? ''));
            const t = String(editing.type ?? '');
            if (t.includes('credito') || t.includes('crédito')) setKind('credit');
            else if (isCardLike(t)) setKind('debit');
            else setKind('bank');
        } else {
            setName('');
            setBalance('');
            setLimit('');
            setDueDay('10');
            setKind(defaultKind === 'credit' ? 'credit' : 'bank');
            setLinkedAccountId(defaultLinkedBankId ?? '');
        }
    }, [open, editing, defaultKind, defaultLinkedBankId]);

    function resolveType() {
        if (kind === 'bank') return 'conta_corrente';
        if (kind === 'credit') return 'cartao_credito';
        return 'cartao_debito';
    }

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        const payload: AccountFormPayload = {
            name: name.trim(),
            type: resolveType(),
            initialBalance: balance ? parseFloat(balance) : 0,
            linkedAccountId: linkedAccountId || null,
            limit: limit ? parseFloat(limit) : null,
            dueDay: dueDay ? parseInt(dueDay, 10) : null
        };
        if (!payload.name) {
            setError('Informe o nome.');
            return;
        }
        if (kind !== 'bank' && !payload.linkedAccountId) {
            setError('Cartões precisam de uma conta bancária vinculada.');
            return;
        }
        setBusy(true);
        try {
            if (editing) await updateAccount(editing.id, payload);
            else await createAccount(payload);
            await onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar conta.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <ModalShell id="wallet-account-modal" open={open} title={editing ? 'Editar conta' : 'Nova conta'} onClose={onClose}>
            <form onSubmit={(e) => void onSubmit(e)} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {!editing ? (
                    <motionWizardKind kind={kind} setKind={setKind} />
                ) : null}
                <label>
                    Nome
                    <input value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                {kind === 'bank' ? (
                    <label>
                        Saldo inicial
                        <input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} />
                    </label>
                ) : null}
                {kind === 'credit' ? (
                    <>
                        <label>
                            Limite
                            <input type="number" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} />
                        </label>
                        <label>
                            Dia de vencimento
                            <input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
                        </label>
                    </>
                ) : null}
                {kind !== 'bank' ? (
                    <label>
                        Conta vinculada
                        <select value={linkedAccountId} onChange={(e) => setLinkedAccountId(e.target.value)} required>
                            <option value="">Selecione…</option>
                            {sortedBankAccounts(accounts).map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.name}
                                </option>
                            ))}
                        </select>
                    </label>
                ) : null}
                {error ? <p role="alert">{error}</p> : null}
                <footer className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn-primary" disabled={busy}>
                        {busy ? 'Salvando…' : 'Salvar'}
                    </button>
                </footer>
            </form>
        </ModalShell>
    );
}

function motionWizardKind({
    kind,
    setKind
}: {
    kind: 'bank' | 'credit' | 'debit';
    setKind: (k: 'bank' | 'credit' | 'debit') => void;
}) {
    return (
        <div className="chart-type-toggle" role="group" aria-label="Tipo de conta">
            {(['bank', 'credit', 'debit'] as const).map((k) => (
                <button key={k} type="button" className={`chart-type-btn${kind === k ? ' is-active' : ''}`} onClick={() => setKind(k)}>
                    {k === 'bank' ? 'Conta' : k === 'credit' ? 'Crédito' : 'Débito'}
                </button>
            ))}
        </div>
    );
}

function isCardLike(type: string) {
    const t = type.toLowerCase();
    return t.includes('debito') || t.includes('débito') || t.includes('beneficio');
}