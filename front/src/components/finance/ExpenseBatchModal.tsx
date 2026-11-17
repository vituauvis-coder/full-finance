import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useCategories } from '../../hooks/useCategories';
import { buildPaymentMethodOptions } from '../../lib/accounts';
import type { Account } from '../../lib/types/finance';
import { patchExpensesBatch } from '../../frentes/dinheiro/api/movements';
import { ModalShell } from './ModalShell';

type Props = {
    open: boolean;
    count: number;
    ids: string[];
    accounts: Account[];
    onClose: () => void;
    onSaved: () => void | Promise<void>;
};

export function ExpenseBatchModal({ open, count, ids, accounts, onClose, onSaved }: Props) {
    const { categories } = useCategories('expense');
    const paymentOptions = useMemo(() => buildPaymentMethodOptions(accounts), [accounts]);
    const [accountId, setAccountId] = useState('');
    const [category, setCategory] = useState('');
    const [subcategory, setSubcategory] = useState('');
    const [isFixed, setIsFixed] = useState('');
    const [isPaid, setIsPaid] = useState('');
    const [isCofrinho, setIsCofrinho] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const subs = useMemo(() => categories.find((c) => c.name === category)?.subcategories ?? [], [categories, category]);

    useEffect(() => {
        if (!open) return;
        setAccountId('');
        setCategory('');
        setSubcategory('');
        setIsFixed('');
        setIsPaid('');
        setIsCofrinho('');
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
        if (isFixed === '1' || isFixed === '0') patch.isFixed = isFixed === '1';
        if (isPaid === '1' || isPaid === '0') patch.isPaid = isPaid === '1';
        if (isCofrinho === '1' || isCofrinho === '0') patch.isCofrinho = isCofrinho === '1';
        if (Object.keys(patch).length === 0) {
            setError('Altere pelo menos um campo.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            await patchExpensesBatch(ids, patch);
            await onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao atualizar saídas.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <ModalShell id="expense-batch-modal" open={open} title="Editar saídas em lote" onClose={onClose}>
            <p id="expense-batch-modal-summary" className="card-metric-hint">
                {count} saída(s) selecionada(s). Campos em branco não serão alterados.
            </p>
            <form id="expense-batch-form" onSubmit={(e) => void onSubmit(e)}>
                <div className="form-field">
                    <label htmlFor="expense-batch-account">Conta / cartão</label>
                    <select id="expense-batch-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                        <option value="">— não alterar —</option>
                        {paymentOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-field">
                    <label htmlFor="expense-batch-category">Categoria</label>
                    <select id="expense-batch-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option value="">— não alterar —</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.name}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-field">
                    <label htmlFor="expense-batch-subcategory">Subcategoria</label>
                    <select
                        id="expense-batch-subcategory"
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
                    <label htmlFor="expense-batch-fixed">Essencial</label>
                    <select id="expense-batch-fixed" value={isFixed} onChange={(e) => setIsFixed(e.target.value)}>
                        <option value="">— não alterar —</option>
                        <option value="1">Sim</option>
                        <option value="0">Não</option>
                    </select>
                </div>
                <div className="form-field">
                    <label htmlFor="expense-batch-paid">Pago</label>
                    <select id="expense-batch-paid" value={isPaid} onChange={(e) => setIsPaid(e.target.value)}>
                        <option value="">— não alterar —</option>
                        <option value="1">Sim</option>
                        <option value="0">Pendente</option>
                    </select>
                </div>
                <div className="form-field">
                    <label htmlFor="expense-batch-cofrinho">Cofrinho</label>
                    <select id="expense-batch-cofrinho" value={isCofrinho} onChange={(e) => setIsCofrinho(e.target.value)}>
                        <option value="">— não alterar —</option>
                        <option value="1">Sim</option>
                        <option value="0">Não</option>
                    </select>
                </div>
                {error ? (
                    <p role="alert" className="form-error">
                        {error}
                    </p>
                ) : null}
                <div className="modal-actions">
                    <button type="button" id="expense-batch-cancel-btn" className="btn-secondary" onClick={onClose}>
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