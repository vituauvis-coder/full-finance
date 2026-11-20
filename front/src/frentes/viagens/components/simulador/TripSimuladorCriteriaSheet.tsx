import type { ScenarioCriterion } from '../../domain/tripScenarioCriteria';
import { METRIC_LABELS } from './criteriaLabels';

type Props = {
    open: boolean;
    criteria: ScenarioCriterion[];
    onChange: (next: ScenarioCriterion[]) => void;
    onClose: () => void;
};

const METRICS = Object.keys(METRIC_LABELS);

export function TripSimuladorCriteriaSheet({ open, criteria, onChange, onClose }: Props) {
    if (!open) return null;

    function patchIndex(index: number, partial: Partial<ScenarioCriterion>) {
        const next = criteria.map((c, i) => (i === index ? { ...c, ...partial } : c));
        onChange(next);
    }

    return (
        <div className="viagens-sim-criteria" role="dialog" aria-labelledby="viagens-sim-criteria-title">
            <motionBackdrop onClick={onClose} />
            <div className="viagens-sim-criteria__panel">
                <header>
                    <h3 id="viagens-sim-criteria-title">Critérios</h3>
                    <button type="button" className="viagens-btn viagens-btn--ghost" onClick={onClose}>
                        Fechar
                    </button>
                </header>
                <p className="viagens-muted">Peso de 0 a 5 — 0 desliga o critério na avaliação.</p>
                <ul className="viagens-sim-criteria__list">
                    {criteria.map((c, i) => (
                        <li key={c.id ?? c.metric}>
                            <span>{c.title ?? METRIC_LABELS[c.metric] ?? c.metric}</span>
                            <input
                                type="range"
                                min={0}
                                max={5}
                                value={c.weight}
                                onChange={(e) => patchIndex(i, { weight: Number(e.target.value) })}
                            />
                            <span className="viagens-sim-criteria__weight">{c.weight}</span>
                        </li>
                    ))}
                </ul>
                <button
                    type="button"
                    className="viagens-btn viagens-btn--ghost"
                    onClick={() => {
                        onChange(
                            METRICS.map((metric) => ({
                                id: crypto.randomUUID(),
                                metric,
                                title: METRIC_LABELS[metric],
                                weight: metric === 'months' ? 0 : 3
                            }))
                        );
                    }}
                >
                    Restaurar padrão
                </button>
            </div>
        </div>
    );
}

function motionBackdrop({ onClick }: { onClick: () => void }) {
    return <button type="button" className="viagens-sim-criteria__backdrop" aria-label="Fechar" onClick={onClick} />;
}