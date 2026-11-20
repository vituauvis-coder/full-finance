import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    flightLedger,
    optionScore,
    tripFlightScenario,
    tripWalletPointsNeeded,
    usesMilesPath
} from '@motor/viagens/flight-ledger.js';
import {
    baggageLabel,
    connectionsCount,
    simulationFinalCost,
    simulationLabelLine,
    tripFlightSegments
} from '@motor/viagens/flight-simulation.js';
import { fetchMilesPrograms } from '../../api/miles';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatAirMs, simulationAirMs } from '../../domain/flightDisplay';
import { formatBRL } from '../../utils/map-utils';
import { formatPts, type ConversionRate, type MilesProgram } from '../../pages/pontos/pontos-format';
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
    programs: MilesProgram[];
    programsForLedger: MilesProgram[];
    walletLoading?: boolean;
    walletError?: string | null;
    onWalletReload: () => void;
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

export function VoosResumo({
    tripId,
    payload,
    programs,
    programsForLedger,
    walletLoading = false,
    walletError = null,
    onWalletReload
}: Props) {
    const [rates, setRates] = useState<ConversionRate[]>([]);
    const [sheet, setSheet] = useState<string | 'create' | null>(null);
    const [calc, setCalc] = useState<
        { kind: 'new' } | { kind: 'saved'; save: MilesCalcSave } | null
    >(null);
    const [history, setHistory] = useState(false);
    const [saves, setSaves] = useState<MilesCalcSave[]>(() => loadMilesCalcSaves());

    const needs = useMemo((): WalletNeed[] => {
        const fromFlights = tripWalletPointsNeeded(tripFlightSegments(payload) as TripFlightSegment[]);
        return programs.map((program) => {
            const needed = fromFlights.get(program.id) ?? 0;
            const have = program.available ?? program.balance;
            return { program, needed, gap: Math.max(0, needed - have) };
        });
    }, [programs, payload]);
    const scene = useMemo(
        () => tripFlightScenario(tripFlightSegments(payload) as TripFlightSegment[], programsForLedger),
        [payload, programsForLedger]
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

    useEffect(() => {
        if (!calc || rates.length > 0) return;
        let cancelled = false;
        void fetchMilesPrograms()
            .then((listed) => {
                if (!cancelled) setRates(listed.rates ?? []);
            })
            .catch(() => {
                if (!cancelled) setRates([]);
            });
        return () => {
            cancelled = true;
        };
    }, [calc, rates.length]);

    return (
        <section className="voos-resumo" aria-label="Resumo de passagens e carteira">
            <article className="voos-resumo__col voos-resumo__col--miles">
                <div className="voos-resumo__col-head">
                    <h2>Carteira</h2>
                    <div className="voos-resumo__tools">
                        <Link
                            to="/viagens/milhas"
                            className="voos-resumo__tool voos-resumo__tool--link"
                            title="Central de milhas"
                        >
                            <MaterialIcon name="loyalty" variant="app" opticalSize={18} />
                            Central
                        </Link>
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
                {walletError ? <p className="voos-resumo__hint">{walletError}</p> : null}
                {walletLoading && programs.length === 0 ? (
                    <p className="voos-resumo__hint voos-resumo__hint--loading" aria-live="polite">
                        Carregando carteira…
                    </p>
                ) : null}
                <CarteiraResumo programs={programs} needs={needs} onOpen={(id) => setSheet(id)} />
            </article>

            <article className="voos-resumo__col">
                <h2>Resumo de Passagens</h2>
                {scene.rows.length === 0 ? (
                    <p className="voos-resumo__hint">Monte um voo abaixo para ver o melhor cenário.</p>
                ) : (
                    <div className="voos-scene">
                        <div className="voos-scene__legs">
                            {scene.rows.map((row) => {
                                const sim = row.sim as TripFlightSimulation;
                                const miles = usesMilesPath(sim, programsForLedger);
                                const cost = optionScore(sim, programsForLedger);
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

            {sheet ? (
                <CarteiraSheet
                    tripId={tripId}
                    programId={sheet}
                    onClose={() => setSheet(null)}
                    onChanged={onWalletReload}
                />
            ) : null}

            {calc ? (
                <MilesCalculatorPop
                    key={calc.kind === 'new' ? 'new' : calc.save.id}
                    programs={programsForLedger}
                    rates={rates}
                    initial={calc.kind === 'new' ? null : calc.save.sim}
                    saveId={calc.kind === 'new' ? null : calc.save.id}
                    view={calc.kind === 'saved'}
                    originProgramId={programs[0]?.id}
                    fixed
                    onSave={(sim, saveId) => {
                        const title = calcTitle(sim, programsForLedger);
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
