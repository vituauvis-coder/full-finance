import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/http';
import { formatBRL } from '../../../lib/format';
import type { ZeroBudgetBlock, ZeroBudgetTodo } from '../domain/zeroBudgetTypes';
import { blockCategoryName } from '../domain/zeroBudgetPlanning';
import { ZeroBudgetLegacyModal } from './ZeroBudgetLegacyModal';
import { ScreenLoader } from '../../../components/ui/ScreenLoader';
import { DeleteIcon } from '../../../components/icons/DeleteIcon';

type Props = {
    open: boolean;
    block: ZeroBudgetBlock | null;
    currency: string;
    onClose: () => void;
};

function roundMoney2(n: number) {
    return Math.round(n * 100) / 100;
}

export function ZeroBudgetBlockTodosModal({ open, block, currency, onClose }: Props) {
    const [todos, setTodos] = useState<ZeroBudgetTodo[]>([]);
    const [loading, setLoading] = useState(false);
    const blockId = block?.id ?? null;

    const load = useCallback(async () => {
        if (!blockId) return;
        setLoading(true);
        try {
            const rows = await apiFetch<ZeroBudgetTodo[]>(
                `/api/zero-budget/blocks/${encodeURIComponent(blockId)}/todos`
            );
            setTodos(Array.isArray(rows) ? rows : []);
        } catch {
            setTodos([]);
        } finally {
            setLoading(false);
        }
    }, [blockId]);

    useEffect(() => {
        if (open && blockId) void load();
    }, [open, blockId, load]);

    const total = useMemo(() => todos.reduce((s, t) => s + (Number(t.amount) || 0), 0), [todos]);
    const heading = block ? blockCategoryName(block) || 'Meta' : 'Meta';

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!blockId) return;
        const fd = new FormData(e.currentTarget);
        const title = String(fd.get('title') ?? '').trim();
        if (!title) return;
        const amount = roundMoney2(parseFloat(String(fd.get('amount') ?? '')) || 0);
        await apiFetch(`/api/zero-budget/blocks/${encodeURIComponent(blockId)}/todos`, {
            method: 'POST',
            body: JSON.stringify({ title, amount })
        });
        e.currentTarget.reset();
        await load();
    }

    return (
        <ZeroBudgetLegacyModal
            open={open}
            onClose={onClose}
            id="zb-block-todos-overlay"
            contentClassName="modal-content--zero-budget modal-content--zb-todos"
            labelledBy="zb-todos-panel-title"
        >
            <button type="button" className="modal-close-btn" data-zb-todos-close aria-label="Fechar" onClick={onClose}>
                &times;
            </button>
            <h3 id="zb-todos-panel-title">
                <span>{heading}</span>
            </h3>
            <div className="zb-todos-modal__body">
                {loading ? (
                    <ScreenLoader variant="inline" label="Carregando lista" />
                ) : (
                    <ul className="zb-todos-modal__list">
                        {todos.length === 0 ? (
                            <li className="zb-todos-modal__empty">
                                Nenhum item ainda. Use o formulário abaixo para adicionar.
                            </li>
                        ) : (
                            todos.map((t) => {
                                const bought = Boolean(t.isPurchased);
                                const amt = roundMoney2(Number(t.amount) || 0);
                                return (
                                    <li
                                        key={t.id}
                                        className={`zb-todos-modal__item${bought ? ' is-purchased' : ''}`}
                                        data-zb-todo-purchased={bought ? '1' : '0'}
                                    >
                                        <button
                                            type="button"
                                            className="zb-todos-modal__item-toggle"
                                            style={{ all: 'unset', display: 'contents', cursor: 'pointer' }}
                                            onClick={() =>
                                                void (async () => {
                                                    await apiFetch(`/api/zero-budget/todos/${encodeURIComponent(t.id)}`, {
                                                        method: 'PATCH',
                                                        body: JSON.stringify({ isPurchased: !bought })
                                                    });
                                                    await load();
                                                })()
                                            }
                                        >
                                            <span className="zb-todos-modal__check" aria-hidden="true">
                                                <i className={`fas ${bought ? 'fa-check-circle' : 'fa-circle'}`}></i>
                                            </span>
                                            <span className="zb-todos-modal__item-title">{t.title}</span>
                                        </button>
                                        <input
                                            type="number"
                                            className="zb-todos-modal__item-amount"
                                            min={0}
                                            step={0.01}
                                            value={amt}
                                            aria-label="Valor estimado do item"
                                            onChange={(e) =>
                                                void (async () => {
                                                    const v = roundMoney2(parseFloat(e.target.value) || 0);
                                                    await apiFetch(`/api/zero-budget/todos/${encodeURIComponent(t.id)}`, {
                                                        method: 'PATCH',
                                                        body: JSON.stringify({ amount: v })
                                                    });
                                                    await load();
                                                })()
                                            }
                                        />
                                        <button
                                            type="button"
                                            className="zb-todos-modal__remove"
                                            aria-label="Remover item"
                                            onClick={() => {
                                                if (!window.confirm('Remover este item da lista?')) return;
                                                void (async () => {
                                                    await apiFetch(`/api/zero-budget/todos/${encodeURIComponent(t.id)}`, {
                                                        method: 'DELETE'
                                                    });
                                                    await load();
                                                })();
                                            }}
                                        >
                                            <DeleteIcon size="sm" />
                                        </button>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                )}
                <div className="zb-todos-modal__total-row">
                    <span className="zb-todos-modal__total-label">Total da lista</span>
                    <strong className="zb-todos-modal__total-value">{formatBRL(total, currency)}</strong>
                </div>
            </div>
            <form className="zero-budget-modal__form" onSubmit={(e) => void onSubmit(e)}>
                <div className="zb-todos-modal__new-grid">
                    <div className="zb-todos-modal__field zb-todos-modal__field--title">
                        <label htmlFor="zb-todos-title-input" className="zero-budget-modal__field-label">
                            Novo item
                        </label>
                        <input
                            id="zb-todos-title-input"
                            type="text"
                            name="title"
                            className="zero-budget-modal__text-input"
                            maxLength={500}
                            placeholder="Ex.: presente, assinatura, equipamento…"
                            autoComplete="off"
                            required
                        />
                    </div>
                    <div className="zb-todos-modal__field zb-todos-modal__field--amount">
                        <label htmlFor="zb-todos-amount-input" className="zero-budget-modal__field-label">
                            Valor
                        </label>
                        <input
                            id="zb-todos-amount-input"
                            type="number"
                            name="amount"
                            className="zero-budget-modal__text-input"
                            min={0}
                            step={0.01}
                            placeholder="0"
                            inputMode="decimal"
                            aria-label="Valor estimado (opcional)"
                        />
                    </div>
                </div>
                <div className="form-actions">
                    <button type="button" className="btn-secondary" data-zb-todos-close onClick={onClose}>
                        Fechar
                    </button>
                    <button type="submit" className="btn-primary">
                        <span>Adicionar</span>
                    </button>
                </div>
            </form>
        </ZeroBudgetLegacyModal>
    );
}