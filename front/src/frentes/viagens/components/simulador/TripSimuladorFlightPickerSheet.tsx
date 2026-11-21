import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatFlightSchedule } from '../../domain/flightDisplay';
import {
    hopsFromFlightPicks,
    liveSimulationsForSegment,
    readFlightSimPicks,
    resolveFlightSimPicks,
    segmentsWithFlights,
    type FlightSimPicks
} from '../../domain/tripTimeScenario';
import type { TripFlightSegment, TripFlightSimulation, TripTimeHop, TripTimeScenario } from '../../types';

const STATUS_LABEL: Record<string, string> = {
    escolhida: 'Escolhida',
    candidata: 'Simulado'
};

type Props = {
    open: boolean;
    scenario: TripTimeScenario;
    segments: TripFlightSegment[];
    onChange: (next: TripTimeScenario) => void;
    onClose: () => void;
    onDetach?: () => void;
};

function sortSims(sims: TripFlightSimulation[]): TripFlightSimulation[] {
    return [...sims].sort((a, b) => {
        const rank = (s: TripFlightSimulation) => (s.status === 'escolhida' ? 0 : 1);
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        return String(a.label ?? '').localeCompare(String(b.label ?? ''), 'pt-BR');
    });
}

export function TripSimuladorFlightPickerSheet({ open, scenario, segments, onChange, onClose, onDetach }: Props) {
    const panelRef = useRef<HTMLDivElement>(null);
    const withFlights = useMemo(() => segmentsWithFlights(segments), [segments]);

    const [picks, setPicks] = useState<FlightSimPicks>(() =>
        resolveFlightSimPicks(segments, readFlightSimPicks(scenario))
    );

    useEffect(() => {
        if (!open) return;
        setPicks(resolveFlightSimPicks(segments, readFlightSimPicks(scenario)));
    }, [open, scenario, segments]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        panelRef.current?.focus();
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    if (!open) return null;

    function apply() {
        const resolved = resolveFlightSimPicks(segments, picks);
        const own = (scenario.own_hops as TripTimeHop[] | undefined) ?? (scenario.ownHops as TripTimeHop[] | undefined) ?? [];
        const currentHops = (scenario.hops as TripTimeHop[] | undefined) ?? [];
        const wasPulling = Boolean(scenario.pulls_flights_from_ficha ?? scenario.pullsFlightsFromFicha);
        const nextHops = hopsFromFlightPicks(segments, resolved);
        if (!nextHops.length) return;
        onChange({
            ...scenario,
            pulls_flights_from_ficha: true,
            pullsFlightsFromFicha: true,
            flight_sim_picks: resolved,
            flightSimPicks: resolved,
            own_hops: wasPulling ? own : currentHops,
            ownHops: wasPulling ? own : currentHops,
            hops: nextHops
        });
        onClose();
    }

    const sheet = (
        <div className="viagens-sim-sheet viagens-sim-sheet--portal" role="presentation">
            <button type="button" className="viagens-sim-sheet__backdrop" aria-label="Fechar" onClick={onClose} />
            <div
                ref={panelRef}
                className="viagens-sim-sheet__panel viagens-sim-sheet__panel--wide viagens-sim-voos-pick"
                role="dialog"
                aria-modal="true"
                aria-labelledby="viagens-sim-voos-pick-title"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="viagens-sim-sheet__head">
                    <div>
                        <h3 id="viagens-sim-voos-pick-title">
                            <MaterialIcon name="flight" variant="app" opticalSize={18} />
                            Transportes da ficha
                        </h3>
                        <p className="viagens-sim-voos-pick__lede viagens-muted">
                            Escolha, por trecho, qual simulação entra neste cenário — escolhidas ou candidatas.
                        </p>
                    </div>
                    <button type="button" className="viagens-sim-sheet__close" onClick={onClose} aria-label="Fechar">
                        <MaterialIcon name="close" variant="app" opticalSize={20} />
                    </button>
                </header>

                {withFlights.length === 0 ? (
                    <p className="viagens-muted">Nenhum trecho com simulações na ficha de voos.</p>
                ) : (
                    <ul className="viagens-sim-voos-pick__list">
                        {withFlights.map((segment, index) => {
                            const sims = sortSims(liveSimulationsForSegment(segment));
                            const selected = picks[segment.id];
                            return (
                                <li key={segment.id} className="viagens-sim-voos-pick__segment">
                                    <header className="viagens-sim-voos-pick__segment-head">
                                        <span className="viagens-sim-voos-pick__segment-idx">{index + 1}</span>
                                        <strong>{segment.title?.trim() || `Trecho ${index + 1}`}</strong>
                                    </header>
                                    <div className="viagens-sim-voos-pick__options" role="radiogroup" aria-label={segment.title}>
                                        {sims.map((sim) => {
                                            const on = selected === sim.id;
                                            const status = STATUS_LABEL[sim.status] ?? sim.status;
                                            return (
                                                <label
                                                    key={sim.id}
                                                    className={`viagens-sim-voos-pick__option${on ? ' is-on' : ''}${sim.status === 'escolhida' ? ' viagens-sim-voos-pick__option--chosen' : ''}`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name={`sim-seg-${segment.id}`}
                                                        checked={on}
                                                        onChange={() =>
                                                            setPicks((prev) => ({ ...prev, [segment.id]: sim.id }))
                                                        }
                                                    />
                                                    <span className="viagens-sim-voos-pick__option-main">
                                                        <span className="viagens-sim-voos-pick__route">
                                                            {sim.origin} → {sim.destination}
                                                            {sim.isRoundTrip ? ' (ida e volta)' : ''}
                                                        </span>
                                                        <span className="viagens-sim-voos-pick__schedule">
                                                            {formatFlightSchedule(sim.departsAt, sim.arrivesAt)}
                                                        </span>
                                                        {sim.label?.trim() ? (
                                                            <span className="viagens-sim-voos-pick__label">{sim.label}</span>
                                                        ) : null}
                                                    </span>
                                                    <span
                                                        className={`viagens-sim-voos-pick__status viagens-sim-voos-pick__status--${sim.status}`}
                                                    >
                                                        {status}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <footer className="viagens-sim-voos-pick__foot">
                    {onDetach ? (
                        <button type="button" className="viagens-sim-voos-pick__detach" onClick={onDetach}>
                            Usar trechos manuais
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className="viagens-sim-ferias__done"
                        disabled={withFlights.length === 0}
                        onClick={apply}
                    >
                        Aplicar na rota
                    </button>
                </footer>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return sheet;
    return createPortal(sheet, document.body);
}