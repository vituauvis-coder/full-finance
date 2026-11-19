import { useCallback, useEffect, useMemo, useState } from 'react';
import { originPointsNeeded } from '@motor/milhas/convert.js';
import { flightLedger, optionScore, tripFlightScenario, usesMilesPath } from '@motor/viagens/flight-ledger.js';
import {
    baggageLabel,
    connectionsCount,
    simulationFinalCost,
    simulationLabelLine,
    tripFlightSegments
} from '@motor/viagens/flight-simulation.js';
import { fetchMilesDashboard, fetchMilesPrograms } from '../../api/miles';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatAirMs, simulationAirMs } from '../../domain/flightDisplay';
import { formatBRL } from '../../utils/map-utils';
import { formatPts, milesError, type ConversionRate, type MilesProgram } from '../../pages/pontos/pontos-format';
import type { TripFlightSegment, TripFlightSimulation, TripPayload } from '../../types';
import {
    dropMilesCalcSave,
    loadMilesCalcSaves,
    pushMilesCalcSave,
    putMilesCalcSave,
    type MilesCalcSave
} from '../../utils/miles-calc-saves';
import { CarteiraResumo, type WalletNeed } from './CarteiraResumo';
import { CarteiraSheet } from './CarteiraSheet';
import { MilesCalcHistoryPop } from './MilesCalcHistoryPop';
import { MilesCalculatorPop } from './MilesCalculatorPop';

type Props = {
    tripId: string;
    payload: TripPayload;
};

export function flightOverview(payload: TripPayload) {
    const segments = tripFlightSegments(payload) as TripFlightSegment[];
    const sims = segments.flatMap((s) => s.simulations ?? []);
    const live = sims.filter((s) => s.status !== 'descartada');
    const registered = live.filter((s) => s.status === 'escolhida');
    const options = live.filter((s) => s.status === 'candidata');
    const registeredCost = registered.reduce((n, s) => n + simulationFinalCost(s), 0);
    return {
        segments: segments.length,
        live: live.length,
        registered: registered.length,
        options: options.length,
        registeredCost
    };
}

function calcTitle(sim: TripFlightSimulation, programs: MilesProgram[]) {
    const L = flightLedger(sim, programs);
    if (L.hasMiles && L.dayValue > 0) {
        return `${formatPts(L.destPts)} · ${formatBRL(L.dayValue)}`;
    }
    if (L.cash > 0) return formatBRL(L.cash);
    return 'Simulação';
}

export function VoosResumo({ tripId, payload }: Props) {
    const [programs, setPrograms] = useState<MilesProgram[]>([]);
    const [rates, setRates] = useState<ConversionRate[]>([]);
    const [needs, setNeeds] = useState<WalletNeed[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [sheet, setSheet] = useState<string | 'create' | null>(null);
    const [calc, setCalc] = useState<
        { kind: 'new' } | { kind: 'saved'; save: MilesCalcSave } | null
    >(null);
    const [history, setHistory] = useState(false);
    const [saves, setSaves] = useState<MilesCalcSave[]>(() => loadMilesCalcSaves());
    const [tick, setTick] = useState(0);
    const scene = useMemo(
        () => tripFlightScenario(tripFlightSegments(payload) as TripFlightSegment[], programs),
        [payload, programs]
    );
    const sceneAir = formatAirMs(
        scene.rows.reduce((n, row) => n + simulationAirMs(row.sim as TripFlightSimulation), 0)
    );
    const sceneConn = scene.rows.reduce(
        (n, row) => n + (connectionsCount(row.sim as TripFlightSimulation) as number),
        0
    );
    const sceneBags = [
        ...new Set(
            scene.rows
                .map((row) => baggageLabel((row.sim as TripFlightSimulation).baggage))
                .filter(Boolean) as string[]
        )
    ];

    const reload = useCallback(() => setTick((n) => n + 1), []);

    useEffect(() => {
        let cancelled = false;
        void Promise.all([fetchMilesDashboard(tripId), fetchMilesPrograms()])
            .then(([dash, listed]) => {
                if (cancelled) return;
                const list = ((dash as { programs?: MilesProgram[] }).programs ?? []) as MilesProgram[];
                const fromFlights = new Map<string, number>();
                for (const seg of tripFlightSegments(payload) as TripFlightSegment[]) {
                    for (const sim of seg.simulations ?? []) {
                        if (sim.status === 'descartada') continue;
                        const miles = sim.miles;
                        if (!miles || miles.payWith !== 'points' || !miles.originProgramId || !miles.destinationPoints) {
                            continue;
                        }
                        const add = originPointsNeeded({
                            destinationPoints: miles.destinationPoints,
                            from: miles.conversionFrom ?? 1,
                            to: miles.conversionTo ?? 1,
                            bonusPercent: miles.bonusPercent ?? 0
                        });
                        fromFlights.set(miles.originProgramId, (fromFlights.get(miles.originProgramId) ?? 0) + add);
                    }
                }
                setPrograms(list);
                setRates(listed.rates ?? []);
                setNeeds(
                    list.map((program) => {
                        const needed = fromFlights.get(program.id) ?? 0;
                        const have = program.available ?? program.balance;
                        return { program, needed, gap: Math.max(0, needed - have) };
                    })
                );
            })
            .catch((e: unknown) => {
                if (!cancelled) setError(milesError(e));
            });
        return () => {
            cancelled = true;
        };
    }, [tripId, payload, tick]);

    return (
        <section className="voos-resumo" aria-label="Resumo de passagens e carteira">
            <article className="voos-resumo__col">
                <h2>Resumo de Passagens</h2>
                {scene.rows.length === 0 ? (
                    <p className="voos-resumo__hint">Monte um voo abaixo para ver o melhor cenário.</p>
                ) : (
                    <div className="voos-scene">
                        <div className="voos-scene__legs">
                            {scene.rows.map((row) => {
                                const sim = row.sim as TripFlightSimulation;
                                const miles = usesMilesPath(sim, programs);
                                const cost = optionScore(sim, programs);
                                const air = formatAirMs(simulationAirMs(sim));
                                const bags = baggageLabel(sim.baggage);
                                const conn = connectionsCount(sim) as number;
                                const route = simulationLabelLine(sim);
                                return (
                                    <article
                                        key={row.segmentId}
                                        className={`voos-scene__leg${row.chosen ? ' is-picked' : ''}`}
                                    >
                                        <header className="voos-scene__head">
                                            <p className="voos-scene__kicker">{row.title}</p>
                                            <em className={`voos-scene__tag${row.chosen ? ' is-on' : ''}`}>
                                                {row.chosen ? 'Escolhido' : 'Melhor custo'}
                                            </em>
                                        </header>
                                        <div className="voos-scene__main">
                                            <strong>{route}</strong>
                                            <div className="voos-scene__cost">
                                                <span>{miles ? 'Milhas' : 'Dinheiro'}</span>
                                                <b>{cost != null ? formatBRL(cost) : '—'}</b>
                                            </div>
                                        </div>
                                        <ul className="voos-scene__chips">
                                            <li>{air ?? 'Sem horário'}</li>
                                            <li>
                                                {conn > 0
                                                    ? `${conn} conexão${conn === 1 ? '' : 'ões'}`
                                                    : 'Direto'}
                                            </li>
                                            <li>{bags ?? 'Sem bagagem'}</li>
                                        </ul>
                                    </article>
                                );
                            })}
                        </div>
                        <div className="voos-scene__total">
                            <div>
                                <span>Total do cenário</span>
                                <strong>
                                    {scene.totals.total > 0 ? formatBRL(scene.totals.total) : '—'}
                                </strong>
                            </div>
                            <ul>
                                <li>{sceneAir ? `${sceneAir} de voo` : 'Tempo a definir'}</li>
                                <li>
                                    {sceneConn > 0
                                        ? `${sceneConn} conexão${sceneConn === 1 ? '' : 'ões'}`
                                        : 'Sem conexões'}
                                </li>
                                <li>{sceneBags.length ? sceneBags.join(' · ') : 'Sem bagagem'}</li>
                            </ul>
                        </div>
                    </div>
                )}
            </article>

            <article className="voos-resumo__col voos-resumo__col--miles">
                <div className="voos-resumo__col-head">
                    <h2>Carteira</h2>
                    <div className="voos-resumo__tools">
                        <button
                            type="button"
                            className="voos-resumo__tool"
                            onClick={() => setCalc({ kind: 'new' })}
                            title="Calculadora de milhas"
                        >
                            <MaterialIcon name="calculate" variant="app" opticalSize={18} />
                            Calcular
                        </button>
                        <button
                            type="button"
                            className="voos-icon-btn"
                            onClick={() => setHistory(true)}
                            title="Simulações salvas"
                            aria-label="Simulações salvas"
                        >
                            <MaterialIcon name="history" variant="app" opticalSize={18} />
                        </button>
                        <button
                            type="button"
                            className="voos-icon-btn voos-icon-btn--oceano"
                            onClick={() => setSheet('create')}
                            title="Nova carteira"
                            aria-label="Nova carteira"
                        >
                            <MaterialIcon name="add" variant="app" opticalSize={18} />
                        </button>
                    </div>
                </div>
                {error ? <p className="voos-resumo__hint">{error}</p> : null}
                <CarteiraResumo programs={programs} needs={needs} onOpen={(id) => setSheet(id)} />
            </article>

            {sheet ? (
                <CarteiraSheet
                    tripId={tripId}
                    programId={sheet}
                    onClose={() => setSheet(null)}
                    onChanged={reload}
                />
            ) : null}

            {calc ? (
                <MilesCalculatorPop
                    key={calc.kind === 'new' ? 'new' : calc.save.id}
                    programs={programs}
                    rates={rates}
                    initial={calc.kind === 'new' ? null : calc.save.sim}
                    saveId={calc.kind === 'new' ? null : calc.save.id}
                    view={calc.kind === 'saved'}
                    originProgramId={programs[0]?.id}
                    fixed
                    onSave={(sim, saveId) => {
                        const title = calcTitle(sim, programs);
                        if (saveId) {
                            const list = putMilesCalcSave(saveId, title, sim);
                            setSaves(list);
                            return saveId;
                        }
                        const list = pushMilesCalcSave(title, sim);
                        setSaves(list);
                        return list[0].id;
                    }}
                    onClose={() => setCalc(null)}
                />
            ) : null}

            {history ? (
                <MilesCalcHistoryPop
                    saves={saves}
                    onOpen={(save) => {
                        setHistory(false);
                        setCalc({ kind: 'saved', save });
                    }}
                    onDrop={(id) => setSaves(dropMilesCalcSave(id))}
                    onClose={() => setHistory(false)}
                />
            ) : null}
        </section>
    );
}
