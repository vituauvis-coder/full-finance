import {
    baggageLabel,
    connectionsCount,
    connectionLegRows,
    flightInsightLabel,
    flightPayWith,
    flightStatusLabel,
    simulationLabelLine
} from '@motor/viagens/flight-simulation.js';
import { flightLedger } from '@motor/viagens/flight-ledger.js';
import { unitLabel } from '@motor/milhas/catalog.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { DeleteIcon } from '../../../../components/icons/DeleteIcon';
import { formatBRL } from '../../utils/map-utils';
import { formatPts, type MilesProgram } from '../../pages/pontos/pontos-format';
import { flightDurationLabel, flightStampParts } from '../../domain/flightDisplay';
import type { TripFlightSimulation } from '../../types';
import { TransferBonusToggle } from './TransferBonusToggle';

type Props = {
    simulation: TripFlightSimulation;
    programs?: MilesProgram[];
    isCheapest: boolean;
    mark?: string;
    layout?: 'carousel' | 'list';
    onEdit: () => void;
    onCycleStatus: () => void;
    onChoose?: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onChange?: (next: TripFlightSimulation) => void;
};

function formatTax(amount: number, currency: string) {
    if (!(amount > 0)) return null;
    if (currency === 'BRL') return formatBRL(amount);
    return `${amount.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${currency}`;
}

type Stat = { label: string; value: string; tone?: 'out' | 'ok' };

function WhenLeg({
    kicker,
    departs,
    arrives,
    tone
}: {
    kicker: string;
    departs?: string | null;
    arrives?: string | null;
    tone: 'out' | 'in';
}) {
    const from = flightStampParts(departs);
    const to = flightStampParts(arrives);
    const dur = flightDurationLabel(departs, arrives);
    return (
        <div className={`voos-when voos-when--${tone}`}>
            <span className="voos-when__kicker">{kicker}</span>
            <div className="voos-when__times">
                <div className="voos-when__end">
                    <strong>{from?.time ?? '—'}</strong>
                    <span>{from?.date ?? 'Sem data'}</span>
                </div>
                <div className="voos-when__path" aria-hidden={dur ? undefined : true}>
                    <i />
                    <em>{dur ?? '→'}</em>
                    <i />
                </div>
                <div className="voos-when__end is-arr">
                    <strong>{to?.time ?? '—'}</strong>
                    <span>{to?.date ?? 'Sem data'}</span>
                </div>
            </div>
        </div>
    );
}

function PathPane({
    kicker,
    cost,
    qty,
    win,
    cheap,
    stats,
    covered,
    short,
    bonus,
    club
}: {
    kicker: string;
    cost: string;
    qty?: string;
    win: boolean;
    cheap?: boolean;
    stats: Stat[];
    covered?: number | null;
    short?: boolean;
    bonus?: { value: number; onChange: (percent: number) => void } | null;
    club?: string | null;
}) {
    return (
        <div className={`voos-sim-path voos-sim-path--solo${win ? ' is-win' : ''}`}>
            <span className="voos-sim-path__kicker">{kicker}</span>
            <strong className="voos-sim-path__brl">
                {cost}
                {cheap ? (
                    <em className="voos-sim-card__cheap" title="Menor custo do trecho">
                        ↓
                    </em>
                ) : null}
            </strong>
            {qty ? <em className="voos-sim-path__qty">{qty}</em> : null}
            {covered != null ? (
                <span className={`voos-sim-meter${short ? ' is-short' : ''}`} aria-hidden>
                    <span style={{ width: `${covered}%` }} />
                </span>
            ) : null}
            {stats.length > 0 ? (
                <dl className="voos-sim-stats">
                    {stats.map((s) => (
                        <div key={s.label} className={s.tone ? `is-${s.tone}` : undefined}>
                            <dt>{s.label}</dt>
                            <dd>{s.value}</dd>
                        </div>
                    ))}
                </dl>
            ) : null}
            {bonus || club ? (
                <div className="voos-sim-path__perks">
                    {bonus ? (
                        <TransferBonusToggle value={bonus.value} onChange={bonus.onChange} compact />
                    ) : null}
                    {club ? <span className="voos-sim-path__club">{club}</span> : null}
                </div>
            ) : null}
        </div>
    );
}

export function FlightSimCard({
    simulation,
    programs = [],
    isCheapest,
    mark,
    layout = 'carousel',
    onEdit,
    onCycleStatus,
    onChoose,
    onDuplicate,
    onDelete,
    onChange
}: Props) {
    const chosen = simulation.status === 'escolhida';
    const legs = connectionLegRows(simulation) as { id: string; leg: string; label: string }[];
    const L = flightLedger(simulation, programs) as ReturnType<typeof flightLedger>;
    const milesPath = flightPayWith(simulation) === 'points';
    const conn = connectionsCount(simulation) as number;
    const connLabel =
        conn > 0 ? `${conn} conexão${conn === 1 ? '' : 'ões'}` : 'Direto';
    const tax =
        L.taxesBrl > 0
            ? L.taxesCurrency !== 'BRL' && L.taxes > 0
                ? `${formatBRL(L.taxesBrl)} (${formatTax(L.taxes, L.taxesCurrency)})`
                : formatBRL(L.taxesBrl)
            : formatTax(L.taxes, L.taxesCurrency);
    const day = milesPath ? L.dayValue : L.cash;
    const covered =
        L.needed > 0 ? Math.min(100, Math.round((Math.max(0, L.have) / L.needed) * 100)) : null;
    const bags = baggageLabel(simulation.baggage);
    const destId = simulation.miles?.destinationProgramId ?? L.originId;
    const isTransfer = Boolean(L.originId && destId && L.originId !== destId);
    const bonusRate = L.bonusStored > 0 ? L.bonusStored : L.walletBonus;
    const showBonus = Boolean(L.hasMiles && isTransfer && bonusRate > 0 && onChange);

    const milesStats: Stat[] = [];
    if (tax) milesStats.push({ label: 'Taxa', value: tax });
    if (L.needed > 0 && L.needed !== L.destPts) {
        milesStats.push({ label: 'Debitar', value: formatPts(L.needed) });
    }
    if (L.gap > 0) {
        milesStats.push({ label: 'Faltam', value: formatPts(L.gap), tone: 'out' });
        if (L.extraBuy > 0) milesStats.push({ label: 'Comprar', value: formatBRL(L.extraBuy), tone: 'out' });
    }

    const cashStats: Stat[] = [];
    if (simulation.extrasAmount != null && simulation.extrasAmount > 0) {
        cashStats.push({ label: 'Extras', value: formatBRL(simulation.extrasAmount) });
    }

    function setBonus(percent: number) {
        if (!onChange) return;
        const miles = simulation.miles ?? {};
        const next = Math.max(0, Number(percent) || 0);
        onChange({
            ...simulation,
            miles: { ...miles, bonusPercent: next, bonusActive: next > 0 }
        });
    }

    function openEditor() {
        onEdit();
    }

    return (
        <article
            className={[
                'voos-sim-card',
                `voos-sim-card--${layout}`,
                chosen ? 'voos-sim-card--chosen' : '',
                simulation.status === 'descartada' ? 'voos-sim-card--discarded' : ''
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <header className="voos-sim-card__head">
                {simulation.status === 'descartada' || !onChoose ? (
                    <button
                        type="button"
                        className={`voos-capsule voos-capsule--${simulation.status}`}
                        onClick={onCycleStatus}
                    >
                        {flightStatusLabel(simulation.status)}
                    </button>
                ) : (
                    <button
                        type="button"
                        className={`voos-choose${chosen ? ' is-on' : ''}`}
                        aria-pressed={chosen}
                        onClick={onChoose}
                    >
                        {chosen ? 'Escolhido' : 'Escolher'}
                    </button>
                )}
                {mark ? (
                    <span className={`voos-sim-card__code${isCheapest ? ' is-best' : ''}`}>Voo {mark}</span>
                ) : null}
                {isCheapest && simulation.status !== 'descartada' ? (
                    <span className="voos-insight voos-insight--recomendado">Recomendado</span>
                ) : simulation.insight && simulation.insight !== 'recomendado' ? (
                    <span className={`voos-insight voos-insight--${simulation.insight}`}>
                        {flightInsightLabel(simulation.insight)}
                    </span>
                ) : null}
                <span className="voos-sim-card__spacer" />
                <button type="button" className="voos-icon-btn voos-icon-btn--oceano" onClick={onDuplicate} title="Duplicar">
                    <MaterialIcon name="content_copy" variant="app" opticalSize={16} />
                </button>
                <button type="button" className="voos-icon-btn voos-icon-btn--coral" onClick={onDelete} title="Apagar">
                    <DeleteIcon size="sm" />
                </button>
            </header>
            <div className="voos-sim-card__body" onClick={openEditor}>
                <strong className="voos-sim-card__title">{simulationLabelLine(simulation)}</strong>
                <div className="voos-sim-card__chips">
                    <span className="voos-pill voos-pill--turquesa">{connLabel}</span>
                    <span className="voos-pill voos-pill--turquesa">
                        {simulation.isRoundTrip ? 'Ida e volta' : 'Só ida'}
                    </span>
                    <span
                        className="voos-pill voos-pill--turquesa voos-pill--pax"
                        title={`${L.travelers} ${L.travelers === 1 ? 'pessoa' : 'pessoas'}`}
                    >
                        <MaterialIcon name="group" variant="app" opticalSize={14} />
                        {L.travelers}
                    </span>
                    {bags ? <span className="voos-pill voos-pill--turquesa">{bags}</span> : null}
                </div>
                <div className="voos-when-stack">
                    <WhenLeg
                        kicker="Ida"
                        tone="out"
                        departs={simulation.departsAt}
                        arrives={simulation.arrivesAt}
                    />
                    {simulation.isRoundTrip ? (
                        <WhenLeg
                            kicker="Volta"
                            tone="in"
                            departs={simulation.returnDepartsAt}
                            arrives={simulation.returnArrivesAt}
                        />
                    ) : null}
                </div>
                {legs.length > 0 ? (
                    <ul className="voos-leg-rows">
                        {legs.map((row) => (
                            <li key={row.id}>
                                <span className={`voos-leg-tag voos-leg-tag--${row.leg}`}>
                                    {row.leg === 'inbound' ? 'Volta' : 'Ida'}
                                </span>
                                {row.label}
                            </li>
                        ))}
                    </ul>
                ) : null}

                <div className="voos-sim-ledger">
                    {milesPath ? (
                        <PathPane
                            kicker="Milhas"
                            cost={L.dayValue > 0 ? formatBRL(L.dayValue) : '—'}
                            qty={
                                L.hasMiles
                                    ? `${formatPts(L.destPts)} ${unitLabel(L.destUnit, L.destPts)}`
                                    : undefined
                            }
                            win={isCheapest && simulation.status !== 'descartada'}
                            cheap={isCheapest && simulation.status !== 'descartada' && day > 0}
                            stats={milesStats}
                            covered={L.hasMiles ? covered : null}
                            short={L.gap > 0}
                            bonus={
                                showBonus
                                    ? {
                                          value: L.bonusOn ? bonusRate : 0,
                                          onChange: setBonus
                                      }
                                    : null
                            }
                            club={
                                L.hasMiles && L.clubActive
                                    ? L.clubFee > 0
                                        ? `Clube ${formatBRL(L.clubFee)}/mês`
                                        : 'Clube'
                                    : null
                            }
                        />
                    ) : (
                        <PathPane
                            kicker="Dinheiro"
                            cost={L.cash > 0 ? formatBRL(L.cash) : '—'}
                            win={isCheapest && simulation.status !== 'descartada'}
                            cheap={isCheapest && simulation.status !== 'descartada' && day > 0}
                            stats={cashStats}
                        />
                    )}
                </div>
            </div>
        </article>
    );
}
