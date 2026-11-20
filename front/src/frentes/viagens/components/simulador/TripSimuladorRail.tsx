import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import {
    activeCriteria,
    isCompactMetric,
    metricDisplay,
    metricTint,
    type ScenarioCriterion,
    type ScenarioSnapshot
} from '../../domain/tripScenarioCriteria';
import { scenarioDisplayName } from '../../domain/tripTimeScenario';
import type { TripTimeScenario } from '../../types';

type Props = {
    scenarios: TripTimeScenario[];
    snapshots: ScenarioSnapshot[];
    activeId: string | null;
    winnerId: string | null;
    criteria: ScenarioCriterion[];
    onSelect: (id: string) => void;
    onAdd: () => void;
    onOpenCriteria: () => void;
};

export function TripSimuladorRail({
    scenarios,
    snapshots,
    activeId,
    winnerId,
    criteria,
    onSelect,
    onAdd,
    onOpenCriteria
}: Props) {
    const resolved = activeCriteria(criteria);

    return (
        <aside className="viagens-sim-rail" aria-label="Cenários">
            <h3 className="viagens-sim-rail__title">Cenários</h3>
            <div className="viagens-sim-rail__toolbar">
                <button type="button" className="viagens-sim-rail__novo" onClick={onAdd}>
                    <MaterialIcon name="add" variant="app" opticalSize={14} />
                    Novo
                </button>
                <button type="button" className="viagens-sim-rail__criterios" onClick={onOpenCriteria}>
                    <MaterialIcon name="tune" variant="app" opticalSize={14} />
                    Critérios
                </button>
            </div>
            <div className="viagens-sim-rail__list">
                {snapshots.length === 0 ? (
                    <p className="viagens-muted">Crie um cenário para ver o resumo estratégico aqui.</p>
                ) : (
                    snapshots.map((snap) => {
                        const scIndex = scenarios.findIndex((s) => s.id === snap.scenarioId);
                        const sc = scIndex >= 0 ? scenarios[scIndex] : null;
                        const name = sc ? scenarioDisplayName(sc, scIndex) : snap.name ?? 'Cenário';
                        const selected = snap.scenarioId === (activeId ?? scenarios[0]?.id);
                        const best = snap.scenarioId === winnerId && scenarios.length > 1;
                        const compact = resolved.filter((c) => isCompactMetric(c.metric));
                        const wide = resolved.filter((c) => !isCompactMetric(c.metric));
                        return (
                            <button
                                key={snap.scenarioId}
                                type="button"
                                className={`viagens-sim-eval${selected ? ' viagens-sim-eval--on' : ''}${best ? ' viagens-sim-eval--winner' : ''}`}
                                onClick={() => snap.scenarioId && onSelect(snap.scenarioId)}
                            >
                                <div className="viagens-sim-eval__head">
                                    <strong>{name}</strong>
                                    {best ? <MaterialIcon name="star" variant="app" opticalSize={14} /> : null}
                                </div>
                                <div className="viagens-sim-eval__grid">
                                    {compact.map((c) => (
                                        <div key={c.metric} className={`viagens-sim-eval__kpi viagens-sim-eval__kpi--${metricTint(c.metric)}`}>
                                            <span className="viagens-sim-eval__kpi-value">{metricDisplay(c.metric, snap)}</span>
                                            <span className="viagens-sim-eval__kpi-label">{c.title ?? c.metric}</span>
                                        </div>
                                    ))}
                                </div>
                                {wide.map((c) => (
                                    <div key={c.metric} className={`viagens-sim-eval__wide viagens-sim-eval__kpi--${metricTint(c.metric)}`}>
                                        <span className="viagens-sim-eval__kpi-value">{metricDisplay(c.metric, snap)}</span>
                                        <span className="viagens-sim-eval__kpi-label">{c.title ?? c.metric}</span>
                                    </div>
                                ))}
                            </button>
                        );
                    })
                )}
            </div>
        </aside>
    );
}