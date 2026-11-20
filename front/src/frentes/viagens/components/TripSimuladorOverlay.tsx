import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { snapshot, snapshots, winner } from '@motor/viagens/trip-scenario-engine.js';
import type { TripDraft } from './ViagemFicha';
import { ViagensBackControl } from './ViagensBackControl';
import { TripSimuladorCriteriaSheet } from './simulador/TripSimuladorCriteriaSheet';
import { TripSimuladorDetail } from './simulador/TripSimuladorDetail';
import { TripSimuladorRail } from './simulador/TripSimuladorRail';
import { chosenScenarioSnapshot, tripSummaryFromSnapshot } from '../domain/chosenScenarioResumo';
import { snapshotDayBounds } from '../domain/tripScenarioChosen';
import { resolveCriteria, type ScenarioCriterion, type ScenarioSnapshot } from '../domain/tripScenarioCriteria';
import {
    blankScenario,
    duplicateScenario,
    engineScenarioInput,
    listScenarios,
    normalizeScenario,
    patchScenarioVacationStart,
    scenarioDisplayName
} from '../domain/tripTimeScenario';
import type { TripDestination, TripTimeScenario } from '../types';
import { useAppSidebarInset } from '../hooks/useAppSidebarInset';
import '../styles/viagens-simulador.css';

type Props = {
    draft: TripDraft;
    scenarioWinnerId: string | null;
    onClose: () => void;
    onDraftChange: (draft: TripDraft) => void;
    onFlushSave?: () => void | Promise<void>;
};

const engineScenario = engineScenarioInput;

function patchScenarios(draft: TripDraft, scenarios: TripTimeScenario[]): TripDraft {
    return {
        ...draft,
        payload: {
            ...draft.payload,
            time_scenarios: scenarios,
            timeScenarios: scenarios
        }
    };
}

export function TripSimuladorOverlay({ draft, scenarioWinnerId, onClose, onDraftChange, onFlushSave }: Props) {
    const sidebarInset = useAppSidebarInset();
    const scenarios = listScenarios(draft.payload);
    const segments = draft.payload.flight_segments ?? draft.payload.flightSegments ?? [];
    const destinations = (draft.payload.destinations ?? []) as TripDestination[];
    const criteria = useMemo(
        () => resolveCriteria((draft.payload.scenario_criteria ?? draft.payload.scenarioCriteria) as unknown[] | undefined),
        [draft.payload.scenario_criteria, draft.payload.scenarioCriteria]
    );

    const [activeId, setActiveId] = useState<string | null>(scenarios[0]?.id ?? null);
    const [showCriteria, setShowCriteria] = useState(false);
    const bootstrapped = useRef(false);
    const syncedRef = useRef(false);
    const draftRef = useRef(draft);
    draftRef.current = draft;

    const prepared = useMemo(
        () => scenarios.map((sc) => normalizeScenario(sc, segments, destinations, draft.startsOn)),
        [scenarios, segments, destinations, draft.startsOn]
    );

    useEffect(() => {
        if (syncedRef.current || scenarios.length === 0) return;
        const needsSync = prepared.some((n, i) => {
            const o = scenarios[i];
            if (!o) return false;
            return JSON.stringify(n.hops) !== JSON.stringify(o.hops);
        });
        if (!needsSync) return;
        syncedRef.current = true;
        const merged = prepared.map((n, i) => {
            const o = scenarios[i];
            if (!o?.vacations) return n;
            return { ...n, vacations: o.vacations };
        });
        onDraftChange(patchScenarios(draftRef.current, merged));
    }, [prepared, scenarios, onDraftChange]);

    useEffect(() => {
        if (!activeId && prepared[0]?.id) setActiveId(prepared[0].id);
        if (activeId && !prepared.some((s) => s.id === activeId)) {
            setActiveId(prepared[0]?.id ?? null);
        }
    }, [prepared, activeId]);

    useEffect(() => {
        if (bootstrapped.current) return;
        bootstrapped.current = true;
        if (scenarios.length > 0) return;
        const created = normalizeScenario(blankScenario('Cenário A'), segments, destinations, draft.startsOn);
        onDraftChange(patchScenarios(draft, [created]));
        setActiveId(created.id);
    }, [scenarios.length, segments, destinations, draft, onDraftChange]);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    const snapshotList = useMemo(
        () => snapshots(prepared.map(engineScenario)) as ScenarioSnapshot[],
        [prepared]
    );

    const winnerId = useMemo(
        () => winner(snapshotList, criteria) ?? scenarioWinnerId,
        [snapshotList, criteria, scenarioWinnerId]
    );

    const activeIndex = prepared.findIndex((s) => s.id === (activeId ?? prepared[0]?.id));
    const activeScenario = activeIndex >= 0 ? prepared[activeIndex] : null;
    const editableScenario = useMemo(() => {
        if (!activeScenario) return null;
        const raw = scenarios.find((s) => s.id === activeScenario.id);
        if (!raw) return activeScenario;
        return {
            ...activeScenario,
            vacations: raw.vacations ?? activeScenario.vacations,
            remote: raw.remote ?? activeScenario.remote,
            vacation_balance: raw.vacation_balance ?? activeScenario.vacation_balance,
            vacationBalance: raw.vacationBalance ?? activeScenario.vacationBalance,
            notes: raw.notes ?? activeScenario.notes
        };
    }, [activeScenario, scenarios]);
    const activeSnapshot = activeScenario
        ? (snapshot(engineScenario(activeScenario)) as ScenarioSnapshot)
        : null;

    const chosenId =
        draft.payload.chosen_time_scenario_id ?? draft.payload.chosenTimeScenarioId ?? null;

    function commitScenarios(next: TripTimeScenario[]) {
        let nextDraft = patchScenarios(draftRef.current, next);
        const chosen = nextDraft.payload.chosen_time_scenario_id ?? nextDraft.payload.chosenTimeScenarioId;
        if (chosen) {
            const scenario = next.find((s) => String(s.id) === String(chosen));
            if (scenario) {
                const snap = chosenScenarioSnapshot(
                    scenario,
                    segments,
                    destinations,
                    nextDraft.startsOn?.trim() || undefined
                );
                const tripSummary = tripSummaryFromSnapshot(snap);
                const bounds = snapshotDayBounds(snap);
                nextDraft = {
                    ...nextDraft,
                    ...(bounds.start ? { startsOn: bounds.start } : {}),
                    ...(bounds.end ? { endsOn: bounds.end } : bounds.start ? { endsOn: bounds.start } : {}),
                    payload: {
                        ...nextDraft.payload,
                        trip_summary: tripSummary,
                        tripSummary
                    }
                };
            }
        }
        onDraftChange(nextDraft);
    }

    function updateActive(next: TripTimeScenario) {
        const base = listScenarios(draftRef.current.payload);
        const targetId = String(next.id ?? activeId ?? '');
        let matched = false;
        const list = base.map((s, i) => {
            const sid = String(s.id ?? '');
            const hit =
                (targetId && sid === targetId) ||
                (activeIndex >= 0 && i === activeIndex && (activeId == null || sid === String(activeId)));
            if (!hit) return s;
            matched = true;
            const id = sid || targetId || crypto.randomUUID();
            return { ...s, ...next, id };
        });
        if (!matched && base.length > 0) {
            const i = activeIndex >= 0 ? activeIndex : 0;
            list[i] = { ...base[i], ...next, id: String(base[i].id ?? next.id ?? crypto.randomUUID()) };
        }
        commitScenarios(list);
    }

    function saveVacationStart(startKey: string, periodIndex = 0) {
        const scenarioId = String(activeId ?? editableScenario?.id ?? '');
        if (!scenarioId) return;
        const list = patchScenarioVacationStart(
            listScenarios(draftRef.current.payload),
            scenarioId,
            startKey,
            periodIndex
        );
        commitScenarios(list);
        void onFlushSave?.();
    }

    function addScenario() {
        const name = `Cenário ${String.fromCharCode(65 + prepared.length)}`;
        const created = normalizeScenario(blankScenario(name), segments, destinations, draft.startsOn);
        commitScenarios([...prepared, created]);
        setActiveId(created.id);
    }

    function handleChosen(
        chosen: string | null,
        startsOn?: string,
        endsOn?: string,
        tripSummary?: Record<string, unknown> | null
    ) {
        const rawList = listScenarios(draftRef.current.payload);
        const scenariosForFicha = prepared.map((p) => {
            const raw = rawList.find((s) => String(s.id) === String(p.id));
            if (!raw) return p;
            return {
                ...p,
                vacations: raw.vacations ?? p.vacations,
                remote: raw.remote ?? p.remote,
                vacation_balance: raw.vacation_balance ?? p.vacation_balance,
                vacationBalance: raw.vacationBalance ?? p.vacationBalance,
                notes: raw.notes ?? p.notes
            };
        });
        onDraftChange({
            ...draftRef.current,
            ...(startsOn ? { startsOn } : {}),
            ...(endsOn ? { endsOn } : {}),
            payload: {
                ...draftRef.current.payload,
                chosen_time_scenario_id: chosen,
                chosenTimeScenarioId: chosen,
                time_scenarios: scenariosForFicha,
                timeScenarios: scenariosForFicha,
                scenario_criteria: criteria,
                scenarioCriteria: criteria,
                ...(tripSummary
                    ? { trip_summary: tripSummary, tripSummary: tripSummary }
                    : { trip_summary: null, tripSummary: null })
            }
        });
    }

    function patchCriteria(next: ScenarioCriterion[]) {
        onDraftChange({
            ...draft,
            payload: {
                ...draft.payload,
                scenario_criteria: next,
                scenarioCriteria: next
            }
        });
    }

    const content = (
        <div
            className="viagens-simulador-overlay viagens-root"
            role="dialog"
            aria-modal="true"
            aria-labelledby="viagens-sim-title"
            style={{ left: sidebarInset }}
        >
            <a className="viagens-simulador-skip" href="#viagens-sim-main">
                Ir para o cenário ativo
            </a>
            <header className="viagens-simulador__head">
                <ViagensBackControl label="Voltar à ficha" iconOnly onClick={onClose} />
                <div className="viagens-simulador__head-text">
                    <h2 id="viagens-sim-title">Simulador</h2>
                    <p>Compare férias, rota e o que cada cenário visita</p>
                </div>
            </header>
            <div className="viagens-simulador-shell">
                <TripSimuladorRail
                    scenarios={prepared}
                    snapshots={snapshotList}
                    activeId={activeId}
                    winnerId={winnerId}
                    criteria={criteria}
                    onSelect={setActiveId}
                    onAdd={addScenario}
                    onOpenCriteria={() => setShowCriteria(true)}
                />
                <main id="viagens-sim-main" className="viagens-simulador-main">
                    {editableScenario && activeSnapshot ? (
                        <TripSimuladorDetail
                            scenario={editableScenario}
                            scenarioIndex={activeIndex}
                            snapshot={activeSnapshot}
                            chosenId={chosenId}
                            segments={segments}
                            destinations={destinations}
                            onScenarioChange={updateActive}
                            onVacationStart={saveVacationStart}
                            onChosen={handleChosen}
                            onDuplicate={() => {
                                const name = scenarioDisplayName(activeScenario, activeIndex);
                                const dup = duplicateScenario(activeScenario, `${name} cópia`);
                                commitScenarios([...prepared, dup]);
                                setActiveId(dup.id);
                            }}
                            onDelete={() => {
                                commitScenarios(prepared.filter((s) => s.id !== activeScenario.id));
                            }}
                            canDelete={prepared.length > 1}
                        />
                    ) : (
                        <div className="viagens-sim-empty">
                            <p className="viagens-muted">Preparando cenário…</p>
                        </div>
                    )}
                </main>
            </div>
            <TripSimuladorCriteriaSheet
                open={showCriteria}
                criteria={criteria}
                onChange={patchCriteria}
                onClose={() => setShowCriteria(false)}
            />
        </div>
    );

    if (typeof document === 'undefined') return content;
    return createPortal(content, document.body);
}