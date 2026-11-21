import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/http';
import { DeleteIcon } from '../../../components/icons/DeleteIcon';

type KanbanCard = {
    id: string;
    title: string;
    column?: string;
    description?: string;
    type?: string;
};

const COLUMNS = [
    { key: 'backlog', label: 'Backlog' },
    { key: 'ativo', label: 'Ativo' },
    { key: 'teste', label: 'Teste' },
    { key: 'finalizado', label: 'Finalizado' }
];

export function FerramentasPage() {
    const [cards, setCards] = useState<KanbanCard[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [cardType, setCardType] = useState('melhoria');
    const [description, setDescription] = useState('');

    const load = useCallback(async () => {
        try {
            setError(null);
            const rows = await apiFetch<KanbanCard[]>('/api/kanban-cards');
            setCards(Array.isArray(rows) ? rows : []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro ao carregar');
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function addCard(e: FormEvent) {
        e.preventDefault();
        const t = title.trim();
        if (!t) return;
        await apiFetch('/api/kanban-cards', {
            method: 'POST',
            body: JSON.stringify({
                title: t,
                column: 'backlog',
                type: cardType,
                description: description.trim() || undefined
            })
        });
        setTitle('');
        setDescription('');
        await load();
    }

    async function removeCard(card: KanbanCard) {
        if (!window.confirm('Excluir este card?')) return;
        await apiFetch(`/api/kanban-cards/${encodeURIComponent(card.id)}`, { method: 'DELETE' });
        await load();
    }

    async function editCard(card: KanbanCard) {
        const next = window.prompt('Novo título', card.title);
        if (!next?.trim()) return;
        await apiFetch(`/api/kanban-cards/${encodeURIComponent(card.id)}`, {
            method: 'PUT',
            body: JSON.stringify({ title: next.trim() })
        });
        await load();
    }

    async function moveCard(card: KanbanCard, column: string) {
        if (card.column === column) return;
        await apiFetch(`/api/kanban-cards/${encodeURIComponent(card.id)}`, {
            method: 'PUT',
            body: JSON.stringify({ column })
        });
        await load();
    }

    return (
        <section className="page active tools-page" aria-label="Ferramentas">
            <h2>Kanban</h2>
            {error ? <p role="alert">{error}</p> : null}
            <form
                onSubmit={(e) => void addCard(e)}
                style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}
            >
                <input type="text" placeholder="Nova tarefa" value={title} onChange={(e) => setTitle(e.target.value)} />
                <select value={cardType} onChange={(e) => setCardType(e.target.value)}>
                    <option value="bug">Bug</option>
                    <option value="melhoria">Melhoria</option>
                    <option value="melhoria_rapida">Melhoria rápida</option>
                </select>
                <input
                    type="text"
                    placeholder="Descrição (opcional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <button type="submit" className="btn-primary">
                    Adicionar
                </button>
            </form>
            <div className="kanban-board" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                {COLUMNS.map((col) => (
                    <KanbanColumn
                        key={col.key}
                        label={col.label}
                        columnKey={col.key}
                        cards={cards.filter((c) => (c.column || 'backlog') === col.key)}
                        onMove={moveCard}
                        onEdit={editCard}
                        onRemove={removeCard}
                    />
                ))}
            </div>
        </section>
    );
}

function KanbanColumn({
    label,
    columnKey,
    cards,
    onMove,
    onEdit,
    onRemove
}: {
    label: string;
    columnKey: string;
    cards: KanbanCard[];
    onMove: (card: KanbanCard, column: string) => void | Promise<void>;
    onEdit: (card: KanbanCard) => void | Promise<void>;
    onRemove: (card: KanbanCard) => void | Promise<void>;
}) {
    return (
        <div className="kanban-column">
            <h3>{label}</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {cards.map((c) => (
                    <li key={c.id} className="kanban-card" style={{ marginBottom: '0.5rem', padding: '0.5rem', border: '1px solid var(--border-subtle, #ccc)' }}>
                        <strong>{c.title}</strong>
                        {c.type ? <span className="card-metric-hint"> · {c.type}</span> : null}
                        {c.description ? <p className="card-metric-hint">{c.description}</p> : null}
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                            {COLUMNS.filter((col) => col.key !== columnKey).map((col) => (
                                <button
                                    key={col.key}
                                    type="button"
                                    className="btn-secondary btn-small"
                                    onClick={() => void onMove(c, col.key)}
                                >
                                    → {col.label}
                                </button>
                            ))}
                            <button type="button" className="btn-secondary btn-small" onClick={() => void onEdit(c)}>
                                Editar
                            </button>
                            <button
                                type="button"
                                className="btn-secondary btn-small delete-action-btn"
                                onClick={() => void onRemove(c)}
                            >
                                <DeleteIcon size="sm" />
                                Excluir
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}