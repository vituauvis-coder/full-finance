import { type ChangeEvent, type ReactNode, useMemo } from 'react';
import { FormField, FormSelect } from '../../ui/form';
import type { CategoryRow } from '../../../hooks/useCategories';
import { useCategoriesCatalogScope } from './CategoriesCatalogScope';
import {
    CATEGORY_CATALOG_ADD,
    CATEGORY_CATALOG_MANAGE
} from './categoryCatalogConstants';

type Props = {
    id: string;
    label?: string;
    value: string;
    onChange: (name: string) => void;
    categories: CategoryRow[];
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    leadingOptions?: ReactNode;
    allowCatalog?: boolean;
    /** Só o &lt;select&gt;, sem FormField (ex.: planejamento legado). */
    variant?: 'field' | 'control';
};

function sortByName(list: CategoryRow[]) {
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function CategoryCatalogSelect({
    id,
    label = 'Categoria',
    value,
    onChange,
    categories,
    required,
    disabled,
    placeholder = 'Selecione…',
    leadingOptions,
    allowCatalog = true,
    variant = 'field'
}: Props) {
    const catalog = useCategoriesCatalogScope();
    const sorted = useMemo(() => sortByName(categories), [categories]);

    const hasValue = value && sorted.some((c) => c.name === value);

    function handleChange(e: ChangeEvent<HTMLSelectElement>) {
        const v = e.target.value;
        if (v === CATEGORY_CATALOG_MANAGE) {
            catalog.openManage();
            return;
        }
        if (v === CATEGORY_CATALOG_ADD) {
            catalog.openNewCategory({ onSaved: (name) => onChange(name) });
            return;
        }
        onChange(v);
    }

    const select = (
        <FormSelect id={id} value={value} onChange={handleChange} required={required} disabled={disabled}>
            <option value="">{placeholder}</option>
            {leadingOptions}
            {value && !hasValue ? (
                <option value={value}>{value}</option>
            ) : null}
            {sorted.map((c) => (
                <option key={c.id} value={c.name}>
                    {c.name}
                </option>
            ))}
            {allowCatalog ? (
                <>
                    <option value="" disabled>
                        ─────────
                    </option>
                    <option value={CATEGORY_CATALOG_MANAGE}>Gerenciar categorias…</option>
                    <option value={CATEGORY_CATALOG_ADD}>Adicionar nova categoria…</option>
                </>
            ) : null}
        </FormSelect>
    );

    if (variant === 'control') return select;

    return (
        <FormField id={id} label={label}>
            {select}
        </FormField>
    );
}