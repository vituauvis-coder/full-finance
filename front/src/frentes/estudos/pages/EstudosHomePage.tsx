import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { EstudoCard } from '../components/EstudoCard';
import { appendDiscipline, createStudyDraft, readEstudosStore, writeEstudosStore } from '../domain/estudosStorage';
import { useEstudosStore } from '../hooks/useEstudosStore';
import '../../dashboard/styles/dashboard-tokens.css';
import '../styles/estudos.css';

export function EstudosHomePage() {
    const store = useEstudosStore();
    const navigate = useNavigate();
    const [creating, setCreating] = useState(false);

    const disciplineMap = useMemo(() => {
        return new Map(store.disciplines.map((d) => [d.id, d] as const));
    }, [store.disciplines]);

    const sortedStudies = useMemo(
        () => [...store.studies].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
        [store.studies]
    );

    const addCourse = () => {
        const title = window.prompt('Nome do curso / formação:', 'Novo curso');
        if (title === null) return;
        setCreating(true);
        const { study } = createStudyDraft(title);
        const current = readEstudosStore();
        writeEstudosStore({
            version: 1,
            studies: [...current.studies, study],
            disciplines: current.disciplines,
            exercises: current.exercises ?? []
        });
        appendDiscipline(study.id, { title: 'Primeira disciplina' });
        setCreating(false);
        navigate(`/estudos/${study.id}`);
    };

    return (
        <section id="estudos-page" className="page active estudos-page estudos-page--home">
            <div className="estudos-page__inner estudos-page__inner--home">
                <header className="estudos-hero">
                    <h1 className="estudos-hero__title">Estudos</h1>
                    <button type="button" className="estudos-btn-primary" onClick={addCourse} disabled={creating}>
                        <MaterialIcon name="add" variant="app" />
                        Novo curso
                    </button>
                </header>

                <div className="estudos-home-body">
                    <div className="estudos-card-grid">
                    {sortedStudies.map((study) => {
                        const disciplines = study.disciplineIds
                            .map((id) => disciplineMap.get(id))
                            .filter((d): d is NonNullable<typeof d> => Boolean(d));
                        return <EstudoCard key={study.id} study={study} disciplines={disciplines} />;
                    })}
                    </div>
                </div>
            </div>
        </section>
    );
}