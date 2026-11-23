import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useCategories } from '../../hooks/useCategories';
import type { Account } from '../../lib/types/finance';
import { buildAccountSelectOptions } from '../../lib/accountSelectOptions';
import { patchGainsBatch } from '../../frentes/dinheiro/api/movements';
import { DialogForm, DialogFrame } from '../ui/dialog';
import { FormActions, FormAlert, FormField, FormSelect } from '../ui/form';

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
    const accountOptions = useMemo(() => buildAccountSelectOptions(accounts), [accounts]);

    useEffect(() => {
        if (!open) return;
        setAccountId('');
        setCategory('');
        setSubcategory('');
        setReceived('');
        setError('');
    }, [open]);

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
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
        <DialogFrame id="gain-batch-modal" open={open} title="Editar entradas em lote" onClose={onClose}>
            <p id="gain-batch-modal-summary" className="ui-form-hint-block">
                {count} entrada(s) selecionada(s). Campos em branco não serão alterados.
            </p>
            <DialogForm id="gain-batch-form" onSubmit={(e) => void onSubmit(e)}>
                <FormField id="gain-batch-account" label="Conta">
                    <FormSelect id="gain-batch-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                        <option value="">— não alterar —</option>
                        {accountOptions.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.label}
                            </option>
                        ))}
                    </FormSelect>
                </FormField>
                <FormField id="gain-batch-category" label="Categoria">
                    <FormSelect id="gain-batch-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option value="">— não alterar —</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.name}>
                                {c.name}
                            </option>
                        ))}
                    </FormSelect>
                </FormField>
                <FormField id="gain-batch-subcategory" label="Subcategoria">
                    <FormSelect
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
                    </FormSelect>
                </FormField>
                <FormField id="gain-batch-received" label="Recebido">
                    <FormSelect id="gain-batch-received" value={received} onChange={(e) => setReceived(e.target.value)}>
                        <option value="">— não alterar —</option>
                        <option value="1">Sim</option>
                        <option value="0">Não (pendente)</option>
                    </FormSelect>
                </FormField>
                <FormAlert message={error} />
                <FormActions onCancel={onClose} submitLabel="Aplicar" busy={busy} />
            </DialogForm>
        </DialogFrame>
    );
}