import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useCategories } from '../../hooks/useCategories';
import type { Account } from '../../lib/types/finance';
import { buildAccountSelectOptions } from '../../lib/accountSelectOptions';
import { patchGainsBatch } from '../../frentes/dinheiro/api/movements';
import { DialogForm, DialogFrame } from '../ui/dialog';
import { FormActions, FormAlert, FormField, FormSelect } from '../ui/form';
import {
    CategoriesCatalogScope,
    CategoryCatalogSelect,
    SubcategoryCatalogSelect,
    SUBCATEGORY_BATCH_CLEAR
} from './categories';

type Props = {
    open: boolean;
    count: number;
    ids: string[];
    accounts: Account[];
    onClose: () => void;
    onSaved: () => void | Promise<void>;
};

export function GainBatchModal({ open, count, ids, accounts, onClose, onSaved }: Props) {
    const { categories, refresh: refreshCategories } = useCategories('gain');
    const [accountId, setAccountId] = useState('');
    const [category, setCategory] = useState('');
    const [subcategory, setSubcategory] = useState('');
    const [received, setReceived] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

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
        if (subcategory === SUBCATEGORY_BATCH_CLEAR) patch.subcategory = null;
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
            <CategoriesCatalogScope kind="gain" onRefresh={refreshCategories}>
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
                <CategoryCatalogSelect
                    id="gain-batch-category"
                    value={category}
                    categories={categories}
                    placeholder="— não alterar —"
                    onChange={(v) => {
                        setCategory(v);
                        setSubcategory('');
                    }}
                />
                <SubcategoryCatalogSelect
                    id="gain-batch-subcategory"
                    parentCategoryName={category}
                    value={subcategory}
                    categories={categories}
                    placeholder="— não alterar —"
                    includeBatchClear
                    onChange={setSubcategory}
                />
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
            </CategoriesCatalogScope>
        </DialogFrame>
    );
}