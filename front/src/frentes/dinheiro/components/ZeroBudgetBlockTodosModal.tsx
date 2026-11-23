import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/http';
import { formatBRL } from '../../../lib/format';
import type { ZeroBudgetBlock, ZeroBudgetTodo } from '../domain/zeroBudgetTypes';
import { blockCategoryName } from '../domain/zeroBudgetPlanning';
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogFooter,
    DialogForm,
    DialogHeader,
    DialogPanel,
    DialogTitle
} from '../../../components/ui/dialog';
import { FormActions, FormField, FormInput } from '../../../components/ui/form';
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

function TodoAmountInput({
    todoId,
    amount,
    onCommit
}: {
    todoId: string;
    amount: number;
    onCommit: (id: string, next: number) => Promise<void>;
}) {
    const [draft, setDraft] = useState(() => String(amount));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setDraft(String(amount));
    }, [amount, todoId]);

    async function commit() {
        const next = roundMoney2(parseFloat(draft.replace(',', '.')) || 0);
        if (next === amount) return;
        setSaving(true);
        try {
            await onCommit(todoId, next);
        } finally {
            setSaving(false);
        }
    }

    return (
        <input
            type="number"
            className="zb-todos-dialog__item-amount"
            min={0}
            step={0.01}
            value={draft}
            disabled={saving}
            aria-label="Valor estimado do item"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    void commit();
                    (e.target as HTMLInputElement).blur();
                }
            }}
        />
    );
}

export function ZeroBudgetBlockTodosModal({ open, block, currency, onClose }: Props) {
    const [todos, setTodos] = useState<ZeroBudgetTodo[]>([]);
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);
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
    const itemCountLabel = todos.length === 1 ? '1 item' : `${todos.length} itens`;

    const commitAmount = useCallback(async (todoId: string, amount: number) => {
        let snapshot: ZeroBudgetTodo[] | null = null;
        setTodos((list) => {
            snapshot = list;
            return list.map((row) => (row.id === todoId ? { ...row, amount } : row));
        });
        try {
            await apiFetch(`/api/zero-budget/todos/${encodeURIComponent(todoId)}`, {
                method: 'PATCH',
                body: JSON.stringify({ amount })
            });
        } catch {
            if (snapshot) setTodos(snapshot);
        }
    }, []);

    async function togglePurchased(t: ZeroBudgetTodo) {
        const next = !t.isPurchased;
        let snapshot: ZeroBudgetTodo[] | null = null;
        setTodos((list) => {
            snapshot = list;
            return list.map((row) => (row.id === t.id ? { ...row, isPurchased: next } : row));
        });
        try {
            await apiFetch(`/api/zero-budget/todos/${encodeURIComponent(t.id)}`, {
                method: 'PATCH',
                body: JSON.stringify({ isPurchased: next })
            });
        } catch {
            if (snapshot) setTodos(snapshot);
        }
    }

    async function removeTodo(t: ZeroBudgetTodo) {
        if (!window.confirm('Remover este item da lista?')) return;
        let snapshot: ZeroBudgetTodo[] | null = null;
        setTodos((list) => {
            snapshot = list;
            return list.filter((row) => row.id !== t.id);
        });
        try {
            await apiFetch(`/api/zero-budget/todos/${encodeURIComponent(t.id)}`, { method: 'DELETE' });
        } catch {
            if (snapshot) setTodos(snapshot);
        }
    }

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!blockId || adding) return;
        const fd = new FormData(e.currentTarget);
        const title = String(fd.get('title') ?? '').trim();
        if (!title) return;
        const amount = roundMoney2(parseFloat(String(fd.get('amount') ?? '')) || 0);
        setAdding(true);
        try {
            await apiFetch(`/api/zero-budget/blocks/${encodeURIComponent(blockId)}/todos`, {
                method: 'POST',
                body: JSON.stringify({ title, amount })
            });
            e.currentTarget.reset();
            await load();
        } finally {
            setAdding(false);
        }
    }

    return (
        <Dialog open={open} onClose={onClose} id="zb-todos-dialog">
            <DialogPanel size="lg" className="zb-todos-dialog">
                <DialogHeader>
                    <div className="zb-todos-dialog__heading">
                        <DialogTitle>{heading}</DialogTitle>
                        {todos.length > 0 ? (
                            <p className="zb-todos-dialog__meta" aria-live="polite">
                                {itemCountLabel}
                            </p>
                        ) : null}
                    </div>
                    <DialogCloseButton />
                </DialogHeader>

                <DialogBody>
                    <div className="zb-todos-dialog__body">
                    {loading ? (
                        <ScreenLoader variant="inline" label="Carregando lista" />
                    ) : (
                        <ul className="zb-todos-dialog__list" aria-label="Itens da lista">
                            {todos.length === 0 ? (
                                <li className="zb-todos-dialog__empty">
                                    Nenhum item ainda. Descreva abaixo o que quer guardar e o valor estimado.
                                </li>
                            ) : (
                                todos.map((t) => {
                                    const bought = Boolean(t.isPurchased);
                                    const amt = roundMoney2(Number(t.amount) || 0);
                                    return (
                                        <li
                                            key={t.id}
                                            className={`zb-todos-dialog__item${bought ? ' is-purchased' : ''}`}
                                        >
                                            <button
                                                type="button"
                                                className="zb-todos-dialog__toggle"
                                                aria-pressed={bought}
                                                aria-label={bought ? 'Marcar como pendente' : 'Marcar como comprado'}
                                                onClick={() => void togglePurchased(t)}
                                            >
                                                <span className="zb-todos-dialog__check" aria-hidden="true">
                                                    <i className={`fas ${bought ? 'fa-check-circle' : 'fa-circle'}`} />
                                                </span>
                                                <span className="zb-todos-dialog__item-title">{t.title}</span>
                                            </button>
                                            <TodoAmountInput todoId={t.id} amount={amt} onCommit={commitAmount} />
                                            <button
                                                type="button"
                                                className="zb-todos-dialog__remove"
                                                aria-label="Remover item"
                                                onClick={() => void removeTodo(t)}
                                            >
                                                <DeleteIcon size="sm" />
                                            </button>
                                        </li>
                                    );
                                })
                            )}
                        </ul>
                    )}

                    <div className="zb-todos-dialog__total" role="status">
                        <span className="zb-todos-dialog__total-label">Total da lista</span>
                        <strong className="zb-todos-dialog__total-value">{formatBRL(total, currency)}</strong>
                    </div>
                    </div>
                </DialogBody>

                <DialogForm className="zb-todos-dialog__form ui-form" onSubmit={(e) => void onSubmit(e)}>
                    <div className="ui-form-grid ui-form-grid--2 zb-todos-dialog__new-grid">
                        <FormField id="zb-todos-title-input" label="Novo item">
                            <FormInput
                                id="zb-todos-title-input"
                                name="title"
                                maxLength={500}
                                placeholder="Ex.: presente, assinatura, equipamento…"
                                autoComplete="off"
                                required
                                disabled={adding}
                            />
                        </FormField>
                        <FormField id="zb-todos-amount-input" label="Valor">
                            <FormInput
                                id="zb-todos-amount-input"
                                name="amount"
                                type="number"
                                min={0}
                                step={0.01}
                                placeholder="0"
                                inputMode="decimal"
                                disabled={adding}
                            />
                        </FormField>
                    </div>
                    <DialogFooter>
                        <FormActions
                            onCancel={onClose}
                            cancelLabel="Fechar"
                            submitLabel="Adicionar"
                            busy={adding}
                        />
                    </DialogFooter>
                </DialogForm>
            </DialogPanel>
        </Dialog>
    );
}