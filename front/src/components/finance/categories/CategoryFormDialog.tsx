import { type FormEvent, useEffect, useState } from 'react';
import { DialogForm, DialogFrame } from '../../ui/dialog';
import { FormActions, FormAlert, FormField, FormInput, FormSelect } from '../../ui/form';
import { createCategory, updateCategory } from '../../../lib/categoriesApi';

type Props = {
    open: boolean;
    editingId?: string;
    initialName?: string;
    type: 'GAIN' | 'EXPENSE';
    lockType?: boolean;
    onClose: () => void;
    onSaved: (name: string) => void | Promise<void>;
};

export function CategoryFormDialog({
    open,
    editingId,
    initialName = '',
    type: initialType,
    lockType,
    onClose,
    onSaved
}: Props) {
    const [name, setName] = useState(initialName);
    const [type, setType] = useState<'GAIN' | 'EXPENSE'>(initialType);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setName(initialName);
        setType(initialType);
        setError(null);
    }, [open, initialName, initialType, editingId]);

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            setError('Digite um nome para a categoria');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            if (editingId) {
                await updateCategory(editingId, trimmed, type);
            } else {
                await createCategory(trimmed, type);
            }
            await onSaved(trimmed);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível salvar');
        } finally {
            setBusy(false);
        }
    }

    return (
        <DialogFrame
            open={open}
            onClose={onClose}
            title={editingId ? 'Editar categoria' : 'Nova categoria'}
            size="sm"
            id="category-form-dialog"
            panelClassName="category-catalog-dialog"
        >
            <DialogForm onSubmit={(e) => void onSubmit(e)}>
                <FormAlert message={error} />
                <FormField id="category-form-name" label="Nome">
                    <FormInput
                        id="category-form-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={80}
                        placeholder="Ex.: Alimentação"
                        required
                        autoFocus
                    />
                </FormField>
                <FormField id="category-form-type" label="Tipo">
                    <FormSelect
                        id="category-form-type"
                        value={type}
                        disabled={Boolean(lockType)}
                        onChange={(e) => setType(e.target.value === 'GAIN' ? 'GAIN' : 'EXPENSE')}
                    >
                        <option value="EXPENSE">Saída</option>
                        <option value="GAIN">Entrada</option>
                    </FormSelect>
                </FormField>
                <FormActions onCancel={onClose} submitLabel="Salvar" busy={busy} cancelLabel="Cancelar" />
            </DialogForm>
        </DialogFrame>
    );
}