import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { DisciplinaListItem } from '../components/DisciplinaListItem';
import { ExercicioListItem } from '../components/ExercicioListItem';
import { NovoExercicioModal } from '../components/NovoExercicioModal';
import { VincularExercicioModal } from '../components/VincularExercicioModal';
import type { ExerciseType } from '../domain/exerciseDoc';
import {
    appendDiscipline,
    appendExercise,
    disciplinesForStudy,
    exercisesForStudy,
    studyProgress,
    updateExerciseLinks
} from '../domain/estudosStorage';
import { formatStudyDate, studyLevelLabel, studyStatusLabel } from '../domain/estudosLabels';
import { useEstudosStore } from '../hooks/useEstudosStore';
import type { StudyExercise } from '../types';
import '../../dashboard/styles/dashboard-tokens.css';
import '../styles/estudos.css';

type FichaTab = 'disciplinas' | 'exercicios';

export function EstudoFichaPage() {
    const { studyId } = useParams<{ studyId: string }>();
    const store = useEstudosStore();
    const navigate = useNavigate();

    const study = store.studies.find((s) => s.id === studyId);
    if (!study) return <Navigate to="/estudos" replace />;

    const disciplines = disciplinesForStudy(store, study.id);
    const exercises = exercisesForStudy(store, study.id);
    const progress = studyProgress(study, disciplines);
    const target = formatStudyDate(study.targetDate);
    const doneCount = disciplines.filter((d) => d.progress >= 100).length;
    const [tab, setTab] = useState<FichaTab>('disciplinas');
    const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
    const [linkTarget, setLinkTarget] = useState<StudyExercise | null>(null);

    const addDisciplina = () => {
        const title = window.prompt('Nome da disciplina:');
        if (!title?.trim()) return;
        const created = appendDiscipline(study.id, { title: title.trim() });
        if (created) navigate(`/estudos/${study.id}/disciplinas/${created.id}`);
    };

    const createExercise = (input: {
        title: string;
        type: ExerciseType;
        linkToAll: boolean;
        linkedDisciplineIds: string[];
    }) => {
        const created = appendExercise(study.id, input);
        setExerciseModalOpen(false);
        setTab('exercicios');
        if (created) navigate(`/estudos/${study.id}/exercicios/${created.id}`);
    };

    const saveLinks = (links: { linkToAll: boolean; linkedDisciplineIds: string[] }) => {
        if (!linkTarget) return;
        updateExerciseLinks(linkTarget.id, links);
        setLinkTarget(null);
    };

    const emptyCourse = disciplines.length === 0 && exercises.length === 0;

    return (
        <section id="estudos-page" className="page active estudos-page estudos-page--ficha">
            <div className="estudos-page__inner estudos-page__inner--ficha">
                <nav className="estudos-breadcrumb estudos-ficha-breadcrumb" aria-label="Trilha">
                    <Link to="/estudos">Estudos</Link>
                    <MaterialIcon name="chevron_right" variant="app" />
                    <span>{study.title}</span>
                </nav>

                <header className="estudos-ficha-hero estudos-ficha-hero--modern">
                    <div className="estudos-ficha-hero__main">
                        <div className="estudos-ficha-hero__brand">
                            <div className="estudos-ficha-hero__icon">
                                <MaterialIcon name={study.icon} variant="app" />
                            </div>
                            <div className="estudos-ficha-hero__copy">
                                <h1>{study.title}</h1>
                                <div className="estudos-ficha-hero__chips" aria-label="Metadados do curso">
                                    <span className="estudos-ficha-chip">{studyLevelLabel(study.level)}</span>
                                    <span
                                        className={`estudos-ficha-chip estudos-ficha-chip--status estudos-ficha-chip--${study.status}`}
                                    >
                                        {studyStatusLabel(study.status)}
                                    </span>
                                    {target ? <span className="estudos-ficha-chip">{target}</span> : null}
                                </div>
                                <p className="estudos-ficha-hero__institution">
                                    <MaterialIcon name="domain" variant="app" />
                                    {study.institution || 'Instituição não informada'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <aside className="estudos-ficha-hero__aside" aria-label="Progresso e resumo">
                        {disciplines.length > 0 ? (
                            <div className="estudos-ficha-mini-metrics">
                                <div className="estudos-ficha-metric">
                                    <MaterialIcon name="auto_stories" variant="app" />
                                    <span className="estudos-ficha-metric__value">{disciplines.length}</span>
                                    <span className="estudos-ficha-metric__label">disciplinas</span>
                                </div>
                                <div className="estudos-ficha-metric">
                                    <MaterialIcon name="task_alt" variant="app" />
                                    <span className="estudos-ficha-metric__value">{doneCount}</span>
                                    <span className="estudos-ficha-metric__label">concluídas</span>
                                </div>
                                <div className="estudos-ficha-metric">
                                    <MaterialIcon name="fitness_center" variant="app" />
                                    <span className="estudos-ficha-metric__value">{exercises.length}</span>
                                    <span className="estudos-ficha-metric__label">exercícios</span>
                                </div>
                            </div>
                        ) : null}
                        <div
                            className="estudos-ficha-hero__ring"
                            style={{ ['--estudos-ficha-progress' as string]: `${progress}` }}
                            role="img"
                            aria-label={`Progresso geral ${progress}%`}
                        >
                            <div className="estudos-ficha-hero__ring-inner">
                                <span className="estudos-ficha-hero__ring-value">{progress}%</span>
                                <span className="estudos-ficha-hero__ring-label">geral</span>
                            </div>
                        </div>
                    </aside>
                </header>

                {emptyCourse ? (
                    <section className="estudos-disciplina-list estudos-disciplina-list--ficha" aria-label="Conteúdo do curso">
                        <div className="estudos-ficha-empty">
                            <MaterialIcon name="menu_book" variant="app" />
                            <p>Nenhuma disciplina nem exercício ainda.</p>
                            <div className="estudos-ficha-empty__actions">
                                <button type="button" className="estudos-btn-primary" onClick={addDisciplina}>
                                    Criar disciplina
                                </button>
                                <button type="button" className="estudos-btn-ghost" onClick={() => setExerciseModalOpen(true)}>
                                    Criar exercício
                                </button>
                            </div>
                        </div>
                    </section>
                ) : (
                    <div className="estudos-ficha-panel">
                        <div className="estudos-ficha-tabs" role="tablist" aria-label="Conteúdo do curso">
                            <button
                                type="button"
                                role="tab"
                                id="ficha-tab-disciplinas"
                                aria-selected={tab === 'disciplinas'}
                                aria-controls="ficha-panel-disciplinas"
                                className={`estudos-ficha-tab${tab === 'disciplinas' ? ' estudos-ficha-tab--active' : ''}`}
                                onClick={() => setTab('disciplinas')}
                            >
                                <MaterialIcon name="auto_stories" variant="app" />
                                Disciplinas
                                <span className="estudos-ficha-tab__count">{disciplines.length}</span>
                            </button>
                            <button
                                type="button"
                                role="tab"
                                id="ficha-tab-exercicios"
                                aria-selected={tab === 'exercicios'}
                                aria-controls="ficha-panel-exercicios"
                                className={`estudos-ficha-tab${tab === 'exercicios' ? ' estudos-ficha-tab--active' : ''}`}
                                onClick={() => setTab('exercicios')}
                            >
                                <MaterialIcon name="fitness_center" variant="app" />
                                Exercícios
                                <span className="estudos-ficha-tab__count">{exercises.length}</span>
                            </button>
                        </div>

                        {tab === 'disciplinas' ? (
                            <section
                                id="ficha-panel-disciplinas"
                                role="tabpanel"
                                aria-labelledby="ficha-tab-disciplinas"
                                className="estudos-disciplina-list estudos-disciplina-list--ficha"
                            >
                                <header className="estudos-ficha-tab-toolbar">
                                    <p className="estudos-ficha-tab-toolbar__lead">Caderno, materiais e andamento por matéria.</p>
                                    <button type="button" className="estudos-btn-primary estudos-ficha-btn" onClick={addDisciplina}>
                                        <MaterialIcon name="add" variant="app" />
                                        Nova disciplina
                                    </button>
                                </header>
                                {disciplines.length === 0 ? (
                                    <div className="estudos-ficha-tab-empty">
                                        <MaterialIcon name="auto_stories" variant="app" />
                                        <p>Nenhuma disciplina ainda.</p>
                                        <button type="button" className="estudos-btn-primary" onClick={addDisciplina}>
                                            Adicionar primeira disciplina
                                        </button>
                                    </div>
                                ) : (
                                    <div className="estudos-disciplina-list__items">
                                        {disciplines.map((d) => (
                                            <DisciplinaListItem key={d.id} studyId={study.id} discipline={d} />
                                        ))}
                                    </div>
                                )}
                            </section>
                        ) : (
                            <section
                                id="ficha-panel-exercicios"
                                role="tabpanel"
                                aria-labelledby="ficha-tab-exercicios"
                                className="estudos-disciplina-list estudos-disciplina-list--ficha"
                            >
                                <header className="estudos-ficha-tab-toolbar">
                                    <p className="estudos-ficha-tab-toolbar__lead">Quiz e flashcards — vincule às disciplinas para atalhos.</p>
                                    <button
                                        type="button"
                                        className="estudos-btn-primary estudos-ficha-btn"
                                        onClick={() => setExerciseModalOpen(true)}
                                    >
                                        <MaterialIcon name="add" variant="app" />
                                        Novo exercício
                                    </button>
                                </header>
                                {exercises.length === 0 ? (
                                    <div className="estudos-ficha-tab-empty">
                                        <MaterialIcon name="fitness_center" variant="app" />
                                        <p>Nenhum exercício ainda.</p>
                                        <button type="button" className="estudos-btn-primary" onClick={() => setExerciseModalOpen(true)}>
                                            Criar quiz ou flashcards
                                        </button>
                                    </div>
                                ) : (
                                    <div className="estudos-disciplina-list__items">
                                        {exercises.map((ex) => (
                                            <ExercicioListItem
                                                key={ex.id}
                                                studyId={study.id}
                                                exercise={ex}
                                                disciplines={disciplines}
                                                onEditLinks={() => setLinkTarget(ex)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}
                    </div>
                )}
            </div>

            <NovoExercicioModal
                open={exerciseModalOpen}
                disciplines={disciplines}
                onClose={() => setExerciseModalOpen(false)}
                onCreate={createExercise}
            />

            <VincularExercicioModal
                open={Boolean(linkTarget)}
                exercise={linkTarget}
                disciplines={disciplines}
                onClose={() => setLinkTarget(null)}
                onSave={saveLinks}
            />
        </section>
    );
}