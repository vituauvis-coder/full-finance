import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { exerciseTypeLabel, parseExerciseDoc } from '../domain/exerciseDoc';
import { linkLabels } from '../domain/exerciseLinks';
import type { StudyDiscipline, StudyExercise } from '../types';

type Props = {
    studyId: string;
    exercise: StudyExercise;
    disciplines: StudyDiscipline[];
    onEditLinks?: () => void;
};

export function ExercicioListItem({ studyId, exercise, disciplines, onEditLinks }: Props) {
    const doc = parseExerciseDoc(exercise.notesHtml);
    const typeLabel = doc ? exerciseTypeLabel(doc.type) : exercise.summary || 'Exercício';
    const iconName = doc?.type === 'flashcards' ? 'style' : doc?.type === 'quiz' ? 'quiz' : 'fitness_center';
    const links = linkLabels(exercise, disciplines);
    const linkHint =
        links[0]?.id === '__all__'
            ? 'Em todas as disciplinas'
            : links[0]?.id === '__none__'
              ? 'Sem atalhos nas disciplinas'
              : links.length === 1
                ? `Atalho em ${links[0].label}`
                : `Atalhos em ${links.length} disciplinas`;

    return (
        <article className="estudos-disciplina-row estudos-disciplina-row--card estudos-exercise-row">
            <div className="estudos-disciplina-row__top">
                <span className="estudos-disciplina-row__icon estudos-exercise-row__icon" aria-hidden="true">
                    <MaterialIcon name={iconName} variant="app" />
                </span>
                <div className="estudos-disciplina-row__body">
                    <span className="estudos-exercise-row__type">{typeLabel}</span>
                    <Link
                        to={`/estudos/${studyId}/exercicios/${exercise.id}`}
                        className="estudos-disciplina-row__title estudos-exercise-row__title"
                    >
                        {exercise.title}
                    </Link>
                    <p className="estudos-exercise-row__hint">{linkHint}</p>
                </div>
                <Link
                    to={`/estudos/${studyId}/exercicios/${exercise.id}`}
                    className="estudos-disciplina-row__open estudos-exercise-row__open"
                    aria-label={`Abrir ${exercise.title}`}
                >
                    <MaterialIcon name="north_east" variant="app" />
                </Link>
            </div>
            {onEditLinks ? (
                <footer className="estudos-exercise-row__foot">
                    <div className="estudos-exercise-row__chips" aria-hidden={links[0]?.id === '__none__'}>
                        {links.map((l) =>
                            l.id !== '__none__' ? (
                                <span key={l.id} className="estudos-link-chip estudos-link-chip--static">
                                    {l.label}
                                </span>
                            ) : null
                        )}
                    </div>
                    <button type="button" className="estudos-vincular-btn" onClick={onEditLinks}>
                        <MaterialIcon name="hub" variant="app" />
                        Vincular disciplinas
                    </button>
                </footer>
            ) : null}
        </article>
    );
}