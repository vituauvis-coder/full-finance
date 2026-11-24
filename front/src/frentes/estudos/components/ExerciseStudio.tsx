import { useCallback, useEffect, useMemo, useState } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import {
    emptyExerciseDoc,
    exerciseTypeLabel,
    parseExerciseDoc,
    serializeExerciseDoc,
    type ExerciseDoc,
    type ExerciseType
} from '../domain/exerciseDoc';
import { FlashcardDeckView } from './FlashcardDeckView';
import { FlashcardEditor } from './FlashcardEditor';
import { FlashcardStudySession } from './FlashcardStudySession';
import { QuizEditor } from './QuizEditor';

type Props = {
    notesHtml: string;
    updatedAt?: string;
    onSave: (serialized: string) => void;
};

type FlashSurface = 'deck' | 'edit' | 'study';

function loadDoc(notesHtml: string): ExerciseDoc {
    const parsed = parseExerciseDoc(notesHtml);
    if (parsed) {
        if (parsed.type === 'flashcards' && parsed.flashcards.cards.length === 0) {
            return { ...parsed, flashcards: { cards: emptyExerciseDoc('flashcards').flashcards.cards } };
        }
        if (parsed.type === 'quiz' && parsed.quiz.questions.length === 0) {
            return { ...parsed, quiz: { questions: emptyExerciseDoc('quiz').quiz.questions } };
        }
        return parsed;
    }
    return emptyExerciseDoc('quiz');
}

function flashHasContent(doc: ExerciseDoc): boolean {
    return doc.flashcards.cards.some((c) => c.front.trim() || c.back.trim());
}

function defaultFlashSurface(doc: ExerciseDoc, dirty: boolean): FlashSurface {
    if (dirty) return 'edit';
    return flashHasContent(doc) ? 'deck' : 'edit';
}

export function ExerciseStudio({ notesHtml, updatedAt, onSave }: Props) {
    const [savedDoc, setSavedDoc] = useState<ExerciseDoc>(() => loadDoc(notesHtml));
    const [doc, setDoc] = useState<ExerciseDoc>(() => loadDoc(notesHtml));
    const [dirty, setDirty] = useState(false);
    const [flashSurface, setFlashSurface] = useState<FlashSurface>(() =>
        defaultFlashSurface(loadDoc(notesHtml), false)
    );
    const [flashEditIndex, setFlashEditIndex] = useState(0);

    useEffect(() => {
        const next = loadDoc(notesHtml);
        setSavedDoc(next);
        setDoc(next);
        setDirty(false);
        setFlashSurface(defaultFlashSurface(next, false));
    }, [notesHtml]);

    const updatedLabel = updatedAt
        ? new Date(updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
        : null;

    const markDirty = useCallback((next: ExerciseDoc) => {
        setDoc(next);
        setDirty(true);
    }, []);

    const save = () => {
        const serialized = serializeExerciseDoc(doc);
        onSave(serialized);
        setSavedDoc(doc);
        setDirty(false);
        if (doc.type === 'flashcards') {
            setFlashSurface('deck');
        }
    };

    const discard = () => {
        setDoc(savedDoc);
        setDirty(false);
        if (savedDoc.type === 'flashcards') {
            setFlashSurface(defaultFlashSurface(savedDoc, false));
        }
    };

    const switchType = (type: ExerciseType) => {
        if (type === doc.type) return;
        const hasContent =
            doc.type === 'quiz'
                ? doc.quiz.questions.some((q) => q.prompt.trim() || q.options.some((o) => o.text.trim()))
                : doc.flashcards.cards.some((c) => c.front.trim() || c.back.trim());
        if (hasContent && !window.confirm('Trocar o tipo apaga o conteúdo atual deste exercício. Continuar?')) {
            return;
        }
        const next = emptyExerciseDoc(type);
        markDirty(next);
        setFlashSurface(type === 'flashcards' ? 'edit' : 'deck');
    };

    const meta = useMemo(() => {
        if (doc.type === 'quiz') {
            return `${doc.quiz.questions.length} pergunta${doc.quiz.questions.length === 1 ? '' : 's'}`;
        }
        const mode =
            flashSurface === 'study' ? 'treino' : flashSurface === 'deck' ? 'baralho' : 'edição';
        return `${doc.flashcards.cards.length} cartão${doc.flashcards.cards.length === 1 ? '' : 's'} · ${mode}`;
    }, [doc, flashSurface]);

    return (
        <section className="estudos-exercise-studio" aria-label="Configuração do exercício">
            <header className="estudos-exercise-studio__chrome">
                <div className="estudos-exercise-studio__copy">
                    <span className="estudos-exercise-studio__badge">
                        <MaterialIcon name={doc.type === 'quiz' ? 'quiz' : 'style'} variant="app" />
                        {exerciseTypeLabel(doc.type)}
                    </span>
                    <p className="estudos-exercise-studio__meta">{meta}</p>
                </div>

                <div className="estudos-exercise-studio__type" role="group" aria-label="Tipo de exercício">
                    {(['quiz', 'flashcards'] as const).map((t) => (
                        <button
                            key={t}
                            type="button"
                            className={`estudos-exercise-studio__type-btn${doc.type === t ? ' estudos-exercise-studio__type-btn--active' : ''}`}
                            onClick={() => switchType(t)}
                        >
                            {exerciseTypeLabel(t)}
                        </button>
                    ))}
                </div>

                <div className="estudos-exercise-studio__actions">
                    {doc.type === 'flashcards' && flashSurface === 'study' ? (
                        <button type="button" className="estudos-btn-ghost" onClick={() => setFlashSurface('deck')}>
                            <MaterialIcon name="arrow_back" variant="app" />
                            Sair do treino
                        </button>
                    ) : null}
                    {doc.type === 'flashcards' && flashSurface === 'deck' && !dirty ? (
                        <button
                            type="button"
                            className="estudos-btn-ghost"
                            onClick={() => {
                                setFlashEditIndex(0);
                                setFlashSurface('edit');
                            }}
                        >
                            <MaterialIcon name="edit_note" variant="app" />
                            Editar
                        </button>
                    ) : null}
                    {updatedLabel ? (
                        <span className="estudos-exercise-studio__saved">Salvo {updatedLabel}</span>
                    ) : (
                        <span className="estudos-exercise-studio__saved estudos-exercise-studio__saved--muted">
                            Não salvo
                        </span>
                    )}
                    <button type="button" className="estudos-btn-ghost" onClick={discard} disabled={!dirty}>
                        Descartar
                    </button>
                    <button type="button" className="estudos-btn-primary" onClick={save} disabled={!dirty}>
                        <MaterialIcon name="save" variant="app" />
                        Salvar
                    </button>
                </div>
            </header>

            {doc.type === 'flashcards' && dirty && flashSurface === 'deck' ? (
                <p className="estudos-flash-deck__dirty-hint" role="status">
                    Há alterações não salvas — salve para atualizar o baralho.
                </p>
            ) : null}

            <div className="estudos-exercise-studio__body">
                {doc.type === 'quiz' ? (
                    <QuizEditor
                        questions={doc.quiz.questions}
                        onChange={(questions) => markDirty({ ...doc, quiz: { questions } })}
                    />
                ) : flashSurface === 'study' ? (
                    <FlashcardStudySession cards={doc.flashcards.cards} onExit={() => setFlashSurface('deck')} />
                ) : flashSurface === 'deck' ? (
                    <FlashcardDeckView
                        cards={doc.flashcards.cards}
                        onChange={(cards) => markDirty({ ...doc, flashcards: { cards } })}
                        onEditCard={(index) => {
                            setFlashEditIndex(index);
                            setFlashSurface('edit');
                        }}
                        onEditAll={() => {
                            setFlashEditIndex(0);
                            setFlashSurface('edit');
                        }}
                        onStudy={() => {
                            if (dirty) save();
                            setFlashSurface('study');
                        }}
                    />
                ) : (
                    <FlashcardEditor
                        cards={doc.flashcards.cards}
                        initialIndex={flashEditIndex}
                        onChange={(cards) => markDirty({ ...doc, flashcards: { cards } })}
                        onDone={() => {
                            if (dirty) {
                                save();
                            } else {
                                setFlashSurface('deck');
                            }
                        }}
                    />
                )}
            </div>
        </section>
    );
}