import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/http';
import { formatBRL } from '../../../lib/format';
import { ScreenLoader } from '../../../components/ui/ScreenLoader';

type Todo = {
    id: string;
    title: string;
    amount?: number;
    isPurchased?: boolean;
};

type Props = {
    blockId: string;
    currency: string;
};

export function ZeroBudgetBlockTodos({ blockId, currency }: Props) {
    const [todos, setTodos] = useState<Todo[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await apiFetch<Todo[]>(`/api/zero-budget/blocks/${encodeURIComponent(blockId)}/todos`);
            setTodos(Array.isArray(rows) ? rows : []);
        } catch {
            setTodos([]);
        } finally {
            setLoading(false);
        }
    }, [blockId]);

    useEffect(() => {
        void load();
    }, [load]);

    const [newTitle, setNewTitle] = useState('');
    const [newAmount, setNewAmount] = useState('');

    async function addTodo() {
        const title = newTitle.trim();
        const amount = parseFloat(newAmount);
        if (!title) return;
        await apiFetch(`/api/zero-budget/blocks/${encodeURIComponent(blockId)}/todos`, {
            method: 'POST',
            body: JSON.stringify({ title, amount: Number.isFinite(amount) ? amount : 0 })
        });
        setNewTitle('');
        setNewAmount('');
        await load();
    }

    async function togglePurchased(t: Todo) {
        await apiFetch(`/api/zero-budget/todos/${encodeURIComponent(t.id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ isPurchased: !t.isPurchased })
        });
        await load();
    }

    if (loading) return <ScreenLoader variant="inline" label="Carregando itens" />;
    if (todos.length === 0) return <p className="card-metric-hint">Nenhum item neste bloco.</p>;

    return (
        <>
            <form
                className="zero-budget-todo-form"
                onSubmit={(e) => {
                    e.preventDefault();
                    void addTodo();
                }}
                style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem' }}
            >
                <input placeholder="Item" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                <input
                    type="number"
                    step="0.01"
                    placeholder="Valor"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                />
                <button type="submit" className="btn-secondary btn-small">
                    + Item
                </button>
            </form>
        <ul className="zero-budget-todos-list">
            {todos.map((t) => (
                <li key={t.id}>
                    <label>
                        <input type="checkbox" checked={!!t.isPurchased} onChange={() => void togglePurchased(t)} /> {t.title}
                    </label>
                    <span>{formatBRL(Number(t.amount) || 0, currency)}</span>
                </li>
            ))}
        </ul>
        </>
    );
}