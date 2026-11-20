import { useCallback, useEffect, useRef, useState } from 'react';
import {
    BAGGAGE_OPTIONS,
    emptyBaggage,
    normalizeFlightSimulation,
    flightInsightLabel,
    flightStatusLabel,
    googleFlightsSearchURL,
    nextFlightInsight,
    nextFlightStatus,
    simulationLabelLine
} from '@motor/viagens/flight-simulation.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import {
    ensureAfter,
    flightDurationLabel,
    shiftKeepingDuration
} from '../../domain/flightDisplay';
import { fetchEmissions, fetchMilesDashboard, fetchMilesPrograms, WALLET_CHANGED } from '../../api/miles';
import type { ConversionRate, MilesProgram } from '../../pages/pontos/pontos-format';
import type { TripDestination, TripFlightConnection, TripFlightMiles, TripFlightSimulation } from '../../types';
import { AirportSuggestField } from './AirportSuggestField';
import { FlightDateTimeField } from './FlightDateTimeField';
import { FlightMilesBlock } from './FlightMilesBlock';

type Props = {
    open: boolean;
    tripId: string;
    simulation: TripFlightSimulation | null;
    destinations: TripDestination[];
    tripStartsOn?: string;
    tripEndsOn?: string;
    onClose: () => void;
    onChange: (next: TripFlightSimulation) => void;
    onDelete: () => void;
};

function numOrNull(raw: string): number | null {
    if (raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

function asHttpUrl(raw: string): string | null {
    const t = raw.trim();
    if (!t) return null;
    try {
        const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        if (!u.hostname.includes('.')) return null;
        return u.toString();
    } catch {
        return null;
    }
}

function patchConnection(list: TripFlightConnection[], id: string, patch: Partial<TripFlightConnection>) {
    return list.map((c) => (c.id === id ? { ...c, ...patch } : c));
}

function addStop(list: TripFlightConnection[]) {
    return [...list, { id: crypto.randomUUID(), place: '', layoverMinutes: null }];
}

function ConnectionList({
    connections,
    onChange
}: {
    connections: TripFlightConnection[];
    onChange: (next: TripFlightConnection[]) => void;
}) {
    if (connections.length === 0) return null;
    return (
        <ul className="voos-conn-list">
            {connections.map((c, i) => (
                <li key={c.id}>
                    <AirportSuggestField
                        label={connections.length === 1 ? 'Escala' : `Escala ${i + 1}`}
                        value={c.place}
                        onChange={(place) => onChange(patchConnection(connections, c.id, { place }))}
                    />
                    <label className="voos-field voos-field--min">
                        <span>Parada</span>
                        <input
                            className="viagens-field"
                            type="number"
                            min={0}
                            placeholder="min"
                            value={c.layoverMinutes ?? ''}
                            onChange={(e) =>
                                onChange(
                                    patchConnection(connections, c.id, {
                                        layoverMinutes: numOrNull(e.target.value)
                                    })
                                )
                            }
                        />
                    </label>
                    <button
                        type="button"
                        className="voos-icon-btn voos-icon-btn--coral"
                        title="Remover conexão"
                        onClick={() => onChange(connections.filter((x) => x.id !== c.id))}
                    >
                        <MaterialIcon name="close" variant="app" opticalSize={16} />
                    </button>
                </li>
            ))}
        </ul>
    );
}

function PeopleStepper({
    value,
    onChange
}: {
    value: number;
    onChange: (next: number) => void;
}) {
    return (
        <div className="voos-pax" role="group" aria-label="Pessoas na simulação">
            <button type="button" aria-label="Menos pessoas" disabled={value <= 1} onClick={() => onChange(value - 1)}>
                −
            </button>
            <strong>{value}</strong>
            <span>{value === 1 ? 'pessoa' : 'pessoas'}</span>
            <button type="button" aria-label="Mais pessoas" disabled={value >= 9} onClick={() => onChange(value + 1)}>
                +
            </button>
        </div>
    );
}

export function FlightEditorModal({
    open,
    tripId,
    simulation,
    destinations,
    tripStartsOn,
    tripEndsOn,
    onClose,
    onChange,
    onDelete
}: Props) {
    const [programs, setPrograms] = useState<MilesProgram[]>([]);
    const [rates, setRates] = useState<ConversionRate[]>([]);
    const [emissions, setEmissions] = useState<Array<{ id: string; flightSimulationId?: string | null }>>([]);
    const [walletsReady, setWalletsReady] = useState(false);
    const [awaitingQuote, setAwaitingQuote] = useState(false);
    const latestSim = useRef(simulation);
    latestSim.current = simulation;

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (awaitingQuote) {
                    setAwaitingQuote(false);
                    return;
                }
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose, awaitingQuote]);

    useEffect(() => {
        if (!open) setAwaitingQuote(false);
    }, [open]);

    useEffect(() => {
        if (!open || !awaitingQuote || !simulation) return;
        function onPaste(e: ClipboardEvent) {
            const url = asHttpUrl(e.clipboardData?.getData('text') ?? '');
            const current = latestSim.current;
            if (!url || !current) return;
            e.preventDefault();
            onChange({
                ...normalizeFlightSimulation(current),
                bookingURL: url
            } as TripFlightSimulation);
            setAwaitingQuote(false);
        }
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, [open, awaitingQuote, simulation, onChange]);

    const loadWallets = useCallback(() => {
        const flightId = simulation?.id;
        setWalletsReady(false);
        return Promise.all([
            fetchMilesPrograms(),
            fetchMilesDashboard(tripId, flightId ? { excludeFlightSimulationId: flightId } : undefined).catch(() => ({
                programs: []
            })),
            fetchEmissions(tripId)
        ])
            .then(([p, dash, e]) => {
                const listed = (p.programs ?? []) as MilesProgram[];
                const dashRows = ((dash as { programs?: MilesProgram[] }).programs ?? []) as MilesProgram[];
                const byId = new Map(dashRows.map((row) => [row.id, row]));
                setPrograms(
                    listed.map((prog) => {
                        const row = byId.get(prog.id);
                        const buy = Number(prog.buyMilheiro) || Number(row?.buyMilheiro) || 0;
                        return {
                            ...prog,
                            ...row,
                            transferBonusPercent: prog.transferBonusPercent ?? row?.transferBonusPercent,
                            clubActive: prog.clubActive ?? row?.clubActive,
                            clubFeeBrl: prog.clubFeeBrl ?? row?.clubFeeBrl,
                            clubStartedOn: prog.clubStartedOn ?? row?.clubStartedOn,
                            clubPointsPerMonth: prog.clubPointsPerMonth ?? row?.clubPointsPerMonth,
                            clubBonusPerMonth: prog.clubBonusPerMonth ?? row?.clubBonusPerMonth,
                            buyMilheiro: buy > 0 ? String(buy) : prog.buyMilheiro ?? row?.buyMilheiro,
                            milheiro: String(row?.milheiro ?? prog.milheiro ?? (buy > 0 ? buy : '')),
                            acquisitionMilheiro: row?.acquisitionMilheiro ?? prog.acquisitionMilheiro,
                            acquisitionBuckets: row?.acquisitionBuckets ?? prog.acquisitionBuckets,
                            available: row?.available ?? prog.available ?? prog.balance
                        };
                    })
                );
                setRates(p.rates ?? []);
                setWalletsReady(true);
                setEmissions(
                    ((e as { emissions?: Array<{ id: string; flightSimulationId?: string | null }> }).emissions ?? [])
                );
            })
            .catch(() => {
                setPrograms([]);
                setRates([]);
                setWalletsReady(true);
            });
    }, [simulation?.id, tripId]);

    useEffect(() => {
        if (!open) {
            setWalletsReady(false);
            return;
        }
        let cancelled = false;
        void loadWallets().then(() => {
            if (cancelled) return;
        });
        const onWallet = () => {
            void loadWallets();
        };
        window.addEventListener(WALLET_CHANGED, onWallet);
        return () => {
            cancelled = true;
            window.removeEventListener(WALLET_CHANGED, onWallet);
        };
    }, [open, loadWallets]);

    if (!open || !simulation) return null;

    const sim = normalizeFlightSimulation(simulation) as TripFlightSimulation;
    const google = googleFlightsSearchURL({
        origin: sim.origin,
        destination: sim.destination,
        departsOn: sim.departsAt,
        returnOn: sim.isRoundTrip ? sim.returnDepartsAt : null
    }) as string | null;
    const cities = destinations.filter((d) => !d.isPrincipal);

    function patch(partial: Partial<TripFlightSimulation>) {
        const next = { ...sim, ...partial };
        latestSim.current = next;
        onChange(next);
    }

    function setDepart(departsAt: string | null) {
        const arrivesAt = shiftKeepingDuration(sim.departsAt ?? null, departsAt, sim.arrivesAt ?? null);
        patch({
            departsAt,
            arrivesAt: ensureAfter(departsAt, arrivesAt)
        });
    }

    function setArrive(arrivesAt: string | null) {
        patch({ arrivesAt: ensureAfter(sim.departsAt ?? null, arrivesAt) });
    }

    function setReturnDepart(returnDepartsAt: string | null) {
        const afterOutbound = ensureAfter(sim.arrivesAt ?? sim.departsAt ?? null, returnDepartsAt);
        const returnArrivesAt = shiftKeepingDuration(
            sim.returnDepartsAt ?? null,
            afterOutbound,
            sim.returnArrivesAt ?? null
        );
        patch({
            isRoundTrip: true,
            returnDepartsAt: afterOutbound,
            returnArrivesAt: ensureAfter(afterOutbound, returnArrivesAt)
        });
    }

    function setReturnArrive(returnArrivesAt: string | null) {
        patch({
            isRoundTrip: true,
            returnArrivesAt: ensureAfter(sim.returnDepartsAt ?? null, returnArrivesAt)
        });
    }

    function setBag(key: 'kg10' | 'kg23' | 'kg32', qty: number) {
        const baggage = { ...emptyBaggage(), ...sim.baggage, [key]: Math.max(0, Math.min(9, qty)) };
        patch({
            baggage,
            baggageIncluded: baggage.kg10 + baggage.kg23 + baggage.kg32 > 0
        });
    }

    async function onQuoteIcon() {
        const existing = asHttpUrl(sim.bookingURL ?? '') ?? (sim.bookingURL ?? '').trim();
        if (existing) {
            window.open(existing, '_blank', 'noopener,noreferrer');
            return;
        }
        try {
            const fromClip = asHttpUrl(await navigator.clipboard.readText());
            if (fromClip) {
                patch({ bookingURL: fromClip });
                setAwaitingQuote(false);
                return;
            }
        } catch {
            /* permission denied — wait for Cmd/Ctrl+V */
        }
        setAwaitingQuote(true);
    }

    const outboundHint = flightDurationLabel(sim.departsAt, sim.arrivesAt);
    const inboundHint = flightDurationLabel(sim.returnDepartsAt, sim.returnArrivesAt);

    return (
        <div
            className="voos-overlay"
            role="presentation"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="voos-editor voos-editor--voo" role="dialog" aria-modal="true" aria-labelledby="voos-editor-title">
                <header className="voos-editor__head">
                    <div className="voos-editor__identity">
                        <p className="pontos-kicker">Voo</p>
                        <h2 id="voos-editor-title">
                            {sim.label.trim() || sim.origin.trim() || sim.destination.trim()
                                ? simulationLabelLine(sim)
                                : 'Novo voo'}
                        </h2>
                    </div>
                    <div className="voos-editor__head-actions">
                        <button
                            type="button"
                            className={`voos-capsule voos-capsule--${sim.status}`}
                            onClick={() => patch({ status: nextFlightStatus(sim.status) })}
                        >
                            {flightStatusLabel(sim.status)}
                        </button>
                        <button
                            type="button"
                            className={`voos-insight voos-insight--${sim.insight}`}
                            onClick={() => patch({ insight: nextFlightInsight(sim.insight) })}
                        >
                            {flightInsightLabel(sim.insight)}
                        </button>
                        {google ? (
                            <a
                                className="voos-icon-btn voos-icon-btn--oceano"
                                href={google}
                                target="_blank"
                                rel="noreferrer"
                                title="Google Flights"
                                aria-label="Abrir no Google Flights"
                            >
                                <MaterialIcon name="flight_takeoff" variant="app" opticalSize={20} />
                            </a>
                        ) : (
                            <button
                                type="button"
                                className="voos-icon-btn"
                                disabled
                                title="Informe origem e destino para abrir no Google Flights"
                            >
                                <MaterialIcon name="flight_takeoff" variant="app" opticalSize={20} />
                            </button>
                        )}
                        <button
                            type="button"
                            className={[
                                'voos-icon-btn',
                                sim.bookingURL ? 'voos-icon-btn--oceano' : '',
                                awaitingQuote ? 'voos-icon-btn--wait' : ''
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            title={
                                sim.bookingURL
                                    ? 'Abrir link da passagem'
                                    : awaitingQuote
                                      ? 'Cole o link da passagem'
                                      : 'Colar link da passagem'
                            }
                            aria-label={sim.bookingURL ? 'Abrir link da passagem' : 'Colar link da passagem'}
                            onClick={() => void onQuoteIcon()}
                        >
                            <MaterialIcon name="link" variant="app" opticalSize={20} />
                        </button>
                        <button type="button" className="voos-icon-btn voos-icon-btn--coral" onClick={onDelete} title="Apagar">
                            <MaterialIcon name="delete" variant="app" opticalSize={20} />
                        </button>
                        <button type="button" className="voos-icon-btn" onClick={onClose} title="Fechar" aria-label="Fechar">
                            <MaterialIcon name="close" variant="app" opticalSize={20} />
                        </button>
                    </div>
                </header>

                <div className="voos-editor__body">
                    <section className="voos-editor__leg" aria-label="Trecho">
                        <div className="voos-leg__route">
                            <AirportSuggestField
                                className="voos-leg__airport"
                                label="Origem"
                                value={sim.origin}
                                onChange={(origin) => patch({ origin })}
                            />
                            <button
                                type="button"
                                className={`voos-leg__rt${sim.isRoundTrip ? ' is-on' : ''}`}
                                aria-pressed={sim.isRoundTrip}
                                title={sim.isRoundTrip ? 'Ida e volta' : 'Só ida — clique para ida e volta'}
                                onClick={() => patch({ isRoundTrip: !sim.isRoundTrip })}
                            >
                                <MaterialIcon name="sync_alt" variant="app" opticalSize={20} />
                            </button>
                            <AirportSuggestField
                                className="voos-leg__airport"
                                label="Destino"
                                value={sim.destination}
                                onChange={(destination) => patch({ destination })}
                            />
                            <PeopleStepper
                                value={sim.travelers ?? 1}
                                onChange={(travelers) => patch({ travelers })}
                            />
                        </div>

                        <div className="voos-leg__dates">
                            <div className="voos-leg__when">
                                <div className="voos-leg__when-head">
                                    <span className="voos-leg__tag">Ida</span>
                                    {outboundHint ? <em>{outboundHint}</em> : null}
                                    <button
                                        type="button"
                                        className="voos-text-btn"
                                        onClick={() => patch({ connections: addStop(sim.connections) })}
                                    >
                                        + Escala
                                    </button>
                                </div>
                                <div className="voos-leg__when-grid">
                                    <FlightDateTimeField
                                        label="Sai"
                                        value={sim.departsAt ?? null}
                                        onChange={setDepart}
                                        tripStart={tripStartsOn}
                                        tripEnd={tripEndsOn}
                                        defaultTime="08:00"
                                    />
                                    <FlightDateTimeField
                                        label="Chega"
                                        value={sim.arrivesAt ?? null}
                                        onChange={setArrive}
                                        min={sim.departsAt ?? null}
                                        tripStart={tripStartsOn}
                                        tripEnd={tripEndsOn}
                                        defaultTime="16:00"
                                    />
                                </div>
                                <ConnectionList
                                    connections={sim.connections}
                                    onChange={(connections) => patch({ connections })}
                                />
                            </div>
                            <div className={`voos-leg__when${sim.isRoundTrip ? '' : ' is-off'}`}>
                                <div className="voos-leg__when-head">
                                    <span className="voos-leg__tag">Volta</span>
                                    {inboundHint ? <em>{inboundHint}</em> : null}
                                    <button
                                        type="button"
                                        className="voos-text-btn"
                                        onClick={() =>
                                            patch({
                                                isRoundTrip: true,
                                                returnConnections: addStop(sim.returnConnections)
                                            })
                                        }
                                    >
                                        + Escala
                                    </button>
                                </div>
                                <div className="voos-leg__when-grid">
                                    <FlightDateTimeField
                                        label="Sai"
                                        value={sim.returnDepartsAt ?? null}
                                        onChange={setReturnDepart}
                                        min={sim.arrivesAt ?? sim.departsAt ?? null}
                                        tripStart={tripStartsOn}
                                        tripEnd={tripEndsOn}
                                        defaultTime="08:00"
                                    />
                                    <FlightDateTimeField
                                        label="Chega"
                                        value={sim.returnArrivesAt ?? null}
                                        onChange={setReturnArrive}
                                        min={sim.returnDepartsAt ?? null}
                                        tripStart={tripStartsOn}
                                        tripEnd={tripEndsOn}
                                        defaultTime="16:00"
                                    />
                                </div>
                                <ConnectionList
                                    connections={sim.returnConnections}
                                    onChange={(returnConnections) =>
                                        patch({ isRoundTrip: true, returnConnections })
                                    }
                                />
                            </div>
                        </div>

                        <div className="voos-bags" role="group" aria-label="Bagagem">
                            {BAGGAGE_OPTIONS.map((opt) => {
                                const qty = sim.baggage?.[opt.key as 'kg10' | 'kg23' | 'kg32'] ?? 0;
                                return (
                                    <div
                                        key={opt.key}
                                        className={`voos-bag${qty > 0 ? ' is-on' : ''}`}
                                    >
                                        <MaterialIcon name="luggage" variant="app" opticalSize={22} />
                                        <span className="voos-bag__copy">
                                            <strong className="voos-bag__kg">{opt.kg} kg</strong>
                                            <small>{opt.label}</small>
                                        </span>
                                        <div className="voos-bag__qty">
                                            <button
                                                type="button"
                                                aria-label={`Menos malas de ${opt.kg} kg`}
                                                disabled={qty <= 0}
                                                onClick={() =>
                                                    setBag(opt.key as 'kg10' | 'kg23' | 'kg32', qty - 1)
                                                }
                                            >
                                                −
                                            </button>
                                            <strong>{qty}</strong>
                                            <button
                                                type="button"
                                                aria-label={`Mais malas de ${opt.kg} kg`}
                                                disabled={qty >= 9}
                                                onClick={() =>
                                                    setBag(opt.key as 'kg10' | 'kg23' | 'kg32', qty + 1)
                                                }
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {cities.length > 0 ? (
                            <label className="voos-field voos-field--city">
                                <span>Cidade</span>
                                <select
                                    className="viagens-field"
                                    value={sim.tripDestinationId ?? ''}
                                    onChange={(e) => patch({ tripDestinationId: e.target.value || null })}
                                >
                                    <option value="">Sem vínculo</option>
                                    {cities.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ) : null}
                    </section>

                    <FlightMilesBlock
                        key={sim.id}
                        tripId={tripId}
                        simulation={sim}
                        programs={programs}
                        rates={rates}
                        emissions={emissions}
                        onChange={(miles: TripFlightMiles) => patch({ miles })}
                        onCashChange={({ amount, extrasAmount }) => patch({ amount, extrasAmount })}
                        walletsReady={walletsReady}
                    />
                </div>

                <footer className="voos-editor__foot">
                    <button type="button" className="viagens-btn viagens-btn--coral" onClick={onClose}>
                        Concluir
                    </button>
                </footer>
            </div>
        </div>
    );
}
