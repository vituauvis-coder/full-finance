import { type FormEvent, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/http';
import { useCategories } from '../../../hooks/useCategories';
import type { Movement } from '../../../lib/types/finance';
import { collectExpenseCategoryNames, blockCategoryName } from '../domain/zeroBudgetPlanning';
import type { ZeroBudgetBlock } from '../domain/zeroBudgetTypes';
import { ZeroBudgetLegacyModal } from './ZeroBudgetLegacyModal';
import { CategoriesCatalogScope, CategoryCatalogSelect } from '../../../components/finance/categories';

type Props = {
    open: boolean;
    onClose: () => void;
    month: number;
    year: number;
    blocks: ZeroBudgetBlock[];
    expenses: Movement[];
    onCreated: () => void | Promise<void>;
};

export function ZeroBudgetCreateBlockModal({ open, onClose, month, year, blocks, expenses, onCreated }: Props) {
    const { categories, loading, refresh: refreshCategories } = useCategories('expense');
    const [categoryName, setCategoryName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const allNames = useMemo(
        () => collectExpenseCategoryNames(categories, expenses),
        [categories, expenses]
    );

    const available = useMemo(() => {
        const used = new Set(blocks.map((b) => blockCategoryName(b)).filter(Boolean));
        return allNames.filter((c) => !used.has(c));
    }, [allNames, blocks]);

    const selectableCategories = useMemo(() => {
        const allowed = new Set(available);
        if (categoryName) allowed.add(categoryName);
        return categories.filter((c) => allowed.has(c.name));
    }, [categories, available, categoryName]);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (!categoryName) {
            setError('Selecione uma categoria de saída');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await apiFetch('/api/zero-budget/blocks', {
                method: 'POST',
                body: JSON.stringify({
                    categoryName,
                    color: 'bg-amber-500',
                    allocatedAmount: 0,
                    month,
                    year
                })
            });
            setCategoryName('');
            await onCreated();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao criar bloco');
        } finally {
            setSaving(false);
        }
    }

    return (
        <ZeroBudgetLegacyModal
            open={open}
            onClose={onClose}
            id="react-zero-budget-block-modal"
            labelledBy="zero-budget-block-modal-title"
        >
            <button type="button" className="modal-close-btn" aria-label="Fechar" onClick={onClose}>
                &times;
            </button>
            <h3 id="zero-budget-block-modal-title">
                <i className="fas fa-plus-circle" aria-hidden="true"></i> Novo bloco
            </h3>
            <CategoriesCatalogScope kind="expense" onRefresh={refreshCategories}>
            <form id="zero-budget-block-form" className="zero-budget-modal__form" onSubmit={(e) => void onSubmit(e)}>
                <div className="zero-budget-modal__row zero-budget-modal__row--categories">
                    <label className="zero-budget-modal__field-label" htmlFor="zero-budget-block-category">
                        Categoria de saída
                    </label>
                    {selectableCategories.length === 0 && !loading ? (
                        <p className="zero-budget-modal__empty-cats">
                            Nenhuma categoria de saída disponível para este mês (todas já têm bloco).
                            Use «Adicionar nova categoria» abaixo ou gerencie o catálogo.
                        </p>
                    ) : (
                        <>
                            <div className="zero-budget-modal__category-select-row">
                                <CategoryCatalogSelect
                                    id="zero-budget-block-category"
                                    label="Categoria de saída"
                                    variant="control"
                                    value={categoryName}
                                    categories={selectableCategories}
                                    placeholder="Selecione a categoria"
                                    required
                                    disabled={loading}
                                    onChange={setCategoryName}
                                />
                            </div>
                            <small className="zero-budget-modal__hint">
                                Cada bloco corresponde a uma única categoria; o nome do card será o nome da categoria.
                            </small>
                        </>
                    )}
                </div>
                {error ? <p role="alert">{error}</p> : null}
                <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn-primary" disabled={saving || selectableCategories.length === 0}>
                        <span>{saving ? 'Criando…' : 'Criar bloco'}</span>
                    </button>
                </div>
            </form>
            </CategoriesCatalogScope>
        </ZeroBudgetLegacyModal>
    );
}