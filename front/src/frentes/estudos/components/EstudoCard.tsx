import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { StudyDiscipline, StudyProgram } from '../types';
import { completedDisciplineCount, studyProgress } from '../domain/estudosStorage';
import { formatStudyDate, studyLevelLabel, studyStatusLabel } from '../domain/estudosLabels';

type Props = {
    study: StudyProgram;
    disciplines: StudyDiscipline[];
};

export function EstudoCard({ study, disciplines }: Props) {
    const navigate = useNavigate();
    const progress = studyProgress(study, disciplines);
    const done = completedDisciplineCount(study, disciplines);
    const total = study.disciplineIds.length;
    const target = formatStudyDate(study.targetDate);

    return (
        <button
            type="button"
            className="estudos-card"
            data-status={study.status}
            onClick={() => navigate(`/estudos/${study.id}`)}
            aria-label={`Abrir ${study.title}`}
        >
            <div className="estudos-card__head">
                <div className="estudos-card__icon" aria-hidden="true">
                    <MaterialIcon name={study.icon} variant="app" />
                </div>
                <h2 className="estudos-card__title">{study.title}</h2>
                <div className="estudos-card__progress-meta">
                    <span className="estudos-card__progress-value">{progress}%</span>
                    <span className="estudos-card__progress-label">progresso</span>
                </div>
            </div>

            <div className="estudos-card__badges">
                <span className="estudos-badge estudos-badge--level">
                    <MaterialIcon name="account_balance" variant="app" />
                    {studyLevelLabel(study.level)}
                </span>
                <span className={`estudos-badge estudos-badge--status estudos-badge--status-${study.status}`}>
                    <MaterialIcon
                        name={study.status === 'concluido' ? 'check_circle' : 'play_circle'}
                        variant="app"
                    />
                    {studyStatusLabel(study.status)}
                </span>
                {target ? (
                    <span className="estudos-badge estudos-badge--date">
                        <MaterialIcon name="event" variant="app" />
                        {target}
                    </span>
                ) : null}
            </div>

            <div className="estudos-card__bar-wrap">
                <div
                    className="estudos-card__bar"
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <div className="estudos-card__bar-fill" style={{ width: `${progress}%` }} />
                    <span className="estudos-card__bar-knob" style={{ left: `${progress}%` }} aria-hidden="true" />
                </div>
            </div>

            <div className="estudos-card__foot">
                <span className="estudos-card__institution">
                    <MaterialIcon name="domain" variant="app" />
                    {study.institution || 'Sem instituição'}
                </span>
                <span className="estudos-card__disciplines">
                    <MaterialIcon name="menu_book" variant="app" />
                    {done}/{total} disciplinas
                </span>
            </div>
        </button>
    );
}