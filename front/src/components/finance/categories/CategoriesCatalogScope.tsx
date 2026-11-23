import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import type { CategoryKind } from './types';
import { ManageCategoriesModal } from './ManageCategoriesModal';
import { CategoryFormDialog } from './CategoryFormDialog';
import { SubcategoryFormDialog } from './SubcategoryFormDialog';

type CategoryFormState = {
    editingId?: string;
    name?: string;
    type: 'GAIN' | 'EXPENSE';
    lockType?: boolean;
    onSaved?: (name: string) => void;
};

type SubcategoryFormState = {
    categoryId: string;
    categoryName: string;
    editingId?: string;
    name?: string;
    onSaved?: (name: string) => void;
};

type CatalogScopeValue = {
    openManage: () => void;
    openNewCategory: (opts?: { onSaved?: (name: string) => void }) => void;
    openNewSubcategory: (
        categoryId: string,
        categoryName: string,
        opts?: { onSaved?: (name: string) => void }
    ) => void;
};

const CatalogScopeContext = createContext<CatalogScopeValue | null>(null);

export function useCategoriesCatalogScope() {
    const ctx = useContext(CatalogScopeContext);
    if (!ctx) {
        throw new Error('useCategoriesCatalogScope must be used inside CategoriesCatalogScope');
    }
    return ctx;
}

type Props = {
    kind: CategoryKind;
    onRefresh: () => void | Promise<void>;
    children: ReactNode;
};

export function CategoriesCatalogScope({ kind, onRefresh, children }: Props) {
    const [manageOpen, setManageOpen] = useState(false);
    const [categoryForm, setCategoryForm] = useState<CategoryFormState | null>(null);
    const [subcategoryForm, setSubcategoryForm] = useState<SubcategoryFormState | null>(null);

    const defaultType = kind === 'gain' ? 'GAIN' : 'EXPENSE';

    const afterMutation = useCallback(async () => {
        await onRefresh();
    }, [onRefresh]);

    const api = useMemo<CatalogScopeValue>(
        () => ({
            openManage: () => setManageOpen(true),
            openNewCategory: (opts) =>
                setCategoryForm({
                    type: defaultType,
                    lockType: true,
                    onSaved: opts?.onSaved
                }),
            openNewSubcategory: (categoryId, categoryName, opts) =>
                setSubcategoryForm({
                    categoryId,
                    categoryName,
                    onSaved: opts?.onSaved
                })
        }),
        [defaultType]
    );

    return (
        <CatalogScopeContext.Provider value={api}>
            {children}
            <ManageCategoriesModal
                open={manageOpen}
                onClose={() => setManageOpen(false)}
                onRefresh={afterMutation}
                onEditCategory={(id, name, type) =>
                    setCategoryForm({ editingId: id, name, type, lockType: false })
                }
                onEditSubcategory={(subId, subName, categoryId, categoryName) =>
                    setSubcategoryForm({
                        editingId: subId,
                        name: subName,
                        categoryId,
                        categoryName
                    })
                }
                onNewCategory={() => setCategoryForm({ type: defaultType, lockType: false })}
            />
            {categoryForm ? (
                <CategoryFormDialog
                    open
                    editingId={categoryForm.editingId}
                    initialName={categoryForm.name ?? ''}
                    type={categoryForm.type}
                    lockType={categoryForm.lockType}
                    onClose={() => setCategoryForm(null)}
                    onSaved={async (name) => {
                        await afterMutation();
                        categoryForm.onSaved?.(name);
                        setCategoryForm(null);
                    }}
                />
            ) : null}
            {subcategoryForm ? (
                <SubcategoryFormDialog
                    open
                    categoryId={subcategoryForm.categoryId}
                    categoryName={subcategoryForm.categoryName}
                    editingId={subcategoryForm.editingId}
                    initialName={subcategoryForm.name ?? ''}
                    onClose={() => setSubcategoryForm(null)}
                    onSaved={async (name) => {
                        await afterMutation();
                        subcategoryForm.onSaved?.(name);
                        setSubcategoryForm(null);
                    }}
                />
            ) : null}
        </CatalogScopeContext.Provider>
    );
}