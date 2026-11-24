import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { newExerciseId, newQuizQuestion, type QuizQuestion } from '../domain/exerciseDoc';

type Props = {
    questions: QuizQuestion[];
    onChange: (questions: QuizQuestion[]) => void;
};

export function QuizEditor({ questions, onChange }: Props) {
    const patchQuestion = (id: string, patch: Partial<QuizQuestion>) => {
        onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    };

    const removeQuestion = (id: string) => {
        if (questions.length <= 1) return;
        onChange(questions.filter((q) => q.id !== id));
    };

    const setCorrectOption = (questionId: string, optionId: string) => {
        onChange(
            questions.map((q) =>
                q.id !== questionId
                    ? q
                    : {
                          ...q,
                          options: q.options.map((o) => ({ ...o, correct: o.id === optionId }))
                      }
            )
        );
    };

    const patchOptionText = (questionId: string, optionId: string, text: string) => {
        onChange(
            questions.map((q) =>
                q.id !== questionId
                    ? q
                    : {
                          ...q,
                          options: q.options.map((o) => (o.id === optionId ? { ...o, text } : o))
                      }
            )
        );
    };

    const addOption = (questionId: string) => {
        onChange(
            questions.map((q) =>
                q.id !== questionId
                    ? q
                    : {
                          ...q,
                          options: [...q.options, { id: newExerciseId(), text: '', correct: false }]
                      }
            )
        );
    };

    const removeOption = (questionId: string, optionId: string) => {
        onChange(
            questions.map((q) => {
                if (q.id !== questionId) return q;
                const next = q.options.filter((o) => o.id !== optionId);
                if (next.length === 0) return q;
                if (!next.some((o) => o.correct)) next[0] = { ...next[0], correct: true };
                return { ...q, options: next };
            })
        );
    };

    return (
        <div className="estudos-quiz-editor">
            {questions.map((q, index) => (
                <article key={q.id} className="estudos-quiz-card">
                    <header className="estudos-quiz-card__head">
                        <span className="estudos-quiz-card__index">Pergunta {index + 1} de {questions.length}</span>
                        <button
                            type="button"
                            className="estudos-quiz-card__remove"
                            onClick={() => removeQuestion(q.id)}
                            disabled={questions.length <= 1}
                            aria-label="Remover pergunta"
                        >
                            <MaterialIcon name="delete" variant="app" />
                        </button>
                    </header>

                    <label className="estudos-field">
                        <span className="estudos-field__label">Enunciado</span>
                        <textarea
                            className="estudos-field__textarea"
                            rows={2}
                            value={q.prompt}
                            placeholder="Digite a pergunta…"
                            onChange={(e) => patchQuestion(q.id, { prompt: e.target.value })}
                        />
                    </label>

                    <div className="estudos-quiz-options">
                        <span className="estudos-field__label">Alternativas (marque a correta)</span>
                        <ul className="estudos-quiz-options__list">
                            {q.options.map((o, optIndex) => (
                                <li key={o.id} className="estudos-quiz-option">
                                    <label className="estudos-quiz-option__correct">
                                        <input
                                            type="radio"
                                            name={`correct-${q.id}`}
                                            checked={o.correct}
                                            onChange={() => setCorrectOption(q.id, o.id)}
                                            aria-label={`Alternativa ${optIndex + 1} correta`}
                                        />
                                        <span className="estudos-quiz-option__letter" aria-hidden>
                                            {String.fromCharCode(65 + optIndex)}
                                        </span>
                                    </label>
                                    <input
                                        className="estudos-field__input estudos-quiz-option__text"
                                        value={o.text}
                                        placeholder={`Alternativa ${String.fromCharCode(65 + optIndex)}`}
                                        onChange={(e) => patchOptionText(q.id, o.id, e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="estudos-quiz-option__remove"
                                        onClick={() => removeOption(q.id, o.id)}
                                        aria-label="Remover alternativa"
                                    >
                                        <MaterialIcon name="close" variant="app" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <button type="button" className="estudos-btn-ghost estudos-quiz-options__add" onClick={() => addOption(q.id)}>
                            <MaterialIcon name="add" variant="app" />
                            Alternativa
                        </button>
                    </div>
                </article>
            ))}

            <button
                type="button"
                className="estudos-btn-ghost estudos-quiz-editor__add"
                onClick={() => onChange([...questions, newQuizQuestion()])}
            >
                <MaterialIcon name="post_add" variant="app" />
                Nova pergunta
            </button>
        </div>
    );
}