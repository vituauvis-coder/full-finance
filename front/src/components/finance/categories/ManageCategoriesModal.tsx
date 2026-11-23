import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogBody, DialogCloseButton, DialogHeader, DialogPanel, DialogTitle } from '../../ui/dialog';
import { categoryKindFromType, type CategoryRow } from '../../../hooks/useCategories';
import { deleteCategory, deleteSubcategory, fetchAllCategories } from '../../../lib/categoriesApi';
import { EditIcon } from '../../icons/EditIcon';
import { DeleteIcon } from '../../icons/DeleteIcon';
import { ScreenLoader } from '../../ui/ScreenLoader';
import { MaterialIcon } from '../../icons/MaterialIcon';

type Props = {
    open: boolean;
    onClose: () => void;
    onRefresh: () => void | Promise<void>;
    onEditCategory: (id: string, name: string, type: 'GAIN' | 'EXPENSE') => void;
    onEditSubcategory: (subId: string, subName: string, categoryId: string, categoryName: string) => void;
    onNewCategory: () => void;
};

function categoryTypeLabel(row: CategoryRow): 'GAIN' | 'EXPENSE' {
    return categoryKindFromType(row.type) === 'gain' ? 'GAIN' : 'EXPENSE';
}

export function ManageCategoriesModal({
    open,
    onClose,
    onRefresh,
    onEditCategory,
    onEditSubcategory,
    onNewCategory
}: Props) {
    const [categories, setCategories] = useState<CategoryRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const rows = await fetchAllCategories();
            setCategories(rows);
            await onRefresh();
        } catch (err) {
            setCategories([]);
            setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar categorias');
        } finally {
            setLoading(false);
        }
    }, [onRefresh]);

    useEffect(() => {
        if (!open) return;
        void reload();
    }, [open, reload]);

    async function removeCategory(id: string, name: string) {
        if (!window.confirm(`Excluir a categoria «${name}»?\n\nAs subcategorias também serão removidas.`)) return;
        setBusyId(id);
        try {
            await deleteCategory(id);
            await reload();
        } catch (err) {
            window.alert(err instanceof Error ? err.message : 'Erro ao excluir');
        } finally {
            setBusyId(null);
        }
    }

    async function removeSubcategory(id: string, name: string) {
        if (!window.confirm(`Excluir a subcategoria «${name}»?`)) return;
        setBusyId(id);
        try {
            await deleteSubcategory(id);
            await reload();
        } catch (err) {
            window.alert(err instanceof Error ? err.message : 'Erro ao excluir');
        } finally {
            setBusyId(null);
        }
    }

    return (
        <Dialog open={open} onClose={onClose} id="manage-categories-dialog">
            <DialogPanel size="md" className="fin-cat-manage-panel">
                <DialogHeader>
                    <DialogTitle>Gerenciar categorias</DialogTitle>
                    <DialogCloseButton />
                </DialogHeader>
                <DialogBody>
                    <div className="fin-cat-manage-panel__content">
                        {loading ? (
                            <ScreenLoader variant="inline" label="Carregando categorias" />
                        ) : loadError ? (
                            <p className="fin-cat-manage-panel__empty" role="alert">
                                {loadError}
                            </p>
                        ) : categories.length === 0 ? (
                            <p className="fin-cat-manage-panel__empty">Nenhuma categoria cadastrada.</p>
                        ) : (
                            <div className="fin-cat-manage-panel__list" role="list">
                                {categories.map((cat) => {
                                    const type = categoryTypeLabel(cat);
                                    const subs = cat.subcategories ?? [];
                                    const label = String(cat.name ?? '').trim() || 'Sem nome';
                                    return (
                                        <div key={cat.id} className="fin-cat-manage-row" role="listitem">
                                            <div className="fin-cat-manage-row__main">
                                                <p className="fin-cat-manage-row__name">{label}</p>
                                                <span
                                                    className={`fin-cat-manage-row__pill fin-cat-manage-row__pill--${type === 'GAIN' ? 'gain' : 'expense'}`}
                                                >
                                                    {type === 'GAIN' ? 'Entrada' : 'Saída'}
                                                </span>
                                            </div>
                                            <div className="fin-cat-manage-row__actions">
                                                <button
                                                    type="button"
                                                    className="fin-cat-manage-row__btn"
                                                    title="Editar categoria"
                                                    disabled={busyId === cat.id}
                                                    onClick={() => onEditCategory(cat.id, label, type)}
                                                >
                                                    <EditIcon size="sm" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="fin-cat-manage-row__btn fin-cat-manage-row__btn--danger"
                                                    title="Excluir categoria"
                                                    disabled={busyId === cat.id}
                                                    onClick={() => void removeCategory(cat.id, label)}
                                                >
                                                    <DeleteIcon size="sm" />
                                                </button>
                                            </div>
                                            {subs.length > 0 ? (
                                                <div className="fin-cat-manage-subs" role="list">
                                                    {subs.map((sub) => {
                                                        const subLabel = String(sub.name ?? '').trim() || 'Sem nome';
                                                        return (
                                                            <div key={sub.id} className="fin-cat-manage-sub" role="listitem">
                                                                <span className="fin-cat-manage-sub__name">{subLabel}</span>
                                                                <div className="fin-cat-manage-row__actions">
                                                                    <button
                                                                        type="button"
                                                                        className="fin-cat-manage-row__btn"
                                                                        title="Editar subcategoria"
                                                                        disabled={busyId === sub.id}
                                                                        onClick={() =>
                                                                            onEditSubcategory(sub.id, subLabel, cat.id, label)
                                                                        }
                                                                    >
                                                                        <EditIcon size="sm" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="fin-cat-manage-row__btn fin-cat-manage-row__btn--danger"
                                                                        title="Excluir subcategoria"
                                                                        disabled={busyId === sub.id}
                                                                        onClick={() => void removeSubcategory(sub.id, subLabel)}
                                                                    >
                                                                        <DeleteIcon size="sm" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <button type="button" className="fin-cat-manage-panel__add" onClick={onNewCategory}>
                            <MaterialIcon name="add" variant="app" />
                            Nova categoria
                        </button>
                    </div>
                </DialogBody>
            </DialogPanel>
        </Dialog>
    );
}