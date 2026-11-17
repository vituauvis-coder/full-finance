import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useCategories } from '../../hooks/useCategories';
import type { Account } from '../../lib/types/finance';
import { patchGainsBatch } from '../../frentes/dinheiro/api/movements';
import { ModalShell } from './ModalShell';

type Props = {
    open: boolean;
    count: number;
    ids: string[];
    accounts: Account[];
    onClose: () => void;
    onSaved: () => void | Promise<void>;
};

export function GainBatchModal({ open, count, ids, accounts, onClose, onSaved }: Props) {
    const { categories } = useCategories('gain');
    const [accountId, setAccountId] = useState('');
    const [category, setCategory] = useState('');
    const [subcategory, setSubcategory] = useState('');
    const [received, setReceived] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const subs = useMemo(() => categories.find((c) => c.name === category)?.subcategories ?? [], [categories, category]);

    useEffect(() => {
        if (!open) return;
        setAccountId('');
        setCategory('');
        setSubcategory('');
        setReceived('');
        setError('');
    }, [open]);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        const patch: Record<string, unknown> = {};
        if (accountId) patch.accountId = accountId;
        if (category) patch.category = category;
        if (subcategory === '__clear__') patch.subcategory = null;
        else if (subcategory) {
            if (!category) {
                setError('Selecione a categoria antes de escolher subcategoria.');
                return;
            }
            patch.subcategory = subcategory;
        }
        if (received === '1' || received === '0') patch.isPaid = received === '1';
        if (Object.keys(patch).length === 0) {
            setError('Altere pelo menos um campo.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            await patchGainsBatch(ids, patch);
            await onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao atualizar entradas.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <ModalShell id="gain-batch-modal" open={open} title="Editar entradas em lote" onClose={onClose}>
            <p id="gain-batch-modal-summary" className="card-metric-hint">
                {count} entrada(s) selecionada(s). Campos em branco não serão alterados.
            </p>
            <form id="gain-batch-form" onSubmit={(e) => void onSubmit(e)}>
                <div className="form-field">
                    <label htmlFor="gain-batch-account">Conta</label>
                    <select id="gain-batch-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                        <option value="">— não alterar —</option>
                        {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-field">
                    <label htmlFor="gain-batch-category">Categoria</label>
                    <select id="gain-batch-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option value="">— não alterar —</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.name}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-field">
                    <label htmlFor="gain-batch-subcategory">Subcategoria</label>
                    <select
                        id="gain-batch-subcategory"
                        value={subcategory}
                        onChange={(e) => setSubcategory(e.target.value)}
                    >
                        <option value="">— não alterar —</option>
                        <option value="__clear__">Limpar subcategoria</option>
                        {subs.map((s) => (
                            <option key={s.id} value={s.name}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-field">
                    <label htmlFor="gain-batch-received">Recebido</label>
                    <select id="gain-batch-received" value={received} onChange={(e) => setReceived(e.target.value)}>
                        <option value="">— não alterar —</option>
                        <option value="1">Sim</option>
                        <option value="0">Não (pendente)</option>
                    </select>
                </div>
                {error ? (
                    <p role="alert" className="form-error">
                        {error}
                    </p>
                ) : null}
                <div className="modal-actions">
                    <button type="button" id="gain-batch-cancel-btn" className="btn-secondary" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn-primary" disabled={busy}>
                        {busy ? 'Salvando…' : 'Aplicar'}
                    </button>
                </div>
            </form>
        </ModalShell>
    );
}