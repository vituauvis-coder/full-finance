import { useCallback, useEffect, useMemo, useState } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { Flashcard } from '../domain/exerciseDoc';

type Props = {
    cards: Flashcard[];
    onExit: () => void;
};

function studyableCards(cards: Flashcard[]): Flashcard[] {
    return cards.filter((c) => c.front.trim() && c.back.trim());
}

export function FlashcardStudySession({ cards, onExit }: Props) {
    const deck = useMemo(() => studyableCards(cards), [cards]);
    const [index, setIndex] = useState(0);
    const [showBack, setShowBack] = useState(false);

    useEffect(() => {
        setIndex(0);
        setShowBack(false);
    }, [deck]);

    const card = deck[index];
    const total = deck.length;

    const go = useCallback(
        (delta: number) => {
            if (total === 0) return;
            setShowBack(false);
            setIndex((i) => {
                const next = i + delta;
                if (next < 0) return total - 1;
                if (next >= total) return 0;
                return next;
            });
        },
        [total]
    );

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onExit();
                return;
            }
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setShowBack((v) => !v);
                return;
            }
            if (e.key === 'ArrowRight') go(1);
            if (e.key === 'ArrowLeft') go(-1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [go, onExit]);

    if (total === 0) {
        return (
            <div className="estudos-flash-study estudos-flash-study--empty">
                <MaterialIcon name="info" variant="app" />
                <p>Adicione cartões com frente e verso preenchidos para treinar.</p>
                <button type="button" className="estudos-btn-primary" onClick={onExit}>
                    Voltar ao baralho
                </button>
            </div>
        );
    }

    const progress = Math.round(((index + 1) / total) * 100);

    return (
        <div className="estudos-flash-study">
            <header className="estudos-flash-study__top">
                <button type="button" className="estudos-btn-ghost estudos-flash-study__back" onClick={onExit}>
                    <MaterialIcon name="arrow_back" variant="app" />
                    Baralho
                </button>
                <div className="estudos-flash-study__progress" aria-live="polite">
                    <span className="estudos-flash-study__count">
                        {index + 1} / {total}
                    </span>
                    <div
                        className="estudos-flash-study__bar"
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                    >
                        <span style={{ width: `${progress}%` }} />
                    </div>
                </div>
            </header>

            <button
                type="button"
                className={`estudos-flash-study__card${showBack ? ' estudos-flash-study__card--back' : ''}`}
                onClick={() => setShowBack((v) => !v)}
                aria-pressed={showBack}
            >
                <span className="estudos-flash-study__face-label">{showBack ? 'Verso' : 'Frente'}</span>
                <span className="estudos-flash-study__face-text">
                    {showBack ? card.back : card.front}
                </span>
                <span className="estudos-flash-study__tap">
                    <MaterialIcon name="touch_app" variant="app" />
                    {showBack ? 'Toque para ver a frente' : 'Toque para virar'}
                </span>
            </button>

            <footer className="estudos-flash-study__nav">
                <button type="button" className="estudos-btn-ghost" onClick={() => go(-1)}>
                    <MaterialIcon name="chevron_left" variant="app" />
                    Anterior
                </button>
                <button
                    type="button"
                    className="estudos-btn-primary estudos-flash-study__flip"
                    onClick={() => setShowBack((v) => !v)}
                >
                    <MaterialIcon name="flip" variant="app" />
                    {showBack ? 'Frente' : 'Virar'}
                </button>
                <button type="button" className="estudos-btn-ghost" onClick={() => go(1)}>
                    Próximo
                    <MaterialIcon name="chevron_right" variant="app" />
                </button>
            </footer>
        </div>
    );
}