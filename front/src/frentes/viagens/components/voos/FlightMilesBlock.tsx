import { useEffect, useMemo, useRef } from 'react';
import { rateForPair, unitLabel } from '@motor/milhas/catalog.js';
import { flightPayWith, simulationFinalCost } from '@motor/viagens/flight-simulation.js';
import { flightLedger } from '@motor/viagens/flight-ledger.js';
import { DEFAULT_TAX_FX, effectiveTaxFxRate } from '@motor/viagens/tax-fx.js';
import { createEmission, patchEmission } from '../../api/miles';
import { useTaxFxQuotes } from '../../hooks/useTaxFxQuotes';
import { formatBRL } from '../../utils/map-utils';
import { DecimalField, PtsField, SelectField } from '../../pages/pontos/PontosFields';
import { formatPts, type ConversionRate, type MilesProgram } from '../../pages/pontos/pontos-format';
import type { TripFlightMiles, TripFlightSimulation } from '../../types';
import { TransferBonusToggle } from './TransferBonusToggle';

const TAX_CURRENCIES = ['EUR', 'USD', 'BRL', 'GBP'];

type EmissionLite = {
    id: string;
    flightSimulationId?: string | null;
    status?: string;
};

type Props = {
    tripId?: string;
    simulation: TripFlightSimulation;
    programs: MilesProgram[];
    rates: ConversionRate[];
    emissions?: EmissionLite[];
    onChange: (miles: TripFlightMiles) => void;
    onCashChange?: (patch: { amount: number | null; extrasAmount: number | null }) => void;
    walletsReady?: boolean;
    pointsOnly?: boolean;
    readOnly?: boolean;
};

function emptyMiles(): TripFlightMiles {
    return {
        payWith: 'cash',
        originProgramId: null,
        destinationProgramId: null,
        destinationPoints: null,
        taxesAmount: null,
        taxesCurrency: 'EUR',
        taxFxRate: DEFAULT_TAX_FX.EUR,
        taxIofPercent: 0,
        taxSpreadPercent: 0,
        conversionFrom: 2,
        conversionTo: 1,
        bonusPercent: 0,
        bonusActive: true,
        emissionId: null
    };
}

function asMiles(sim: TripFlightSimulation): TripFlightMiles {
    return sim.miles ?? emptyMiles();
}

function unitOf(program?: MilesProgram | null) {
    return program?.unit || 'pontos';
}

function suggestFlightWallets(programs: MilesProgram[]): Pick<
    TripFlightMiles,
    'originProgramId' | 'destinationProgramId'
> {
    if (programs.length === 0) return { originProgramId: null, destinationProgramId: null };
    const origin = programs.find((p) => unitOf(p) === 'pontos') ?? programs[0];
    const dest =
        programs.find((p) => p.id !== origin.id && (unitOf(p) === 'avios' || unitOf(p) === 'milhas')) ??
        programs.find((p) => unitOf(p) === 'avios' || unitOf(p) === 'milhas') ??
        origin;
    return { originProgramId: origin.id, destinationProgramId: dest.id };
}

function ratePatch(
    rates: ConversionRate[],
    origin?: MilesProgram,
    dest?: MilesProgram
): Pick<TripFlightMiles, 'conversionFrom' | 'conversionTo' | 'bonusPercent'> {
    if (!origin || !dest || origin.id === dest.id) {
        return { conversionFrom: 1, conversionTo: 1, bonusPercent: 0 };
    }
    const saved = rates.find((r) => r.fromProgramId === origin.id && r.toProgramId === dest.id);
    const next = rateForPair(saved, origin.unit, dest.unit, origin.transferBonusPercent);
    return { conversionFrom: next.from, conversionTo: next.to, bonusPercent: next.bonusPercent };
}

function numOrNull(raw: string): number | null {
    if (raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

function cashOrNull(n: number): number | null {
    return n > 0 ? n : null;
}

export function FlightMilesBlock({
    tripId,
    simulation,
    programs,
    rates,
    emissions = [],
    onChange,
    onCashChange,
    walletsReady = true,
    pointsOnly = false,
    readOnly = false
}: Props) {
    const miles = asMiles(simulation);
    const cash = simulationFinalCost(simulation);
    const origin = programs.find((p) => p.id === miles.originProgramId);
    const dest = programs.find((p) => p.id === miles.destinationProgramId);
    const pairKey = `${miles.originProgramId ?? ''}:${miles.destinationProgramId ?? ''}:${origin?.transferBonusPercent ?? 0}`;
    const persistAt = useRef(0);
    const lastPayload = useRef('');
    const lastPair = useRef('');
    const createdId = useRef(miles.emissionId ?? null);
    const persistBusy = useRef(false);
    const mode = pointsOnly || flightPayWith(simulation) === 'points' ? 'points' : 'cash';

    useEffect(() => {
        if (readOnly) return;
        if (mode !== 'points') return;
        if (programs.length === 0) return;
        if (miles.originProgramId && miles.destinationProgramId) return;
        const suggested = suggestFlightWallets(programs);
        const nextOrigin = programs.find((p) => p.id === (miles.originProgramId || suggested.originProgramId));
        const nextDest = programs.find((p) => p.id === (miles.destinationProgramId || suggested.destinationProgramId));
        onChange({
            ...miles,
            originProgramId: nextOrigin?.id ?? null,
            destinationProgramId: nextDest?.id ?? null,
            ...ratePatch(rates, nextOrigin, nextDest)
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- fill wallets once programs arrive or mode becomes points
    }, [programs, miles.originProgramId, miles.destinationProgramId, mode]);

    useEffect(() => {
        if (mode !== 'points') return;
        if (!origin || !dest) return;
        if (readOnly) {
            lastPair.current = pairKey;
            return;
        }
        if (lastPair.current === pairKey) return;
        lastPair.current = pairKey;
        const next = ratePatch(rates, origin, dest);
        if (
            next.conversionFrom === miles.conversionFrom &&
            next.conversionTo === miles.conversionTo &&
            next.bonusPercent === miles.bonusPercent
        ) {
            return;
        }
        onChange({ ...miles, ...next });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- apply stored/suggested rate only when the pair changes
    }, [pairKey, origin?.id, dest?.id, rates, mode]);

    const fxQuotes = useTaxFxQuotes();
    const taxCurrency = miles.taxesCurrency || 'EUR';
    const taxAmount = Number(miles.taxesAmount ?? 0) || 0;
    const taxFx = effectiveTaxFxRate(taxCurrency, miles.taxFxRate, fxQuotes?.rates);

    const simulationForLedger = useMemo(() => {
        if (taxCurrency === 'BRL' || taxFx === miles.taxFxRate) return simulation;
        return {
            ...simulation,
            miles: { ...miles, taxFxRate: taxFx }
        };
    }, [simulation, miles, taxCurrency, taxFx, miles.taxFxRate]);

    const ledger = useMemo(() => flightLedger(simulationForLedger, programs), [simulationForLedger, programs]);

    const taxConvHint = useMemo(() => {
        if (taxCurrency === 'BRL' || taxAmount <= 0) return null;
        const amt = taxAmount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        const fx = taxFx.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
        const extras: string[] = [];
        if ((miles.taxIofPercent ?? 0) > 0) extras.push(`IOF ${miles.taxIofPercent}%`);
        if ((miles.taxSpreadPercent ?? 0) > 0) extras.push(`spread ${miles.taxSpreadPercent}%`);
        const tail = extras.length ? ` · ${extras.join(' · ')}` : '';
        const fxSrc = fxQuotes?.stale
            ? `câmbio ref. ${fx}`
            : `câmbio comercial ${fx}${fxQuotes?.asOf ? ` (${fxQuotes.asOf})` : ''}`;
        const brl =
            ledger.taxesBrl > 0
                ? `≈ ${formatBRL(ledger.taxesBrl)} no custo do dia`
                : 'Conversão automática para o custo em real';
        return `${amt} ${taxCurrency} · ${fxSrc}${tail} · ${brl}`;
    }, [
        taxAmount,
        taxCurrency,
        taxFx,
        ledger.taxesBrl,
        miles.taxIofPercent,
        miles.taxSpreadPercent,
        fxQuotes?.stale,
        fxQuotes?.asOf
    ]);

    useEffect(() => {
        if (readOnly || !fxQuotes?.rates) return;
        if (taxCurrency === 'BRL') return;
        const live = fxQuotes.rates[taxCurrency];
        if (!(live > 0)) return;
        const rounded = Number(live.toFixed(6));
        if (miles.taxFxRate != null && Math.abs(miles.taxFxRate - rounded) < 0.0005) return;
        patch({ taxFxRate: rounded });
    }, [fxQuotes?.rates, fxQuotes?.asOf, taxCurrency, readOnly, miles.taxFxRate]);
    const needed = ledger.needed;
    const have = ledger.have;
    const gap = ledger.gap;
    const milheiro = ledger.milheiro;
    const converting = Boolean(origin && dest && origin.id !== dest.id);

    useEffect(() => {
        if (readOnly) return;
        if (!tripId || !origin || !dest || !miles.destinationPoints) return;
        const handle = window.setTimeout(() => {
            const now = Date.now();
            if (now - persistAt.current < 400) return;
            persistAt.current = now;
            const title =
                [simulation.origin, simulation.destination].filter(Boolean).join(' → ') ||
                simulation.label ||
                'Emissão do voo';
            const payload = {
                tripId,
                title,
                originProgramId: origin.id,
                destinationProgramId: dest.id,
                conversionFrom: miles.conversionFrom ?? 2,
                conversionTo: miles.conversionTo ?? 1,
                bonusPercent: miles.bonusPercent ?? 0,
                buyMilheiro: milheiro || 14,
                fxRate:
                    (miles.taxesCurrency || 'EUR') === 'BRL'
                        ? 1
                        : miles.taxFxRate ?? DEFAULT_TAX_FX[miles.taxesCurrency as keyof typeof DEFAULT_TAX_FX] ?? 6.2,
                iofPercent: miles.taxIofPercent ?? 0,
                spreadPercent: miles.taxSpreadPercent ?? 0,
                flightSimulationId: simulation.id,
                options: [
                    {
                        label: 'Tarifa',
                        destinationPoints: miles.destinationPoints,
                        taxesAmount: miles.taxesAmount ?? 0,
                        taxesCurrency: miles.taxesCurrency || 'EUR'
                    }
                ]
            };
            const encoded = JSON.stringify(payload);
            const knownId =
                miles.emissionId ||
                createdId.current ||
                emissions.find((e) => e.flightSimulationId === simulation.id)?.id ||
                null;
            if (encoded === lastPayload.current && knownId) return;
            if (persistBusy.current) return;
            lastPayload.current = encoded;
            persistBusy.current = true;
            void (knownId ? patchEmission(knownId, payload) : createEmission(payload))
                .then((res) => {
                    const id = (res as { emission?: { id: string } }).emission?.id ?? knownId;
                    if (id) createdId.current = id;
                    if (id && id !== miles.emissionId) onChange({ ...miles, emissionId: id });
                })
                .catch(() => {
                    /* o registro do voo já guarda os campos; a emissão pode sincronizar depois */
                })
                .finally(() => {
                    persistBusy.current = false;
                });
        }, 700);
        return () => window.clearTimeout(handle);
    }, [
        tripId,
        simulation.id,
        simulation.origin,
        simulation.destination,
        simulation.label,
        miles,
        origin,
        dest,
        milheiro,
        emissions,
        onChange
    ]);

    function patch(partial: Partial<TripFlightMiles>) {
        onChange({ ...miles, ...partial });
    }

    function setDestinationPoints(destinationPoints: number) {
        const qty = destinationPoints > 0 ? destinationPoints : null;
        patch({
            destinationPoints: qty,
            payWith: 'points'
        });
    }

    const fareUnit = unitLabel(dest?.unit || 'avios', 2);
    const paxLabel = ledger.travelers === 1 ? '1 pessoa' : `${ledger.travelers} pessoas`;
    const showBonus = converting;
    const ticket = Math.max(Number(simulation.amount) || 0, 0);
    const extras = Math.max(Number(simulation.extrasAmount) || 0, 0);
    const perPerson = cash > 0 ? cash / Math.max(ledger.travelers, 1) : 0;

    function setBonus(percent: number) {
        const next = Math.max(0, Number(percent) || 0);
        patch({ bonusPercent: next, bonusActive: next > 0 });
    }

    const pointsPane =
        programs.length < 1 ? (
            <p className="voo-pay__empty">
                {walletsReady
                    ? 'Crie uma carteira no resumo da viagem para emitir com pontos.'
                    : 'Carregando carteira…'}
            </p>
        ) : (
            <>
                <div className="voo-pay__grid voo-pay__grid--in">
                    <SelectField
                        label="Programa da tarifa"
                        value={miles.destinationProgramId ?? ''}
                        onChange={(destinationProgramId) =>
                            patch({ destinationProgramId: destinationProgramId || null })
                        }
                    >
                        <option value="">Onde a passagem está cotada</option>
                        {programs.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name} · {unitLabel(p.unit || 'pontos', 2)}
                            </option>
                        ))}
                    </SelectField>
                    <SelectField
                        label="Debitar da carteira"
                        value={miles.originProgramId ?? ''}
                        onChange={(originProgramId) => patch({ originProgramId: originProgramId || null })}
                    >
                        <option value="">De onde saem os pontos</option>
                        {programs.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name} · {formatPts(p.balance)}
                            </option>
                        ))}
                    </SelectField>
                </div>
                <div className={`voo-pay__grid voo-pay__grid--fare${showBonus ? ' has-bonus' : ''}`}>
                    <PtsField
                        label={`Quantidade · ${fareUnit}`}
                        value={miles.destinationPoints ?? 0}
                        onChange={setDestinationPoints}
                    />
                    <div className="voos-field voo-pay__tax">
                        <span
                            className={taxConvHint ? 'voo-pay__tax-leg' : undefined}
                            data-conv-hint={taxConvHint ?? undefined}
                            tabIndex={taxConvHint ? 0 : undefined}
                        >
                            Taxa de embarque
                        </span>
                        <div className="voo-pay__amount-ccy">
                            <input
                                className="viagens-field"
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="0,00"
                                aria-label="Taxa de embarque"
                                value={miles.taxesAmount ?? ''}
                                onChange={(e) => patch({ taxesAmount: numOrNull(e.target.value) })}
                            />
                            <select
                                className="viagens-field"
                                value={taxCurrency}
                                onChange={(e) => {
                                    const code = e.target.value;
                                    const suggested =
                                        code === 'BRL'
                                            ? 1
                                            : fxQuotes?.rates?.[code] ??
                                              DEFAULT_TAX_FX[code as keyof typeof DEFAULT_TAX_FX] ??
                                              1;
                                    patch({ taxesCurrency: code, taxFxRate: suggested });
                                }}
                                aria-label="Moeda da taxa"
                            >
                                {TAX_CURRENCIES.map((code) => (
                                    <option key={code} value={code}>
                                        {code}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {showBonus ? (
                        <div className="voos-field voo-pay__bonus-field">
                            <span>Bônus de transferência</span>
                            <TransferBonusToggle
                                value={ledger.bonusPercent}
                                onChange={setBonus}
                                field
                            />
                        </div>
                    ) : null}
                </div>
                <div className="voo-pay__grid voo-pay__grid--stats">
                    <div className="voo-pay__stat">
                        <span>Precisa debitar</span>
                        <strong>{needed > 0 ? formatPts(needed) : '—'}</strong>
                    </div>
                    <div className="voo-pay__stat">
                        <span>Saldo</span>
                        <strong>{origin ? formatPts(have) : '—'}</strong>
                    </div>
                    <div className={`voo-pay__stat${needed > 0 ? (gap > 0 ? ' is-out' : ' is-ok') : ''}`}>
                        <span>{gap > 0 ? 'Faltam' : 'Cobre a tarifa'}</span>
                        <strong>{needed > 0 ? (gap > 0 ? formatPts(gap) : 'ok') : '—'}</strong>
                    </div>
                </div>
                {ledger.hasMiles ? (
                    <div className="voo-pay__hero">
                        <dl className="voo-pay__sum">
                            {ledger.priced && ledger.ownedPts > 0 ? (
                                <div>
                                    <dt>Na carteira · {formatPts(ledger.ownedPts)}</dt>
                                    <dd>{formatBRL(ledger.ownedBrl)}</dd>
                                </div>
                            ) : null}
                            {gap > 0 ? (
                                <div className={ledger.extraBuy > 0 ? 'is-out' : 'is-mute'}>
                                    <dt>Comprar · {formatPts(gap)}</dt>
                                    <dd>
                                        {ledger.extraBuy > 0 ? formatBRL(ledger.extraBuy) : 'sem milheiro'}
                                    </dd>
                                </div>
                            ) : null}
                            {ledger.taxesBrl > 0 ? (
                                <div>
                                    <dt>Taxa</dt>
                                    <dd>{formatBRL(ledger.taxesBrl)}</dd>
                                </div>
                            ) : null}
                        </dl>
                        <div className="voo-pay__hero-main">
                            <span>Custo total</span>
                            <strong>{ledger.dayValue > 0 ? formatBRL(ledger.dayValue) : '—'}</strong>
                            <div className="voo-pay__hero-pills">
                                <span>{paxLabel}</span>
                                {ledger.priced && ledger.milheiro > 0 ? (
                                    <span>Milheiro {formatBRL(ledger.milheiro)}</span>
                                ) : null}
                                {ledger.clubActive ? (
                                    <span>
                                        {ledger.clubFee > 0
                                            ? `Clube ${formatBRL(ledger.clubFee)}/mês`
                                            : 'Clube'}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ) : null}
            </>
        );

    const cashPane = (
        <>
            <div className="voo-pay__grid voo-pay__grid--cash">
                <DecimalField
                    label="Passagem"
                    value={simulation.amount ?? 0}
                    onChange={(n) =>
                        onCashChange?.({
                            amount: cashOrNull(n),
                            extrasAmount: simulation.extrasAmount ?? null
                        })
                    }
                    suffix="R$"
                />
                <DecimalField
                    label="Extras"
                    value={simulation.extrasAmount ?? 0}
                    onChange={(n) =>
                        onCashChange?.({
                            amount: simulation.amount ?? null,
                            extrasAmount: cashOrNull(n)
                        })
                    }
                    suffix="R$"
                />
            </div>
            <div className="voo-pay__grid voo-pay__grid--stats">
                <div className="voo-pay__stat">
                    <span>Por pessoa</span>
                    <strong>{perPerson > 0 ? formatBRL(perPerson) : '—'}</strong>
                </div>
                <div className="voo-pay__stat">
                    <span>Extras</span>
                    <strong>{extras > 0 ? formatBRL(extras) : '—'}</strong>
                </div>
            </div>
            <div className="voo-pay__hero voo-pay__hero--cash">
                <dl className="voo-pay__sum">
                    <div>
                        <dt>Passagem</dt>
                        <dd>{ticket > 0 ? formatBRL(ticket) : '—'}</dd>
                    </div>
                    <div className={extras > 0 ? undefined : 'is-mute'}>
                        <dt>Extras</dt>
                        <dd>{extras > 0 ? formatBRL(extras) : '—'}</dd>
                    </div>
                </dl>
                <div className="voo-pay__hero-main">
                    <span>Custo total</span>
                    <strong>{cash > 0 ? formatBRL(cash) : '—'}</strong>
                    <div className="voo-pay__hero-pills">
                        <span>{paxLabel}</span>
                        {extras > 0 ? <span>inclui extras</span> : null}
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <section
            className={`voo-pay${mode === 'points' && miles.destinationPoints ? ' voo-pay--points' : ''}${
                mode === 'cash' ? ' voo-pay--cash' : ''
            }${readOnly ? ' voo-pay--view' : ''}`}
            aria-label="Custo"
        >
            {pointsOnly ? null : (
                <header className="voo-pay__head">
                    <p className="pontos-kicker">Custo</p>
                    <div className="voo-pay__mode voo-pay__tabs" role="tablist" aria-label="Tipo de cotação">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={mode === 'points'}
                            className={mode === 'points' ? 'is-on' : undefined}
                            onClick={() => patch({ payWith: 'points' })}
                        >
                            Com milhas
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={mode === 'cash'}
                            className={mode === 'cash' ? 'is-on' : undefined}
                            onClick={() => patch({ payWith: 'cash' })}
                        >
                            Sem milhas
                        </button>
                    </div>
                </header>
            )}
            <fieldset className="voo-pay__lock" disabled={readOnly}>
                <div className="voo-pay__pane is-on">
                    {mode === 'points' ? pointsPane : cashPane}
                </div>
            </fieldset>
        </section>
    );
}
