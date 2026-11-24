import { Link, Navigate, useParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { DisciplinaOverview } from '../components/DisciplinaOverview';
import { StudyNotesCanvas } from '../components/StudyNotesCanvas';
import { linkedExercisesForDiscipline, updateDisciplineNotes } from '../domain/estudosStorage';
import { useEstudosStore } from '../hooks/useEstudosStore';
import '../../dashboard/styles/dashboard-tokens.css';
import '../styles/estudos.css';

export function DisciplinaWorkspacePage() {
    const { studyId, disciplineId } = useParams<{ studyId: string; disciplineId: string }>();
    const store = useEstudosStore();

    const study = store.studies.find((s) => s.id === studyId);
    const discipline = store.disciplines.find((d) => d.id === disciplineId && d.studyId === studyId);

    if (!study || !discipline) return <Navigate to="/estudos" replace />;

    const linkedExercises = linkedExercisesForDiscipline(store, study.id, discipline.id);

    return (
        <section id="estudos-page" className="page active estudos-page estudos-page--workspace">
            <div className="estudos-workspace-shell">
                <nav className="estudos-breadcrumb estudos-workspace-shell__crumb" aria-label="Trilha">
                    <Link to="/estudos">Estudos</Link>
                    <MaterialIcon name="chevron_right" variant="app" />
                    <Link to={`/estudos/${study.id}`}>{study.title}</Link>
                    <MaterialIcon name="chevron_right" variant="app" />
                    <span>{discipline.title}</span>
                </nav>

                <DisciplinaOverview
                    discipline={discipline}
                    layout="strip"
                    studyId={study.id}
                    linkedExercises={linkedExercises}
                />

                <StudyNotesCanvas
                    html={discipline.notesHtml}
                    updatedAt={discipline.notesUpdatedAt}
                    onSave={(html) => updateDisciplineNotes(discipline.id, html)}
                />
            </div>
        </section>
    );
}