import { useMemo, useState } from 'react';
/* Baralho em modo leitura — lista termo/definição (referência: Quizlet) */
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { newFlashcard, type Flashcard } from '../domain/exerciseDoc';

type Props = {
    cards: Flashcard[];
    onChange: (cards: Flashcard[]) => void;
    onEditCard: (index: number) => void;
    onEditAll: () => void;
    onStudy: () => void;
};

export function FlashcardDeckView({ cards, onChange, onEditCard, onEditAll, onStudy }: Props) {
    const [query, setQuery] = useState('');
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return cards.map((card, index) => ({ card, index }));
        return cards
            .map((card, index) => ({ card, index }))
            .filter(
                ({ card }) => card.front.toLowerCase().includes(q) || card.back.toLowerCase().includes(q)
            );
    }, [cards, query]);

    const filledCount = cards.filter((c) => c.front.trim() || c.back.trim()).length;
    const studyCount = cards.filter((c) => c.front.trim() && c.back.trim()).length;

    const addCard = () => {
        onChange([...cards, newFlashcard()]);
    };

    const removeAt = (index: number) => {
        if (cards.length <= 1) return;
        onChange(cards.filter((_, i) => i !== index));
    };

    return (
        <div className="estudos-flash-deck">
            <header className="estudos-flash-deck__toolbar">
                <div className="estudos-flash-deck__stats">
                    <span className="estudos-flash-deck__stat">
                        <MaterialIcon name="style" variant="app" />
                        {cards.length} cartões
                    </span>
                    <span className="estudos-flash-deck__stat estudos-flash-deck__stat--muted">
                        {filledCount} preenchido{filledCount === 1 ? '' : 's'}
                    </span>
                </div>
                <div className="estudos-flash-deck__toolbar-actions">
                    <label className="estudos-flash-deck__search">
                        <MaterialIcon name="search" variant="app" />
                        <input
                            type="search"
                            value={query}
                            placeholder="Buscar no baralho…"
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </label>
                    <button type="button" className="estudos-btn-primary" onClick={onStudy} disabled={studyCount === 0}>
                        <MaterialIcon name="school" variant="app" />
                        Estudar
                    </button>
                    <button type="button" className="estudos-btn-ghost" onClick={onEditAll}>
                        <MaterialIcon name="edit_note" variant="app" />
                        Editar
                    </button>
                </div>
            </header>

            <div className="estudos-flash-deck__table" role="table" aria-label="Cartões do baralho">
                <div className="estudos-flash-deck__head" role="row">
                    <span role="columnheader">#</span>
                    <span role="columnheader">Frente</span>
                    <span role="columnheader">Verso</span>
                    <span className="estudos-flash-deck__head-actions" role="columnheader" aria-label="Ações" />
                </div>

                <ul className="estudos-flash-deck__list">
                    {filtered.map(({ card, index }) => {
                        const front = card.front.trim() || '—';
                        const back = card.back.trim() || '—';
                        const empty = !card.front.trim() && !card.back.trim();
                        return (
                            <li
                                key={card.id}
                                className={`estudos-flash-deck__row${empty ? ' estudos-flash-deck__row--empty' : ''}`}
                                role="row"
                            >
                                <span className="estudos-flash-deck__num" role="cell">
                                    {index + 1}
                                </span>
                                <div className="estudos-flash-deck__term" role="cell">
                                    {front}
                                </div>
                                <div className="estudos-flash-deck__def" role="cell">
                                    {back}
                                </div>
                                <div className="estudos-flash-deck__row-actions" role="cell">
                                    <button
                                        type="button"
                                        className="estudos-flash-deck__icon-btn"
                                        aria-label={`Editar cartão ${index + 1}`}
                                        onClick={() => onEditCard(index)}
                                    >
                                        <MaterialIcon name="edit" variant="app" />
                                    </button>
                                    <button
                                        type="button"
                                        className="estudos-flash-deck__icon-btn"
                                        aria-label={`Remover cartão ${index + 1}`}
                                        disabled={cards.length <= 1}
                                        onClick={() => removeAt(index)}
                                    >
                                        <MaterialIcon name="delete" variant="app" />
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {filtered.length === 0 ? (
                <p className="estudos-flash-deck__empty">Nenhum cartão corresponde à busca.</p>
            ) : null}

            <button type="button" className="estudos-flash-deck__add" onClick={addCard}>
                <MaterialIcon name="add" variant="app" />
                Adicionar cartão
            </button>
        </div>
    );
}