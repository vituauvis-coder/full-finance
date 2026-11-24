import { Link, Navigate, useParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { ExerciseStudio } from '../components/ExerciseStudio';
import { exerciseTypeLabel, parseExerciseDoc } from '../domain/exerciseDoc';
import { linkLabels } from '../domain/exerciseLinks';
import { disciplinesForStudy, findExercise, updateExerciseNotes } from '../domain/estudosStorage';
import { useEstudosStore } from '../hooks/useEstudosStore';
import '../../dashboard/styles/dashboard-tokens.css';
import '../styles/estudos.css';

export function ExercicioWorkspacePage() {
    const { studyId, exerciseId } = useParams<{ studyId: string; exerciseId: string }>();
    const store = useEstudosStore();

    const study = store.studies.find((s) => s.id === studyId);
    const exercise = exerciseId ? findExercise(store, exerciseId) : undefined;
    const disciplines = study ? disciplinesForStudy(store, study.id) : [];

    if (!study || !exercise || exercise.studyId !== study.id) {
        return <Navigate to="/estudos" replace />;
    }

    const doc = parseExerciseDoc(exercise.notesHtml);
    const typeLabel = doc ? exerciseTypeLabel(doc.type) : exercise.summary || 'Exercício';
    const links = linkLabels(exercise, disciplines);

    return (
        <section id="estudos-page" className="page active estudos-page estudos-page--workspace">
            <div className="estudos-workspace-shell">
                <nav className="estudos-breadcrumb estudos-workspace-shell__crumb" aria-label="Trilha">
                    <Link to="/estudos">Estudos</Link>
                    <MaterialIcon name="chevron_right" variant="app" />
                    <Link to={`/estudos/${study.id}`}>{study.title}</Link>
                    <MaterialIcon name="chevron_right" variant="app" />
                    <span>{exercise.title}</span>
                </nav>

                <header className="estudos-exercise-hero" aria-label="Resumo do exercício">
                    <div className="estudos-exercise-hero__main">
                        <span className="estudos-exercise-row__type">{typeLabel}</span>
                        <h1 className="estudos-exercise-hero__title">{exercise.title}</h1>
                    </div>
                    {links.length > 0 ? (
                        <div className="estudos-exercise-hero__links" aria-label="Disciplinas vinculadas">
                            {links.map((l) =>
                                l.id !== '__all__' && l.id !== '__none__' ? (
                                    <Link
                                        key={l.id}
                                        to={`/estudos/${study.id}/disciplinas/${l.id}`}
                                        className="estudos-link-chip estudos-link-chip--tag"
                                    >
                                        <MaterialIcon name="auto_stories" variant="app" />
                                        {l.label}
                                    </Link>
                                ) : (
                                    <span key={l.id} className="estudos-link-chip estudos-link-chip--static">
                                        {l.label}
                                    </span>
                                )
                            )}
                        </div>
                    ) : null}
                </header>

                <ExerciseStudio
                    notesHtml={exercise.notesHtml}
                    updatedAt={exercise.notesUpdatedAt}
                    onSave={(serialized) => updateExerciseNotes(exercise.id, serialized)}
                />
            </div>
        </section>
    );
}