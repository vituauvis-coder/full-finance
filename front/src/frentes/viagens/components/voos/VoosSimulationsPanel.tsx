import { useMemo, useState } from 'react';
import {
    duplicateFlightSimulation,
    emptyFlightSimulation,
    nextFlightStatus,
    normalizeFlightSegment,
    tripFlightSegments
} from '@motor/viagens/flight-simulation.js';
import { cheapestOptionId, chosenDayTotal, optionScore } from '@motor/viagens/flight-ledger.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatBRL } from '../../utils/map-utils';
import type { MilesProgram } from '../../pages/pontos/pontos-format';
import type { TripDestination, TripFlightSegment, TripFlightSimulation, TripPayload } from '../../types';
import { FlightEditorModal } from './FlightEditorModal';
import { FlightSimCard } from './FlightSimCard';

type Props = {
    tripId: string;
    payload: TripPayload;
    destinations: TripDestination[];
    tripStartsOn?: string;
    tripEndsOn?: string;
    programsForLedger: MilesProgram[];
    onChangeSegments: (segments: TripFlightSegment[]) => void;
};

type EditTarget = { segmentId: string; simulationId: string };

function flightLetter(index: number) {
    let n = index;
    let out = '';
    do {
        out = String.fromCharCode(65 + (n % 26)) + out;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return out;
}

function asSegments(payload: TripPayload): TripFlightSegment[] {
    return tripFlightSegments(payload) as TripFlightSegment[];
}

export function VoosSimulationsPanel({
    tripId,
    payload,
    destinations,
    tripStartsOn,
    tripEndsOn,
    programsForLedger,
    onChangeSegments
}: Props) {
    const segments = asSegments(payload);
    const [editing, setEditing] = useState<EditTarget | null>(null);
    const [showDiscarded, setShowDiscarded] = useState<Record<string, boolean>>({});
    const [undo, setUndo] = useState<{ segmentId: string; simulation: TripFlightSimulation; index: number } | null>(
        null
    );

    const dayTotal = useMemo(
        () => chosenDayTotal(segments.flatMap((s) => s.simulations), programsForLedger),
        [segments, programsForLedger]
    );

    const editingSim = editing
        ? segments.find((s) => s.id === editing.segmentId)?.simulations.find((x) => x.id === editing.simulationId) ??
          null
        : null;

    function commit(next: TripFlightSegment[]) {
        onChangeSegments(next.map((s) => normalizeFlightSegment(s) as TripFlightSegment));
    }

    function patchSegment(id: string, patch: Partial<TripFlightSegment> | ((seg: TripFlightSegment) => TripFlightSegment)) {
        commit(
            segments.map((s) => {
                if (s.id !== id) return s;
                return typeof patch === 'function' ? patch(s) : { ...s, ...patch };
            })
        );
    }

    function addSegment() {
        commit([
            ...segments,
            normalizeFlightSegment({
                id: crypto.randomUUID(),
                title: `Trecho ${segments.length + 1}`,
                simulations: []
            }) as TripFlightSegment
        ]);
    }

    function addVoo(segmentId?: string) {
        if (!segmentId && segments.length === 0) {
            const sim = emptyFlightSimulation() as TripFlightSimulation;
            const seg = normalizeFlightSegment({
                id: crypto.randomUUID(),
                title: 'Trecho 1',
                simulations: [sim]
            }) as TripFlightSegment;
            commit([seg]);
            setEditing({ segmentId: seg.id, simulationId: sim.id });
            return;
        }
        addSimulation(segmentId ?? segments[0].id);
    }

    function addSimulation(segmentId: string) {
        const sim = emptyFlightSimulation() as TripFlightSimulation;
        if (destinations.filter((d) => !d.isPrincipal).length === 1) {
            sim.tripDestinationId = destinations.find((d) => !d.isPrincipal)?.id ?? null;
        }
        patchSegment(segmentId, (seg) => ({ ...seg, simulations: [...seg.simulations, sim] }));
        setEditing({ segmentId, simulationId: sim.id });
    }

    function patchSimulation(segmentId: string, simulationId: string, next: TripFlightSimulation) {
        patchSegment(segmentId, (seg) => ({
            ...seg,
            simulations: seg.simulations.map((s) => (s.id === simulationId ? next : s))
        }));
    }

    function chooseSimulation(segmentId: string, simulationId: string) {
        patchSegment(segmentId, (seg) => ({
            ...seg,
            simulations: seg.simulations.map((s) => {
                if (s.id === simulationId) {
                    return { ...s, status: s.status === 'escolhida' ? 'candidata' : 'escolhida' };
                }
                if (s.status === 'escolhida') return { ...s, status: 'candidata' };
                return s;
            })
        }));
    }

    function removeSimulation(segmentId: string, simulationId: string) {
        const seg = segments.find((s) => s.id === segmentId);
        if (!seg) return;
        const index = seg.simulations.findIndex((s) => s.id === simulationId);
        const simulation = seg.simulations[index];
        if (!simulation) return;
        setUndo({ segmentId, simulation, index });
        patchSegment(segmentId, {
            simulations: seg.simulations.filter((s) => s.id !== simulationId)
        });
        if (editing?.simulationId === simulationId) setEditing(null);
    }

    const compact = segments.length <= 1;

    return (
        <div className="voos-board">
            <header className="voos-board__head">
                <div>
                    <p className="pontos-kicker">Lista</p>
                    <h2>Voos desta viagem</h2>
                </div>
                {segments.length === 0 ? (
                    <button type="button" className="voos-add-segment" onClick={() => addVoo()}>
                        + Novo voo
                    </button>
                ) : null}
            </header>

            {segments.length === 0 ? (
                <div className="voos-empty voos-empty--board">
                    <span className="voos-empty__icon" aria-hidden>
                        <MaterialIcon name="flight_takeoff" variant="app" opticalSize={32} />
                    </span>
                    <p>Nenhum voo nesta viagem.</p>
                    <p>
                        Cada opção guarda trecho, datas, pessoas e a simulação em milhas e dinheiro — com o custo do
                        dia em reais.
                    </p>
                </div>
            ) : (
                segments.map((segment) => {
                    const rank = { escolhida: 0, candidata: 1, descartada: 2 } as Record<string, number>;
                    const sorted = [...segment.simulations].sort((a, b) => {
                        const r = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
                        if (r) return r;
                        const left = optionScore(a, programsForLedger) ?? Number.POSITIVE_INFINITY;
                        const right = optionScore(b, programsForLedger) ?? Number.POSITIVE_INFINITY;
                        return left - right;
                    }) as TripFlightSimulation[];
                    const active = sorted.filter((s) => s.status !== 'descartada');
                    const discarded = sorted.filter((s) => s.status === 'descartada');
                    const cheapestId = cheapestOptionId(active, programsForLedger);
                    const cheapestSim = active.find((s) => s.id === cheapestId);
                    const cheapestScore = cheapestSim ? optionScore(cheapestSim, programsForLedger) : null;
                    const letters = new Map(
                        segment.simulations.map((sim, index) => [sim.id, flightLetter(index)] as const)
                    );
                    const cheapestMark = cheapestSim ? letters.get(cheapestSim.id) : null;
                    const openDiscarded = !!showDiscarded[segment.id];
                    return (
                        <section key={segment.id} className={`voos-segment${compact ? ' voos-segment--solo' : ''}`}>
                            <header className="voos-segment__head">
                                <span className="voos-segment__plane" aria-hidden>
                                    <MaterialIcon name="flight" variant="app" opticalSize={18} />
                                </span>
                                <input
                                    className="viagens-field voos-segment__title"
                                    value={segment.title}
                                    aria-label="Nome do trecho"
                                    onChange={(e) => patchSegment(segment.id, { title: e.target.value })}
                                />
                                <p className="voos-segment__best">
                                    <span>Melhor custo</span>
                                    {cheapestMark ? <b>Voo {cheapestMark}</b> : null}
                                    <strong>
                                        {cheapestScore != null ? formatBRL(cheapestScore) : '—'}
                                    </strong>
                                </p>
                                <div className="voos-segment__tools">
                                    <button
                                        type="button"
                                        className="voos-icon-btn voos-icon-btn--oceano"
                                        title="Novo voo neste trecho"
                                        aria-label="Novo voo neste trecho"
                                        onClick={() => addVoo(segment.id)}
                                    >
                                        <MaterialIcon name="add" variant="app" opticalSize={18} />
                                    </button>
                                    <button
                                        type="button"
                                        className="voos-icon-btn voos-icon-btn--coral"
                                        title="Remover trecho"
                                        aria-label="Remover trecho"
                                        onClick={() => {
                                            if (window.confirm('Apagar o trecho aéreo inteiro?')) {
                                                commit(segments.filter((s) => s.id !== segment.id));
                                            }
                                        }}
                                    >
                                        <MaterialIcon name="delete" variant="app" opticalSize={16} />
                                    </button>
                                </div>
                            </header>

                            {segment.simulations.length === 0 ? (
                                <p className="voos-muted">Nenhum voo neste trecho.</p>
                            ) : (
                                <>
                                    <div className="voos-sim-row">
                                        {active.map((sim) => (
                                            <FlightSimCard
                                                key={sim.id}
                                                simulation={sim}
                                                programs={programsForLedger}
                                                mark={letters.get(sim.id)}
                                                isCheapest={cheapestId === sim.id}
                                                onChange={(next) => patchSimulation(segment.id, sim.id, next)}
                                                onEdit={() => setEditing({ segmentId: segment.id, simulationId: sim.id })}
                                                onChoose={() => chooseSimulation(segment.id, sim.id)}
                                                onCycleStatus={() =>
                                                    patchSimulation(segment.id, sim.id, {
                                                        ...sim,
                                                        status: nextFlightStatus(sim.status)
                                                    })
                                                }
                                                onDuplicate={() =>
                                                    patchSegment(segment.id, {
                                                        simulations: [
                                                            ...segment.simulations,
                                                            duplicateFlightSimulation(sim) as TripFlightSimulation
                                                        ]
                                                    })
                                                }
                                                onDelete={() => removeSimulation(segment.id, sim.id)}
                                            />
                                        ))}
                                    </div>
                                    {discarded.length > 0 ? (
                                        <div className="voos-discarded">
                                            <button
                                                type="button"
                                                className="voos-text-btn"
                                                onClick={() =>
                                                    setShowDiscarded((m) => ({ ...m, [segment.id]: !openDiscarded }))
                                                }
                                            >
                                                {openDiscarded ? '▾' : '▸'} Descartados ({discarded.length})
                                            </button>
                                            {openDiscarded
                                                ? discarded.map((sim) => (
                                                      <FlightSimCard
                                                          key={sim.id}
                                                          layout="list"
                                                          simulation={sim}
                                                          programs={programsForLedger}
                                                          mark={letters.get(sim.id)}
                                                          isCheapest={false}
                                                          onChange={(next) => patchSimulation(segment.id, sim.id, next)}
                                                          onEdit={() =>
                                                              setEditing({
                                                                  segmentId: segment.id,
                                                                  simulationId: sim.id
                                                              })
                                                          }
                                                          onChoose={() => chooseSimulation(segment.id, sim.id)}
                                                          onCycleStatus={() =>
                                                              patchSimulation(segment.id, sim.id, {
                                                                  ...sim,
                                                                  status: nextFlightStatus(sim.status)
                                                              })
                                                          }
                                                          onDuplicate={() =>
                                                              patchSegment(segment.id, {
                                                                  simulations: [
                                                                      ...segment.simulations,
                                                                      duplicateFlightSimulation(sim) as TripFlightSimulation
                                                                  ]
                                                              })
                                                          }
                                                          onDelete={() => removeSimulation(segment.id, sim.id)}
                                                      />
                                                  ))
                                                : null}
                                        </div>
                                    ) : null}
                                </>
                            )}

                        </section>
                    );
                })
            )}

            {segments.length > 0 ? (
                <div className="voos-sims__foot">
                    <button type="button" className="voos-text-btn" onClick={addSegment}>
                        + Novo trecho aéreo
                    </button>
                    {dayTotal.total > 0 ? (
                        <p className="voos-muted">
                            Registrados · custo do dia {formatBRL(dayTotal.total)}
                            {dayTotal.club > 0
                                ? ` · voos ${formatBRL(dayTotal.flights)} + clube ${formatBRL(dayTotal.club)}`
                                : ''}
                        </p>
                    ) : null}
                </div>
            ) : null}

            {undo ? (
                <div className="voos-undo">
                    <span>Removido: {undo.simulation.label || 'voo'}</span>
                    <button
                        type="button"
                        className="voos-text-btn"
                        onClick={() => {
                            const seg = segments.find((s) => s.id === undo.segmentId);
                            if (seg) {
                                const next = [...seg.simulations];
                                next.splice(Math.min(undo.index, next.length), 0, undo.simulation);
                                patchSegment(undo.segmentId, { simulations: next });
                            }
                            setUndo(null);
                        }}
                    >
                        Desfazer
                    </button>
                </div>
            ) : null}

            <FlightEditorModal
                open={!!editingSim}
                tripId={tripId}
                simulation={editingSim}
                destinations={destinations}
                tripStartsOn={tripStartsOn}
                tripEndsOn={tripEndsOn}
                onClose={() => setEditing(null)}
                onChange={(next) => {
                    if (!editing) return;
                    patchSimulation(editing.segmentId, editing.simulationId, next);
                }}
                onDelete={() => {
                    if (!editing) return;
                    if (window.confirm('Apagar este voo?')) {
                        removeSimulation(editing.segmentId, editing.simulationId);
                    }
                }}
            />
        </div>
    );
}
