import { type ChangeEvent, type ReactNode, useMemo } from 'react';
import { FormField, FormSelect } from '../../ui/form';
import type { CategoryRow } from '../../../hooks/useCategories';
import { useCategoriesCatalogScope } from './CategoriesCatalogScope';
import {
    SUBCATEGORY_BATCH_CLEAR,
    SUBCATEGORY_CATALOG_ADD,
    SUBCATEGORY_CATALOG_MANAGE
} from './categoryCatalogConstants';

type Props = {
    id: string;
    label?: string;
    parentCategoryName: string;
    value: string;
    onChange: (name: string) => void;
    categories: CategoryRow[];
    disabled?: boolean;
    placeholder?: string;
    leadingOptions?: ReactNode;
    allowCatalog?: boolean;
    includeBatchClear?: boolean;
};

export function SubcategoryCatalogSelect({
    id,
    label = 'Subcategoria',
    parentCategoryName,
    value,
    onChange,
    categories,
    disabled,
    placeholder = '—',
    leadingOptions,
    allowCatalog = true,
    includeBatchClear = false
}: Props) {
    const catalog = useCategoriesCatalogScope();
    const parent = useMemo(
        () => categories.find((c) => c.name === parentCategoryName) ?? null,
        [categories, parentCategoryName]
    );
    const subs = useMemo(() => {
        const list = parent?.subcategories ?? [];
        return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }, [parent]);

    const blocked = disabled || !parentCategoryName;
    const hasValue = value && subs.some((s) => s.name === value);

    function handleChange(e: ChangeEvent<HTMLSelectElement>) {
        const v = e.target.value;
        if (v === SUBCATEGORY_CATALOG_MANAGE) {
            catalog.openManage();
            return;
        }
        if (v === SUBCATEGORY_CATALOG_ADD) {
            if (!parent) return;
            catalog.openNewSubcategory(parent.id, parent.name, { onSaved: (name) => onChange(name) });
            return;
        }
        if (v === SUBCATEGORY_BATCH_CLEAR) {
            onChange(v);
            return;
        }
        onChange(v);
    }

    const emptyLabel = !parentCategoryName ? 'Selecione uma categoria primeiro' : placeholder;

    return (
        <FormField id={id} label={label}>
            <FormSelect id={id} value={value} onChange={handleChange} disabled={blocked}>
                <option value="">{emptyLabel}</option>
                {leadingOptions}
                {includeBatchClear ? <option value={SUBCATEGORY_BATCH_CLEAR}>Limpar subcategoria</option> : null}
                {value && !hasValue && value !== SUBCATEGORY_BATCH_CLEAR ? (
                    <option value={value}>{value}</option>
                ) : null}
                {subs.map((s) => (
                    <option key={s.id} value={s.name}>
                        {s.name}
                    </option>
                ))}
                {allowCatalog && parent ? (
                    <>
                        <option value="" disabled>
                            ─────────
                        </option>
                        <option value={SUBCATEGORY_CATALOG_MANAGE}>Gerenciar subcategorias…</option>
                        <option value={SUBCATEGORY_CATALOG_ADD}>Adicionar nova subcategoria…</option>
                    </>
                ) : null}
            </FormSelect>
        </FormField>
    );
}