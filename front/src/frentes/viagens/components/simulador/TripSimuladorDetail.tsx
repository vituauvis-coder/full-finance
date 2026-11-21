import { useMemo, useState } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { DeleteIcon } from '../../../../components/icons/DeleteIcon';
import { applyChosenScenario } from '../../domain/tripScenarioChosen';
import { destinationsNeedDepartureDates, enrichCountrySchedule } from '../../domain/tripScenarioDisplay';
import type { ScenarioSnapshot } from '../../domain/tripScenarioCriteria';
import {
    scenarioDisplayName,
    sortHopsChronologically,
    type TripTimeHop,
    type TripVacationPeriod
} from '../../domain/tripTimeScenario';
import type { TripDestination, TripFlightSegment, TripTimeScenario } from '../../types';
import { TripSimuladorDestinosPanel } from './TripSimuladorDestinosPanel';
import { TripSimuladorHopsPanel } from './TripSimuladorHopsPanel';
import { TripSimuladorScenarioCalendar } from './TripSimuladorScenarioCalendar';
import { TripSimuladorStatsGrid } from './TripSimuladorStatsGrid';
import { TripSimuladorVacationSheet } from './TripSimuladorVacationSheet';

type Props = {
    scenario: TripTimeScenario;
    scenarioIndex: number;
    snapshot: ScenarioSnapshot;
    chosenId: string | null;
    segments: TripFlightSegment[];
    destinations: TripDestination[];
    onScenarioChange: (next: TripTimeScenario) => void;
    onVacationStart?: (startKey: string, periodIndex: number) => void;
    onChosen: (
        chosenId: string | null,
        startsOn?: string,
        endsOn?: string,
        tripSummary?: Record<string, unknown> | null
    ) => void;
    onDuplicate: () => void;
    onDelete: () => void;
    canDelete: boolean;
};

export function TripSimuladorDetail({
    scenario,
    scenarioIndex,
    snapshot,
    chosenId,
    segments,
    destinations,
    onScenarioChange,
    onVacationStart,
    onChosen,
    onDuplicate,
    onDelete,
    canDelete
}: Props) {
    const [focusedCountry, setFocusedCountry] = useState<string | null>(null);
    const [vacationOpen, setVacationOpen] = useState(false);

    const hops = useMemo(
        () => sortHopsChronologically((scenario.hops as TripTimeHop[] | undefined) ?? []),
        [scenario.hops]
    );
    const countries = useMemo(
        () => enrichCountrySchedule(snapshot, hops, destinations),
        [snapshot, hops, destinations]
    );
    const showDestDaysHint = useMemo(() => destinationsNeedDepartureDates(destinations), [destinations]);

    const vacations = (scenario.vacations as TripVacationPeriod[] | undefined) ?? [];
    const isChosen = chosenId === scenario.id;
    const displayName = scenarioDisplayName(scenario, scenarioIndex);

    function patchName(name: string) {
        onScenarioChange({ ...scenario, name, title: name });
    }

    function toggleChosen() {
        const result = applyChosenScenario(scenario.id, snapshot, chosenId);
        onChosen(result.chosenId, result.startsOn, result.endsOn, result.tripSummary ?? null);
    }

    return (
        <div className="viagens-sim-workspace">
            <div className="viagens-sim-workspace__identity">
                <input
                    className="viagens-sim-workspace__name"
                    value={String(scenario.name ?? scenario.title ?? displayName)}
                    onChange={(e) => patchName(e.target.value)}
                    aria-label="Nome do cenário"
                />
                <div className="viagens-sim-workspace__actions">
                    <button
                        type="button"
                        className={`viagens-sim-workspace__choose${isChosen ? ' viagens-sim-workspace__choose--on' : ''}`}
                        onClick={toggleChosen}
                    >
                        <MaterialIcon name={isChosen ? 'cancel' : 'verified'} variant="app" opticalSize={14} />
                        {isChosen ? 'Desvincular da ficha' : 'Escolher para a viagem'}
                    </button>
                    <button type="button" className="viagens-sim-icon-btn" title="Duplicar" onClick={onDuplicate}>
                        <MaterialIcon name="content_copy" variant="app" opticalSize={18} />
                    </button>
                    {canDelete ? (
                        <button type="button" className="viagens-sim-icon-btn viagens-sim-icon-btn--danger" title="Excluir" onClick={onDelete}>
                            <DeleteIcon size="sm" />
                        </button>
                    ) : null}
                </div>
            </div>

            <section className="viagens-sim-explorer">
                <TripSimuladorScenarioCalendar
                    snapshot={snapshot}
                    vacations={vacations}
                    hops={hops}
                    onOpenVacations={() => setVacationOpen(true)}
                />
                <article className="viagens-sim-explorer__main viagens-sim-resumo-panel">
                    <header className="viagens-sim-explorer__head viagens-resumo__head">
                        <h3 className="viagens-resumo__title">
                            <MaterialIcon name="luggage" variant="app" opticalSize={16} />
                            Resumo da viagem
                        </h3>
                    </header>
                    <TripSimuladorStatsGrid snapshot={snapshot} />
                    <section className="viagens-sim-resumo__destinos" aria-label="Destinos e continentes">
                        <h4 className="viagens-sim-resumo__destinos-title">
                            <MaterialIcon name="public" variant="app" opticalSize={15} />
                            Rota e destinos
                        </h4>
                        {showDestDaysHint ? (
                            <p className="viagens-sim-destinos__config-hint" role="status">
                                Preencha <strong>Saída</strong> em cada destino na ficha ou use <strong>Voos da ficha</strong> com horários — só a
                                chegada sem saída não define dias no país.
                            </p>
                        ) : null}
                        <TripSimuladorDestinosPanel
                            rows={countries}
                            snapshot={snapshot}
                            hops={hops}
                            focusedCountry={focusedCountry}
                            onCountry={setFocusedCountry}
                        />
                    </section>
                    {(snapshot.conflicts ?? []).map((c, i) => (
                        <p key={i} className="viagens-sim-conflict" role="alert">
                            <MaterialIcon name="warning" variant="app" opticalSize={14} />
                            {c.text}
                        </p>
                    ))}
                </article>
            </section>

            <TripSimuladorHopsPanel scenario={scenario} segments={segments} destinations={destinations} onChange={onScenarioChange} />

            <TripSimuladorVacationSheet
                open={vacationOpen}
                scenario={scenario}
                onChange={onScenarioChange}
                onVacationStart={onVacationStart}
                onClose={() => setVacationOpen(false)}
            />
        </div>
    );
}