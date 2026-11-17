import { type FormEvent, useEffect, useState } from 'react';
import type { Account, Movement } from '../../lib/types/finance';
import { useCategories } from '../../hooks/useCategories';
import { sortedBankAccounts } from '../../lib/accounts';
import { ModalShell } from './ModalShell';
import {
    createGain,
    movementFromFormDate,
    updateGain,
    type GainFormPayload
} from '../../frentes/dinheiro/api/movements';

type Props = {
    open: boolean;
    editing: Movement | null;
    accounts: Account[];
    onClose: () => void;
    onSaved: () => void | Promise<void>;
};

export function GainFormModal({ open, editing, accounts, onClose, onSaved }: Props) {
    const { categories } = useCategories('gain');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [accountId, setAccountId] = useState('');
    const [category, setCategory] = useState('');
    const [subcategory, setSubcategory] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [isPaid, setIsPaid] = useState(true);
    const [recurring, setRecurring] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setError(null);
        if (editing) {
            setDescription(editing.description ?? '');
            setAmount(String(editing.amount ?? ''));
            setAccountId(editing.accountId ?? '');
            setCategory(editing.category ?? '');
            setSubcategory(editing.subcategory ?? '');
            setDate(movementFromFormDate(editing));
            setIsPaid(editing.isPaid !== false);
            setRecurring(false);
        } else {
            setDescription('');
            setAmount('');
            const banks = sortedBankAccounts(accounts);
            setAccountId(banks[0]?.id ?? '');
            setCategory('');
            setSubcategory('');
            setDate(new Date().toISOString().slice(0, 10));
            setIsPaid(true);
            setRecurring(false);
        }
    }, [open, editing, accounts]);

    const subs = categories.find((c) => c.name === category)?.subcategories ?? [];

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        const payload: GainFormPayload = {
            description: description.trim(),
            amount: parseFloat(amount),
            accountId,
            category,
            subcategory: subcategory || null,
            date,
            isPaid,
            isRecurring: !editing && recurring
        };
        if (!payload.description || !payload.category || !payload.accountId) {
            setError('Preencha descrição, categoria e conta.');
            return;
        }
        if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
            setError('Valor inválido.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            if (editing) await updateGain(editing.id, payload);
            else await createGain(payload);
            await onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    }

    return (
        <ModalShell id="gain-modal" open={open} title={editing ? 'Editar entrada' : 'Nova entrada'} onClose={onClose}>
            <form className="modal-body" onSubmit={(e) => void onSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {error ? <p role="alert">{error}</p> : null}
                <div className="form-group">
                    <label htmlFor="gain-category-select">Categoria</label>
                    <select id="gain-category-select" value={category} onChange={(e) => setCategory(e.target.value)} required>
                        <option value="">Selecione…</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.name}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="gain-subcategory-select">Subcategoria</label>
                    <select id="gain-subcategory-select" value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
                        <option value="">—</option>
                        {subs.map((s) => (
                            <option key={s.id} value={s.name}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="gain-description">Descrição</label>
                    <input id="gain-description" value={description} onChange={(e) => setDescription(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label htmlFor="gain-amount">Valor</label>
                    <input id="gain-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label htmlFor="gain-account">Conta</label>
                    <select id="gain-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                        <option value="">Selecione…</option>
                        {sortedBankAccounts(accounts).map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="gain-date">Data</label>
                    <input id="gain-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                {!editing ? (
                    <div className="form-group form-group--checkbox">
                        <label>
                            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} /> Repetir até dezembro
                        </label>
                    </div>
                ) : null}
                <div className="form-group form-group--checkbox" id="gain-is-received-row">
                    <label>
                        <input id="gain-is-received" type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} /> Recebido
                    </label>
                </div>
                <footer className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? 'Salvando…' : 'Salvar'}
                    </button>
                </footer>
            </form>
        </ModalShell>
    );
}