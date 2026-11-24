import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { exerciseTypeLabel, parseExerciseDoc } from '../domain/exerciseDoc';
import type { StudyDiscipline, StudyExercise, StudyResourceLink } from '../types';
import { updateDisciplineProgress } from '../domain/estudosStorage';

type Props = {
    discipline: StudyDiscipline;
    layout?: 'card' | 'strip';
    studyId?: string;
    linkedExercises?: StudyExercise[];
};

function resourceIcon(kind: StudyResourceLink['kind']) {
    if (kind === 'video') return 'play_circle';
    if (kind === 'arquivo') return 'attach_file';
    return 'link';
}

function exerciseIcon(notesHtml: string): string {
    const doc = parseExerciseDoc(notesHtml);
    if (doc?.type === 'flashcards') return 'style';
    if (doc?.type === 'quiz') return 'quiz';
    return 'fitness_center';
}

export function DisciplinaOverview({ discipline, layout = 'card', studyId, linkedExercises = [] }: Props) {
    const resources = discipline.resources.length === 0 ? (
        <p className="estudos-overview__empty">Nenhum link cadastrado.</p>
    ) : (
        <ul className="estudos-overview__resource-list">
            {discipline.resources.map((r) => (
                <li key={r.id}>
                    <a
                        href={r.url}
                        target={r.url.startsWith('http') ? '_blank' : undefined}
                        rel={r.url.startsWith('http') ? 'noreferrer' : undefined}
                        className="estudos-resource-link"
                    >
                        <MaterialIcon name={resourceIcon(r.kind)} variant="app" />
                        <span>{r.title}</span>
                    </a>
                </li>
            ))}
        </ul>
    );

    const exerciseTags =
        studyId && linkedExercises.length > 0 ? (
            <div className="estudos-linked-exercises" aria-label="Exercícios vinculados">
                <h3>
                    <MaterialIcon name="fitness_center" variant="app" />
                    Exercícios
                </h3>
                <div className="estudos-linked-exercises__tags">
                    {linkedExercises.map((ex) => {
                        const doc = parseExerciseDoc(ex.notesHtml);
                        const sub = doc ? exerciseTypeLabel(doc.type) : undefined;
                        return (
                            <Link
                                key={ex.id}
                                to={`/estudos/${studyId}/exercicios/${ex.id}`}
                                className="estudos-link-chip estudos-link-chip--tag"
                            >
                                <MaterialIcon name={exerciseIcon(ex.notesHtml)} variant="app" />
                                <span className="estudos-linked-exercises__tag-title">{ex.title}</span>
                                {sub ? <span className="estudos-linked-exercises__tag-sub">{sub}</span> : null}
                            </Link>
                        );
                    })}
                </div>
            </div>
        ) : null;

    const progressBlock = (
        <div className="estudos-overview__progress">
            <label className="estudos-overview__progress-label" htmlFor={`prog-${discipline.id}`}>
                Andamento
            </label>
            <div className="estudos-overview__progress-row">
                <input
                    id={`prog-${discipline.id}`}
                    type="range"
                    min={0}
                    max={100}
                    value={discipline.progress}
                    onChange={(e) => updateDisciplineProgress(discipline.id, Number(e.target.value))}
                />
                <span className="estudos-overview__progress-value">{discipline.progress}%</span>
            </div>
        </div>
    );

    if (layout === 'strip') {
        return (
            <section className="estudos-overview estudos-overview--strip estudos-overview--integrated" aria-label="Visão geral">
                <header className="estudos-overview__head estudos-overview__head--inline">
                    <h2>{discipline.title}</h2>
                    <p>{discipline.summary || 'Sem resumo cadastrado.'}</p>
                </header>
                <div className="estudos-overview__strip-divider" aria-hidden="true" />
                {progressBlock}
                {exerciseTags ? (
                    <>
                        <div className="estudos-overview__strip-divider" aria-hidden="true" />
                        {exerciseTags}
                    </>
                ) : null}
                <div className="estudos-overview__strip-divider" aria-hidden="true" />
                <div className="estudos-overview__strip-resources">
                    <h3>
                        <MaterialIcon name="video_library" variant="app" />
                        Materiais
                    </h3>
                    {resources}
                </div>
            </section>
        );
    }

    return (
        <section className="estudos-overview" aria-label="Visão geral">
            <header className="estudos-overview__head">
                <h2>{discipline.title}</h2>
                <p>{discipline.summary || 'Sem resumo cadastrado.'}</p>
            </header>
            {progressBlock}
            {exerciseTags}
            <div className="estudos-overview__resources">
                <h3>
                    <MaterialIcon name="video_library" variant="app" />
                    Vídeo-aulas e materiais
                </h3>
                {resources}
            </div>
        </section>
    );
}