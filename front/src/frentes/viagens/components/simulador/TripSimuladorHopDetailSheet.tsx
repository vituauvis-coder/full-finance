import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    baggageLabel,
    connectionLegRows,
    flightStatusLabel,
    simulationLabelLine
} from '@motor/viagens/flight-simulation.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { flightDurationLabel, formatFlightSchedule } from '../../domain/flightDisplay';
import { hopCountry, hopDestination, hopOrigin, hopOriginCountry, simulationForHop } from '../../domain/tripTimeScenario';
import type { TripFlightSegment, TripTimeHop } from '../../types';

type Props = {
    open: boolean;
    hop: TripTimeHop | null;
    hopIndex: number;
    segments: TripFlightSegment[];
    onClose: () => void;
};

function WhenBlock({ label, departs, arrives }: { label: string; departs?: string | null; arrives?: string | null }) {
    const duration = flightDurationLabel(departs, arrives);
    return (
        <div className="viagens-sim-hop-view__when">
            <span className="viagens-sim-hop-view__when-kicker">{label}</span>
            <p>{formatFlightSchedule(departs, arrives)}</p>
            {duration ? <span className="viagens-sim-hop-view__duration">{duration} no ar</span> : null}
        </div>
    );
}

export function TripSimuladorHopDetailSheet({ open, hop, hopIndex, segments, onClose }: Props) {
    const panelRef = useRef<HTMLDivElement>(null);

    const linked = useMemo(
        () => (hop ? simulationForHop(segments, hop) : null),
        [hop, segments]
    );

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

    if (!open || !hop) return null;

    const sim = linked?.simulation;
    const legs = sim ? (connectionLegRows(sim) as { id: string; leg: string; label: string }[]) : [];
    const originCountry = hopOriginCountry(hop);
    const destCountry = hopCountry(hop);

    const sheet = (
        <div className="viagens-sim-sheet viagens-sim-sheet--portal" role="presentation">
            <button type="button" className="viagens-sim-sheet__backdrop" aria-label="Fechar" onClick={onClose} />
            <div
                ref={panelRef}
                className="viagens-sim-sheet__panel viagens-sim-hop-view"
                role="dialog"
                aria-modal="true"
                aria-labelledby="viagens-sim-hop-view-title"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="viagens-sim-sheet__head">
                    <div>
                        <h3 id="viagens-sim-hop-view-title">
                            <MaterialIcon name="flight" variant="app" opticalSize={18} />
                            Trecho {hopIndex + 1}
                        </h3>
                        <p className="viagens-muted">
                            {hopOrigin(hop)} → {hopDestination(hop)}
                        </p>
                    </div>
                    <button type="button" className="viagens-sim-sheet__close" onClick={onClose} aria-label="Fechar">
                        <MaterialIcon name="close" variant="app" opticalSize={20} />
                    </button>
                </header>

                <form className="viagens-sim-hop-view__body" onSubmit={(e) => e.preventDefault()}>
                    <section className="viagens-sim-hop-view__section">
                        <h4>Horários do trecho</h4>
                        <WhenBlock label="Este deslocamento" departs={hop.departsAt ?? hop.departs_at} arrives={hop.arrivesAt ?? hop.arrives_at} />
                        {(originCountry || destCountry) && (
                            <p className="viagens-sim-hop-view__geo">
                                {originCountry ? <span>De {originCountry}</span> : null}
                                {destCountry ? <span>Para {destCountry}</span> : null}
                            </p>
                        )}
                    </section>

                    {sim ? (
                        <section className="viagens-sim-hop-view__section">
                            <div className="viagens-sim-hop-view__sim-head">
                                <h4>Voo na ficha</h4>
                                <span className={`viagens-sim-hop-view__status viagens-sim-hop-view__status--${sim.status}`}>
                                    {flightStatusLabel(sim.status)}
                                </span>
                            </div>
                            {linked?.segment.title ? (
                                <p className="viagens-muted viagens-sim-hop-view__segment">{linked.segment.title}</p>
                            ) : null}
                            <p className="viagens-sim-hop-view__sim-title">{simulationLabelLine(sim)}</p>
                            {sim.label?.trim() ? <p className="viagens-muted">{sim.label}</p> : null}
                            <div className="viagens-sim-hop-view__chips">
                                <span>{sim.isRoundTrip ? 'Ida e volta' : 'Só ida'}</span>
                                {baggageLabel(sim.baggage) ? <span>{baggageLabel(sim.baggage)}</span> : null}
                                {sim.travelers ? (
                                    <span>
                                        <MaterialIcon name="group" variant="app" opticalSize={14} /> {sim.travelers} pax
                                    </span>
                                ) : null}
                            </div>
                            <WhenBlock label="Ida (simulação)" departs={sim.departsAt} arrives={sim.arrivesAt} />
                            {sim.isRoundTrip ? (
                                <WhenBlock label="Volta" departs={sim.returnDepartsAt} arrives={sim.returnArrivesAt} />
                            ) : null}
                            {legs.length > 0 ? (
                                <ul className="viagens-sim-hop-view__legs">
                                    {legs.map((row) => (
                                        <li key={row.id}>
                                            <span>{row.leg === 'inbound' ? 'Volta' : 'Ida'}</span>
                                            {row.label}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                            {sim.notes?.trim() ? (
                                <p className="viagens-sim-hop-view__notes">{sim.notes}</p>
                            ) : null}
                        </section>
                    ) : (
                        <p className="viagens-muted viagens-sim-hop-view__manual">
                            Trecho manual — sem vínculo com simulação da aba Voos. Os dias no país usam as datas de saída e chegada deste trecho.
                        </p>
                    )}

                    <footer className="viagens-sim-hop-view__foot">
                        <button type="button" className="viagens-sim-ferias__done" onClick={onClose}>
                            Fechar
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );

    return createPortal(sheet, document.body);
}