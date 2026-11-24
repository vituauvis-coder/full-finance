import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { StudyDiscipline } from '../types';

type Props = {
    studyId: string;
    discipline: StudyDiscipline;
};

export function DisciplinaListItem({ studyId, discipline }: Props) {
    return (
        <Link to={`/estudos/${studyId}/disciplinas/${discipline.id}`} className="estudos-disciplina-row estudos-disciplina-row--card">
            <div className="estudos-disciplina-row__top">
                <span className="estudos-disciplina-row__icon" aria-hidden="true">
                    <MaterialIcon name="auto_stories" variant="app" />
                </span>
                <div className="estudos-disciplina-row__body">
                    <span className="estudos-disciplina-row__kind">Disciplina</span>
                    <span className="estudos-disciplina-row__title">{discipline.title}</span>
                    {discipline.summary ? (
                        <p className="estudos-disciplina-row__summary">{discipline.summary}</p>
                    ) : (
                        <p className="estudos-disciplina-row__summary estudos-disciplina-row__summary--muted">
                            Abrir caderno e materiais
                        </p>
                    )}
                </div>
                <MaterialIcon name="north_east" variant="app" className="estudos-disciplina-row__open" />
            </div>
            <footer className="estudos-disciplina-row__foot">
                <div
                    className="estudos-mini-bar estudos-mini-bar--wide"
                    role="progressbar"
                    aria-valuenow={discipline.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <div className="estudos-mini-bar__fill" style={{ width: `${discipline.progress}%` }} />
                </div>
                <span className="estudos-disciplina-row__progress">{discipline.progress}%</span>
            </footer>
        </Link>
    );
}