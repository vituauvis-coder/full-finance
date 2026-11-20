import { useMemo, useState } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatFlightSchedule, toDatetimeLocal } from '../../domain/flightDisplay';
import {
    hopsFromRoute,
    hopDestination,
    hopOrigin,
    hopCountry,
    readFlightSimPicks,
    segmentsWithFlights,
    sortHopsChronologically,
    type TripTimeHop
} from '../../domain/tripTimeScenario';
import type { TripDestination, TripFlightSegment, TripTimeScenario } from '../../types';
import { TripSimuladorFlightPickerSheet } from './TripSimuladorFlightPickerSheet';
import { TripSimuladorHopDetailSheet } from './TripSimuladorHopDetailSheet';

type Props = {
    scenario: TripTimeScenario;
    segments: TripFlightSegment[];
    destinations: TripDestination[];
    onChange: (next: TripTimeScenario) => void;
};

function hopsOf(sc: TripTimeScenario): TripTimeHop[] {
    return (sc.hops as TripTimeHop[] | undefined) ?? [];
}

function ensureHopId(hop: TripTimeHop, fallback: string): TripTimeHop {
    return { ...hop, id: hop.id ?? fallback };
}

export function TripSimuladorHopsPanel({ scenario, segments, destinations, onChange }: Props) {
    const hops = useMemo(() => sortHopsChronologically(hopsOf(scenario)), [scenario.hops, scenario]);
    const pulls = Boolean(scenario.pulls_flights_from_ficha ?? scenario.pullsFlightsFromFicha);
    const withFlights = segmentsWithFlights(segments);
    const hasFlights = withFlights.length > 0;
    const [editingId, setEditingId] = useState<string | null>(null);
    const [flightPickerOpen, setFlightPickerOpen] = useState(false);
    const [viewHopId, setViewHopId] = useState<string | null>(null);

    function patchHops(next: TripTimeHop[]) {
        onChange({
            ...scenario,
            hops: sortHopsChronologically(next).map((h, i) => ensureHopId(h, `hop-${i}-${crypto.randomUUID()}`))
        });
    }

    function detachFromFicha() {
        const own = (scenario.own_hops as TripTimeHop[] | undefined) ?? (scenario.ownHops as TripTimeHop[] | undefined) ?? [];
        onChange({
            ...scenario,
            pulls_flights_from_ficha: false,
            pullsFlightsFromFicha: false,
            flight_sim_picks: {},
            flightSimPicks: {},
            hops: own.length ? own : hops
        });
        setFlightPickerOpen(false);
    }

    function addHop() {
        const last = hops[hops.length - 1];
        const origin = last ? hopDestination(last) : 'Recife';
        const created: TripTimeHop = {
            id: crypto.randomUUID(),
            kind: 'voo',
            originCity: origin,
            destinationCity: '',
            departsAt: null,
            arrivesAt: null
        };
        patchHops([...hops, created]);
        setEditingId(created.id);
    }

    function seedFromRoute() {
        const fromRoute = hopsFromRoute(destinations);
        if (fromRoute.length) {
            patchHops(fromRoute);
            setEditingId(fromRoute[0]?.id ?? null);
        }
    }

    const locked = pulls && hasFlights;
    const pickCount = Object.keys(readFlightSimPicks(scenario)).length;

    return (
        <section className="viagens-sim-trechos" aria-label="Trechos">
            <header className="viagens-sim-trechos__head">
                <h4 className="viagens-sim-trechos__title">
                    <MaterialIcon name="flight_takeoff" variant="app" opticalSize={16} />
                    Trechos
                </h4>
                <div className="viagens-sim-trechos__actions">
                    {hasFlights ? (
                        <button
                            type="button"
                            className={`viagens-sim-trechos__ficha${pulls ? ' viagens-sim-trechos__ficha--on' : ''}`}
                            onClick={() => setFlightPickerOpen(true)}
                        >
                            <MaterialIcon name={pulls ? 'check_circle' : 'radio_button_unchecked'} variant="app" opticalSize={14} />
                            Voos da ficha
                            {pulls && pickCount > 0 ? (
                                <span className="viagens-sim-trechos__ficha-count">{pickCount}</span>
                            ) : null}
                        </button>
                    ) : null}
                    <button type="button" className="viagens-sim-trechos__add" onClick={addHop} disabled={locked}>
                        <MaterialIcon name="add" variant="app" opticalSize={14} />
                        Trecho
                    </button>
                </div>
            </header>
            {hops.length === 0 ? (
                <div className="viagens-sim-trechos__empty">
                    <p className="viagens-muted">
                        {hasFlights
                            ? 'Abra Voos da ficha para escolher simulações por trecho.'
                            : 'Origem, destino e horários de cada deslocamento. Recife entra como saída padrão.'}
                    </p>
                    <div className="viagens-sim-trechos__empty-actions">
                        {hasFlights ? (
                            <button type="button" className="viagens-btn viagens-btn--ghost" onClick={() => setFlightPickerOpen(true)}>
                                Escolher voos da ficha
                            </button>
                        ) : null}
                        {destinations.length > 0 ? (
                            <button type="button" className="viagens-btn viagens-btn--ghost" onClick={seedFromRoute}>
                                Preencher do roteiro
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : (
                <ul className="viagens-sim-trechos__list">
                    {hops.map((hop, idx) => {
                        const hopId = hop.id ?? `hop-${idx}`;
                        const isEditing = editingId === hopId;
                        const linked = Boolean(hop.linkedFlightSimulationId ?? hop.linked_flight_simulation_id);
                        return (
                            <li
                                key={hopId}
                                className={`viagens-sim-trechos__card viagens-sim-trechos__card--openable${linked ? ' viagens-sim-trechos__card--linked' : ''}`}
                                onClick={() => setViewHopId(hopId)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setViewHopId(hopId);
                                    }
                                }}
                                tabIndex={0}
                                role="button"
                                aria-label={`Ver detalhes do trecho ${idx + 1}`}
                            >
                                <div className="viagens-sim-trechos__card-top">
                                    <div className="viagens-sim-trechos__route">
                                        <span className="viagens-sim-trechos__index">{idx + 1}</span>
                                        <MaterialIcon name="flight" variant="app" opticalSize={16} />
                                        <strong>
                                            {hopOrigin(hop)} → {hopDestination(hop)}
                                        </strong>
                                        {linked ? (
                                            <span className="viagens-sim-trechos__linked" title="Vinculado à ficha de voos">
                                                <MaterialIcon name="link" variant="app" opticalSize={14} />
                                            </span>
                                        ) : null}
                                    </div>
                                    <div
                                        className="viagens-sim-trechos__card-tools"
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        role="presentation"
                                    >
                                        {!locked ? (
                                            <button
                                                type="button"
                                                className={`viagens-sim-trechos__edit-btn${isEditing ? ' is-on' : ''}`}
                                                onClick={() => setEditingId(isEditing ? null : hopId)}
                                            >
                                                {isEditing ? 'Fechar' : 'Editar'}
                                            </button>
                                        ) : null}
                                        {!locked ? (
                                            <button
                                                type="button"
                                                className="viagens-sim-trechos__remove"
                                                aria-label="Remover trecho"
                                                onClick={() => patchHops(hops.filter((_, i) => i !== idx))}
                                            >
                                                <MaterialIcon name="close" variant="app" opticalSize={14} />
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                                <p className="viagens-sim-trechos__schedule">
                                    {formatFlightSchedule(hop.departsAt ?? hop.departs_at, hop.arrivesAt ?? hop.arrives_at)}
                                </p>
                                <div className="viagens-sim-trechos__meta">
                                    <span className="viagens-sim-trechos__tag">Voo</span>
                                    {hopCountry(hop) ? <span>{hopCountry(hop)}</span> : null}
                                </div>
                                {isEditing && !locked ? (
                                    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
                                    <HopEditor
                                        hop={hop}
                                        onPatch={(next) => {
                                            const list = [...hops];
                                            list[idx] = { ...next, id: hopId };
                                            patchHops(list);
                                        }}
                                    />
                                    </div>
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            )}

            <TripSimuladorFlightPickerSheet
                open={flightPickerOpen}
                scenario={scenario}
                segments={segments}
                onChange={onChange}
                onClose={() => setFlightPickerOpen(false)}
                onDetach={pulls ? detachFromFicha : undefined}
            />

            <TripSimuladorHopDetailSheet
                open={Boolean(viewHopId)}
                hop={hops.find((h, i) => (h.id ?? `hop-${i}`) === viewHopId) ?? null}
                hopIndex={Math.max(0, hops.findIndex((h, i) => (h.id ?? `hop-${i}`) === viewHopId))}
                segments={segments}
                onClose={() => setViewHopId(null)}
            />
        </section>
    );
}

function HopEditor({ hop, onPatch }: { hop: TripTimeHop; onPatch: (h: TripTimeHop) => void }) {
    return (
        <div className="viagens-sim-trechos__fields">
            <label>
                Origem
                <input value={hop.originCity ?? ''} onChange={(e) => onPatch({ ...hop, originCity: e.target.value })} />
            </label>
            <label>
                Destino
                <input value={hop.destinationCity ?? ''} onChange={(e) => onPatch({ ...hop, destinationCity: e.target.value })} />
            </label>
            <label>
                País destino
                <input
                    value={hop.destinationCountry ?? hop.destination_country ?? ''}
                    onChange={(e) => onPatch({ ...hop, destinationCountry: e.target.value, destination_country: e.target.value })}
                />
            </label>
            <label>
                Saída
                <input
                    type="datetime-local"
                    value={toDatetimeLocal(hop.departsAt ?? hop.departs_at)}
                    onChange={(e) => onPatch({ ...hop, departsAt: e.target.value, departs_at: e.target.value })}
                />
            </label>
            <label className="viagens-sim-trechos__field-wide">
                Chegada
                <input
                    type="datetime-local"
                    value={toDatetimeLocal(hop.arrivesAt ?? hop.arrives_at)}
                    onChange={(e) => onPatch({ ...hop, arrivesAt: e.target.value, arrives_at: e.target.value })}
                />
            </label>
        </div>
    );
}