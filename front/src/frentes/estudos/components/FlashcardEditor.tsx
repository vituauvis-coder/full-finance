import { useEffect, useState } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { newFlashcard, type Flashcard } from '../domain/exerciseDoc';

type Props = {
    cards: Flashcard[];
    onChange: (cards: Flashcard[]) => void;
    initialIndex?: number;
    onDone?: () => void;
};

export function FlashcardEditor({ cards, onChange, initialIndex = 0, onDone }: Props) {
    const [activeIndex, setActiveIndex] = useState(initialIndex);

    useEffect(() => {
        setActiveIndex(initialIndex);
    }, [initialIndex]);
    const [previewFace, setPreviewFace] = useState<'front' | 'back'>('front');

    useEffect(() => {
        if (activeIndex < cards.length) return;
        setActiveIndex(Math.max(0, cards.length - 1));
    }, [activeIndex, cards.length]);

    const active = cards[activeIndex];
    if (!active) {
        return (
            <div className="estudos-flash-studio estudos-flash-studio--empty">
                <p>Nenhum cartão.</p>
                <button type="button" className="estudos-btn-primary" onClick={() => onChange([newFlashcard()])}>
                    <MaterialIcon name="add" variant="app" />
                    Criar cartão
                </button>
            </div>
        );
    }

    const patchActive = (patch: Partial<Flashcard>) => {
        onChange(cards.map((c, i) => (i === activeIndex ? { ...c, ...patch } : c)));
    };

    const removeActive = () => {
        if (cards.length <= 1) return;
        const next = cards.filter((_, i) => i !== activeIndex);
        onChange(next);
        setActiveIndex((i) => Math.min(i, next.length - 1));
    };

    const goPrev = () => setActiveIndex((i) => Math.max(0, i - 1));
    const goNext = () => setActiveIndex((i) => Math.min(cards.length - 1, i + 1));

    const labelForThumb = (card: Flashcard, index: number) => {
        const text = card.front.trim() || card.back.trim();
        if (!text) return `${index + 1}`;
        return text.length > 22 ? `${text.slice(0, 22)}…` : text;
    };

    return (
        <div className="estudos-flash-studio">
            <div className="estudos-flash-rail" aria-label="Cartões">
                {cards.map((card, index) => (
                    <button
                        key={card.id}
                        type="button"
                        className={`estudos-flash-rail__chip${index === activeIndex ? ' estudos-flash-rail__chip--active' : ''}`}
                        onClick={() => {
                            setActiveIndex(index);
                            setPreviewFace('front');
                        }}
                    >
                        <span className="estudos-flash-rail__num">{index + 1}</span>
                        <span className="estudos-flash-rail__label">{labelForThumb(card, index)}</span>
                    </button>
                ))}
                <button
                    type="button"
                    className="estudos-flash-rail__add"
                    onClick={() => {
                        onChange([...cards, newFlashcard()]);
                        setActiveIndex(cards.length);
                        setPreviewFace('front');
                    }}
                >
                    <MaterialIcon name="add" variant="app" />
                </button>
            </div>

            <div className="estudos-flash-stage">
                <div className="estudos-flash-spread">
                    <article className="estudos-flash-face estudos-flash-face--front">
                        <header className="estudos-flash-face__head">
                            <MaterialIcon name="crop_portrait" variant="app" />
                            Frente
                        </header>
                        <textarea
                            className="estudos-flash-face__input"
                            rows={5}
                            value={active.front}
                            placeholder="Pergunta, termo ou conceito…"
                            onChange={(e) => patchActive({ front: e.target.value })}
                        />
                    </article>

                    <div className="estudos-flash-spread__hinge" aria-hidden>
                        <span />
                    </div>

                    <article className="estudos-flash-face estudos-flash-face--back">
                        <header className="estudos-flash-face__head">
                            <MaterialIcon name="flip" variant="app" />
                            Verso
                        </header>
                        <textarea
                            className="estudos-flash-face__input"
                            rows={5}
                            value={active.back}
                            placeholder="Resposta, definição ou explicação…"
                            onChange={(e) => patchActive({ back: e.target.value })}
                        />
                    </article>
                </div>

                <aside className="estudos-flash-preview" aria-label="Pré-visualização">
                    <p className="estudos-flash-preview__label">Prévia</p>
                    <button
                        type="button"
                        className={`estudos-flash-preview__card estudos-flash-preview__card--${previewFace}`}
                        onClick={() => setPreviewFace((f) => (f === 'front' ? 'back' : 'front'))}
                    >
                        <span className="estudos-flash-preview__face-tag">{previewFace === 'front' ? 'Frente' : 'Verso'}</span>
                        <span className="estudos-flash-preview__text">
                            {previewFace === 'front'
                                ? active.front.trim() || '—'
                                : active.back.trim() || '—'}
                        </span>
                        <span className="estudos-flash-preview__hint">
                            <MaterialIcon name="touch_app" variant="app" />
                            Toque para virar
                        </span>
                    </button>
                </aside>
            </div>

            {onDone ? (
                <div className="estudos-flash-editor-done">
                    <button type="button" className="estudos-btn-primary" onClick={onDone}>
                        <MaterialIcon name="check" variant="app" />
                        Concluir edição
                    </button>
                </div>
            ) : null}

            <footer className="estudos-flash-toolbar">
                <button type="button" className="estudos-btn-ghost" onClick={goPrev} disabled={activeIndex === 0}>
                    <MaterialIcon name="chevron_left" variant="app" />
                    Anterior
                </button>
                <span className="estudos-flash-toolbar__count">
                    {activeIndex + 1} / {cards.length}
                </span>
                <button type="button" className="estudos-btn-ghost" onClick={goNext} disabled={activeIndex >= cards.length - 1}>
                    Próximo
                    <MaterialIcon name="chevron_right" variant="app" />
                </button>
                <button type="button" className="estudos-flash-toolbar__delete estudos-btn-ghost" onClick={removeActive} disabled={cards.length <= 1}>
                    <MaterialIcon name="delete" variant="app" />
                    Remover cartão
                </button>
            </footer>
        </div>
    );
}