import { useEffect, useState } from 'react';
import { snapshotScenario } from '../api/trips';
import type { TripDraft } from './ViagemFicha';
import type { TripPayload } from '../types';

type SnapshotRow = {
    scenarioId?: string;
    name?: string;
    tourism?: { tourismDays?: number };
    vacation?: { consumedDays?: number };
};

type Props = {
    draft: TripDraft;
    scenarioWinnerId: string | null;
    onClose: () => void;
    onDraftChange: (draft: TripDraft) => void;
};

function scenarioList(payload: TripPayload) {
    return payload.time_scenarios ?? payload.timeScenarios ?? [];
}

export function TripSimuladorOverlay({ draft, scenarioWinnerId, onClose, onDraftChange }: Props) {
    const scenarios = scenarioList(draft.payload);
    const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
    const [winnerId, setWinnerId] = useState<string | null>(scenarioWinnerId);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoadError(null);
        void (async () => {
            try {
                const res = (await snapshotScenario({
                    scenarios,
                    criteria: draft.payload.scenario_criteria ?? draft.payload.scenarioCriteria ?? []
                })) as { snapshots?: SnapshotRow[]; winnerId?: string | null };
                if (cancelled) return;
                setSnapshots(res.snapshots ?? []);
                setWinnerId(res.winnerId ?? scenarioWinnerId);
            } catch (e) {
                if (!cancelled) {
                    setLoadError(e instanceof Error ? e.message : 'Falha ao calcular cenários');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [scenarios, draft.payload.scenario_criteria, draft.payload.scenarioCriteria, scenarioWinnerId]);

    function addScenario() {
        const id = crypto.randomUUID();
        const next: TripDraft = {
            ...draft,
            payload: {
                ...draft.payload,
                time_scenarios: [
                    ...scenarioList(draft.payload),
                    {
                        id,
                        title: `Cenário ${String.fromCharCode(65 + scenarioList(draft.payload).length)}`,
                        hops: []
                    }
                ]
            }
        };
        onDraftChange(next);
    }

    return (
        <div className="viagens-simulador-overlay" role="dialog" aria-modal="true" aria-labelledby="viagens-sim-title">
            <div className="viagens-simulador">
                <header className="viagens-simulador__head">
                    <h2 id="viagens-sim-title">Simulador</h2>
                    <p className="viagens-muted">Compare férias, rota e o que cada cenário visita</p>
                    <button type="button" className="viagens-btn viagens-btn--ghost" onClick={onClose}>
                        Fechar
                    </button>
                </header>
                <div className="viagens-simulador__grid">
                    <aside className="viagens-sim-list">
                        <button type="button" className="viagens-btn viagens-btn--coral" onClick={addScenario}>
                            + Novo
                        </button>
                        {scenarios.map((sc, i) => (
                            <div key={sc.id} className="viagens-sim-card-btn" data-sc-id={sc.id}>
                                <strong>{sc.title ?? `Cenário ${String.fromCharCode(65 + i)}`}</strong>
                            </div>
                        ))}
                    </aside>
                    <main className="viagens-sim-detail">
                        <p className="viagens-muted">Vencedor atual: {winnerId ?? scenarioWinnerId ?? '—'}</p>
                        {loadError ? <p role="alert">{loadError}</p> : null}
                        {!loadError
                            ? snapshots.map((sn) => (
                                  <div key={sn.scenarioId ?? sn.name} className="viagens-sim-snap">
                                      <h4>{sn.name ?? sn.scenarioId}</h4>
                                      <p>
                                          Turismo: {sn.tourism?.tourismDays ?? '—'}d · Férias:{' '}
                                          {sn.vacation?.consumedDays ?? '—'}d
                                      </p>
                                      {sn.scenarioId === winnerId ? (
                                          <span className="viagens-stamp viagens-stamp--planejada">★ Vencedor</span>
                                      ) : null}
                                  </div>
                              ))
                            : null}
                    </main>
                </div>
            </div>
        </div>
    );
}