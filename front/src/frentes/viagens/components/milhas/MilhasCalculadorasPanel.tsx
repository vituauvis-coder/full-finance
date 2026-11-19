import { useMemo, useState } from 'react';
import { rateForPair } from '@motor/milhas/catalog.js';
import { compareCashVsPoints } from '@motor/viagens/miles-wallet.js';
import { emptyFlightSimulation } from '@motor/viagens/flight-simulation.js';
import { formatBRL } from '../../utils/map-utils';
import { DecimalField, PtsField, Segmented, SelectField } from '../../pages/pontos/PontosFields';
import type { ConversionRate, MilesProgram } from '../../pages/pontos/pontos-format';
import type { TripFlightSimulation } from '../../types';
import { FlightMilesBlock } from '../voos/FlightMilesBlock';
import { MilhasMilheiroCalculator } from './MilhasMilheiroCalculator';

type Props = {
    programs: MilesProgram[];
    rates: ConversionRate[];
    originProgramId?: string;
    embedded?: boolean;
};

function seedSim(originProgramId: string | undefined, programs: MilesProgram[], rates: ConversionRate[]): TripFlightSimulation {
    const origin = programs.find((p) => p.id === originProgramId) ?? programs[0];
    const dest =
        programs.find((p) => p.id !== origin?.id && (p.unit === 'avios' || p.unit === 'milhas')) ??
        programs.find((p) => p.unit === 'avios' || p.unit === 'milhas') ??
        origin;
    const saved =
        origin && dest
            ? rates.find((r) => r.fromProgramId === origin.id && r.toProgramId === dest.id)
            : undefined;
    const next =
        origin && dest && origin.id !== dest.id
            ? rateForPair(saved, origin.unit, dest.unit, origin.transferBonusPercent)
            : { from: 1, to: 1, bonusPercent: 0 };
    return {
        ...(emptyFlightSimulation() as TripFlightSimulation),
        miles: {
            payWith: 'points',
            originProgramId: origin?.id ?? null,
            destinationProgramId: dest?.id ?? null,
            destinationPoints: null,
            taxesAmount: null,
            taxesCurrency: 'EUR',
            conversionFrom: next.from,
            conversionTo: next.to,
            bonusPercent: next.bonusPercent,
            bonusActive: true,
            emissionId: null
        }
    };
}

function money(n: number | null | undefined) {
    if (n == null || !Number.isFinite(n)) return '—';
    return formatBRL(n);
}

export function MilhasCalculadorasPanel({ programs, rates, originProgramId, embedded }: Props) {
    const [tool, setTool] = useState<'cmp' | 'compare' | 'emissao'>('cmp');
    const [cashBrl, setCashBrl] = useState(0);
    const [pointsRequired, setPointsRequired] = useState(0);
    const [programId, setProgramId] = useState(originProgramId ?? programs[0]?.id ?? '');
    const [sim, setSim] = useState(() => seedSim(originProgramId ?? programs[0]?.id, programs, rates));

    const selected = programs.find((p) => p.id === programId) ?? programs[0];
    const milheiro = Number(selected?.milheiro) > 0 ? Number(selected?.milheiro) : 0;

    const comparison = useMemo(() => {
        if (!selected) return null;
        return compareCashVsPoints({
            cashBrl,
            pointsRequired,
            milheiroBrl: milheiro,
            balance: selected.available ?? selected.balance
        });
    }, [cashBrl, pointsRequired, milheiro, selected]);

    if (programs.length === 0) {
        return (
            <div className={embedded ? 'milhas-pane' : 'pontos-sheet'}>
                <p className="voos-muted">Crie uma carteira para usar as calculadoras.</p>
            </div>
        );
    }

    const pane = embedded ? 'milhas-pane milhas-pane--tools' : 'pontos-sheet pontos-sheet--form';

    return (
        <div className={embedded ? 'milhas-tools' : 'pontos-calc-stack'} aria-label="Calculadoras">
            {embedded ? (
                <Segmented
                    value={tool}
                    onChange={(v) => setTool(v as typeof tool)}
                    options={[
                        ['cmp', 'Milheiro (CMP)'],
                        ['compare', 'Dinheiro vs pontos'],
                        ['emissao', 'Emissão']
                    ]}
                />
            ) : null}
            {embedded && tool === 'cmp' ? (
                <MilhasMilheiroCalculator
                    embedded
                    programs={programs}
                    rates={rates}
                    originProgramId={programId || originProgramId}
                />
            ) : null}
            {embedded && tool === 'compare' ? (
                <div className={pane}>
                    <p className="voos-muted">Compare o trecho em reais com o custo implícito dos pontos.</p>
                    <DecimalField label="Preço em dinheiro" value={cashBrl} onChange={setCashBrl} suffix="R$" />
                    <PtsField label="Pontos da emissão" value={pointsRequired} onChange={setPointsRequired} />
                    <SelectField label="Carteira" value={programId} onChange={setProgramId}>
                        {programs.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </SelectField>
                    {comparison && (cashBrl > 0 || pointsRequired > 0) ? (
                        <div className="pontos-calc-verdict">
                            <p>
                                Dinheiro: <strong>{money(comparison.cashBrl)}</strong>
                            </p>
                            <p>
                                Pontos em R$:{' '}
                                <strong>
                                    {comparison.pointsCostBrl != null ? money(comparison.pointsCostBrl) : '—'}
                                </strong>
                                {milheiro > 0 ? ` · milheiro ${formatBRL(milheiro)}` : null}
                            </p>
                            <p>
                                {comparison.enoughPoints
                                    ? 'Saldo cobre a emissão.'
                                    : `Faltam ${comparison.missingPoints.toLocaleString('pt-BR')} pontos.`}
                            </p>
                            <p className="pontos-calc-verdict__tag">
                                {comparison.cheaper === 'points'
                                    ? `Pontos saem ${money(Math.abs(comparison.savingBrl ?? 0))} mais baratos.`
                                    : comparison.cheaper === 'cash'
                                      ? `Dinheiro sai ${money(Math.abs(comparison.savingBrl ?? 0))} mais barato.`
                                      : 'Empate entre dinheiro e pontos.'}
                            </p>
                        </div>
                    ) : null}
                </div>
            ) : null}
            {embedded && tool === 'emissao' ? (
                <div className={`${pane} pontos-sheet--calc`}>
                    <p className="voos-muted">Origem, destino, conversão e taxas — sem amarrar a uma viagem.</p>
                    <FlightMilesBlock
                        simulation={sim}
                        programs={programs}
                        rates={rates}
                        onChange={(miles) => setSim((current) => ({ ...current, miles }))}
                        pointsOnly
                        walletsReady
                    />
                </div>
            ) : null}
            {!embedded ? (
                <>
                    <MilhasMilheiroCalculator programs={programs} rates={rates} originProgramId={programId || originProgramId} />
                    <div className="pontos-calc-grid">
                        <article className="pontos-sheet pontos-sheet--form">
                            <p className="pontos-kicker">Calculadora</p>
                            <h3>Dinheiro vs pontos</h3>
                            <p className="voos-muted">Compare o trecho em reais com o custo implícito dos pontos.</p>
                            <DecimalField label="Preço em dinheiro" value={cashBrl} onChange={setCashBrl} suffix="R$" />
                            <PtsField label="Pontos da emissão" value={pointsRequired} onChange={setPointsRequired} />
                            <SelectField label="Carteira" value={programId} onChange={setProgramId}>
                                {programs.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </SelectField>
                            {comparison && (cashBrl > 0 || pointsRequired > 0) ? (
                                <div className="pontos-calc-verdict">
                                    <p>
                                        Dinheiro: <strong>{money(comparison.cashBrl)}</strong>
                                    </p>
                                    <p>
                                        Pontos em R$:{' '}
                                        <strong>
                                            {comparison.pointsCostBrl != null ? money(comparison.pointsCostBrl) : '—'}
                                        </strong>
                                        {milheiro > 0 ? ` · milheiro ${formatBRL(milheiro)}` : null}
                                    </p>
                                    <p>
                                        {comparison.enoughPoints
                                            ? 'Saldo cobre a emissão.'
                                            : `Faltam ${comparison.missingPoints.toLocaleString('pt-BR')} pontos.`}
                                    </p>
                                    <p className="pontos-calc-verdict__tag">
                                        {comparison.cheaper === 'points'
                                            ? `Pontos saem ${money(Math.abs(comparison.savingBrl ?? 0))} mais baratos.`
                                            : comparison.cheaper === 'cash'
                                              ? `Dinheiro sai ${money(Math.abs(comparison.savingBrl ?? 0))} mais barato.`
                                              : 'Empate entre dinheiro e pontos.'}
                                    </p>
                                </div>
                            ) : null}
                        </article>
                        <article className="pontos-sheet pontos-sheet--form pontos-sheet--calc">
                            <p className="pontos-kicker">Calculadora</p>
                            <h3>Simulação de emissão</h3>
                            <p className="voos-muted">Origem, destino, conversão e taxas — sem amarrar a uma viagem.</p>
                            <FlightMilesBlock
                                simulation={sim}
                                programs={programs}
                                rates={rates}
                                onChange={(miles) => setSim((current) => ({ ...current, miles }))}
                                pointsOnly
                                walletsReady
                            />
                        </article>
                    </div>
                </>
            ) : null}
        </div>
    );
}