import { type FormEvent, useEffect, useState } from 'react';
import { DialogForm, DialogFrame } from '../../ui/dialog';
import { FormActions, FormAlert, FormField, FormInput } from '../../ui/form';
import { createSubcategory, updateSubcategory } from '../../../lib/categoriesApi';

type Props = {
    open: boolean;
    categoryId: string;
    categoryName: string;
    editingId?: string;
    initialName?: string;
    onClose: () => void;
    onSaved: (name: string) => void | Promise<void>;
};

export function SubcategoryFormDialog({
    open,
    categoryId,
    categoryName,
    editingId,
    initialName = '',
    onClose,
    onSaved
}: Props) {
    const [name, setName] = useState(initialName);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setName(initialName);
        setError(null);
    }, [open, initialName, editingId]);

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            setError('Digite um nome para a subcategoria');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            if (editingId) {
                await updateSubcategory(editingId, trimmed);
            } else {
                await createSubcategory(categoryId, trimmed);
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
            title={editingId ? 'Editar subcategoria' : 'Nova subcategoria'}
            size="sm"
            id="subcategory-form-dialog"
            panelClassName="category-catalog-dialog"
        >
            <DialogForm onSubmit={(e) => void onSubmit(e)}>
                <FormAlert message={error} />
                <FormField id="subcategory-form-parent" label="Categoria">
                    <FormInput id="subcategory-form-parent" value={categoryName} readOnly disabled />
                </FormField>
                <FormField id="subcategory-form-name" label="Nome">
                    <FormInput
                        id="subcategory-form-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={80}
                        placeholder="Ex.: Restaurante"
                        required
                        autoFocus
                    />
                </FormField>
                <FormActions onCancel={onClose} submitLabel="Salvar" busy={busy} cancelLabel="Cancelar" />
            </DialogForm>
        </DialogFrame>
    );
}