export type ExerciseType = 'quiz' | 'flashcards';

export type QuizOption = {
    id: string;
    text: string;
    correct: boolean;
};

export type QuizQuestion = {
    id: string;
    prompt: string;
    options: QuizOption[];
    explanation?: string;
};

export type Flashcard = {
    id: string;
    front: string;
    back: string;
};

export type ExerciseDoc = {
    version: 1;
    exercise: true;
    type: ExerciseType;
    quiz: { questions: QuizQuestion[] };
    flashcards: { cards: Flashcard[] };
};

export function newExerciseId() {
    return `ex_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultQuizOptions(): QuizOption[] {
    return [
        { id: newExerciseId(), text: '', correct: true },
        { id: newExerciseId(), text: '', correct: false },
        { id: newExerciseId(), text: '', correct: false },
        { id: newExerciseId(), text: '', correct: false }
    ];
}

export function newQuizQuestion(): QuizQuestion {
    return {
        id: newExerciseId(),
        prompt: '',
        options: defaultQuizOptions()
    };
}

export function newFlashcard(): Flashcard {
    return { id: newExerciseId(), front: '', back: '' };
}

export function emptyExerciseDoc(type: ExerciseType): ExerciseDoc {
    return {
        version: 1,
        exercise: true,
        type,
        quiz: {
            questions: type === 'quiz' ? [newQuizQuestion()] : []
        },
        flashcards: {
            cards: type === 'flashcards' ? [newFlashcard()] : []
        }
    };
}

export function parseExerciseDoc(raw: string): ExerciseDoc | null {
    const trimmed = raw?.trim() ?? '';
    if (!trimmed.startsWith('{')) return null;
    try {
        const parsed = JSON.parse(trimmed) as Partial<ExerciseDoc>;
        if (parsed?.version !== 1 || parsed.exercise !== true || !parsed.type) return null;
        return {
            version: 1,
            exercise: true,
            type: parsed.type,
            quiz: {
                questions: (parsed.quiz?.questions ?? []).map((q) => ({
                    id: q.id || newExerciseId(),
                    prompt: q.prompt ?? '',
                    explanation: q.explanation,
                    options: (q.options ?? defaultQuizOptions()).map((o) => ({
                        id: o.id || newExerciseId(),
                        text: o.text ?? '',
                        correct: Boolean(o.correct)
                    }))
                }))
            },
            flashcards: {
                cards: (parsed.flashcards?.cards ?? []).map((c) => ({
                    id: c.id || newExerciseId(),
                    front: c.front ?? '',
                    back: c.back ?? ''
                }))
            }
        };
    } catch {
        return null;
    }
}

export function serializeExerciseDoc(doc: ExerciseDoc): string {
    return JSON.stringify(doc);
}

export function exerciseTypeLabel(type: ExerciseType): string {
    return type === 'quiz' ? 'Quiz' : 'Flashcards';
}