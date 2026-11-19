import { useMemo, useState } from 'react';
import { tripTotal } from '@motor/viagens/trips-engine.js';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { Trip, TripDestination } from '../types';
import type { TripDraft } from './ViagemFicha';
import { destinationTags, formatTripResumoDates, tripResumoDayStats } from '../domain/tripResumoStats';
import { formatBRL } from '../utils/map-utils';

const STATS = [
    { key: 'days' as const, label: 'Dias', icon: 'calendar_month', tint: 'oceano', unit: '', hint: 'Dias civis do intervalo da viagem.' },
    { key: 'durationDays' as const, label: 'Duração', icon: 'schedule', tint: 'turquesa', unit: 'd', hint: 'Duração do intervalo (inclusive início e fim).' },
    { key: 'tourismDays' as const, label: 'Turismo', icon: 'wb_sunny', tint: 'turquesa', unit: 'd', hint: 'Dias de turismo no cenário ou no roteiro.' },
    { key: 'vacationDays' as const, label: 'Férias', icon: 'eco', tint: 'coral', unit: 'd', hint: 'Dias de férias consumidos.' },
    { key: 'remoteDays' as const, label: 'Remotos', icon: 'laptop', tint: 'ouro', unit: '', hint: 'Dias úteis em trabalho remoto.' },
    { key: 'layoverCount' as const, label: 'Escalas', icon: 'flight', tint: 'turquesa', unit: '', hint: 'Escalas com visita no plano.' }
];

type BudgetFocus = 'overview' | 'goal' | 'reserved' | 'spent';

type Props = {
    trip: Trip;
    draft: TripDraft;
    destinations: TripDestination[];
};

function tripGoal(payload: TripDraft['payload']): number {
    return Number(payload.tripGoal ?? payload.trip_goal ?? 0) || 0;
}

function piggyBank(payload: TripDraft['payload']): number {
    return Number(payload.piggyBank ?? payload.piggy_bank ?? 0) || 0;
}

function moneyLabel(value: number): string {
    return value > 0 ? formatBRL(value) : '—';
}

function planBadge(payload: TripDraft['payload'], destinations: TripDestination[], startsOn: string, endsOn: string): {
    label: string;
    kind: 'scenario' | 'plan';
} | null {
    const chosenId = payload.chosen_time_scenario_id ?? payload.chosenTimeScenarioId;
    const scenarios = payload.time_scenarios ?? payload.timeScenarios ?? [];
    const chosen = chosenId ? scenarios.find((s) => s.id === chosenId) : undefined;
    if (chosen) {
        const name = String(chosen.title ?? chosen.name ?? '').trim();
        return { label: name || 'Cenário', kind: 'scenario' };
    }
    if (destinations.length > 0 || startsOn.trim() || endsOn.trim()) {
        return { label: 'Calendário e roteiro', kind: 'plan' };
    }
    return null;
}

function budgetCaption(goal: number, reserved: number, spent: number, focus: BudgetFocus): string {
    const stillToSave = Math.max(goal - reserved, 0);
    const overBudget = goal > 0 && spent > goal;
    if (focus === 'goal') return goal > 0 ? `Meta total planejada: ${formatBRL(goal)}` : 'Sem meta definida ainda';
    if (focus === 'reserved') return `No cofrinho: ${formatBRL(reserved)}`;
    if (focus === 'spent') return `Gastos lançados: ${formatBRL(spent)}`;
    if (goal <= 0) return 'Defina metas no módulo Orçamento para ver o progresso.';
    if (overBudget) return `Gastos acima da meta · falta ${formatBRL(stillToSave)} no cofrinho`;
    if (stillToSave <= 0) return `Cofrinho cobre a meta · ${formatBRL(spent)} já gastos na viagem`;
    return `${formatBRL(stillToSave)} para juntar · ${formatBRL(spent)} gastos`;
}

export function TripResumoPanel({ trip, draft, destinations }: Props) {
    const [budgetFocus, setBudgetFocus] = useState<BudgetFocus>('overview');
    const goal = tripGoal(draft.payload);
    const piggy = piggyBank(draft.payload);
    const spentVal = useMemo(
        () => tripTotal({ payload: draft.payload, budgetCaps: draft.budgetCaps }),
        [draft.payload, draft.budgetCaps]
    );
    const savePct = goal > 0 ? Math.min(115, Math.round((piggy / goal) * 100)) : 0;
    const spentPct = goal > 0 ? Math.min(115, Math.round((spentVal / goal) * 100)) : 0;
    const overBudget = goal > 0 && spentVal > goal;

    const stats = useMemo(
        () => tripResumoDayStats(draft.startsOn, draft.endsOn, draft.payload),
        [draft.startsOn, draft.endsOn, draft.payload]
    );

    const tags = useMemo(() => destinationTags(destinations), [destinations]);
    const datesLine = formatTripResumoDates(draft.startsOn, draft.endsOn);
    const badge = planBadge(draft.payload, destinations, draft.startsOn, draft.endsOn);
    const caption = budgetCaption(goal, piggy, spentVal, budgetFocus);

    function toggleFocus(chip: BudgetFocus) {
        setBudgetFocus((prev) => (prev === chip ? 'overview' : chip));
    }

    return (
        <article className="viagens-panel viagens-panel--resumo viagens-panel--resumo-mac" aria-label="Resumo da viagem">
            <header className="viagens-resumo__head">
                <h3 className="viagens-panel__title viagens-resumo__title">
                    <MaterialIcon name="luggage" variant="app" opticalSize={16} />
                    Resumo da viagem
                </h3>
                {badge ? (
                    <span className={`viagens-resumo__badge viagens-resumo__badge--${badge.kind}`}>
                        <MaterialIcon
                            name={badge.kind === 'scenario' ? 'verified' : 'calendar_clock'}
                            variant="app"
                            opticalSize={13}
                        />
                        {badge.label}
                    </span>
                ) : null}
                {datesLine !== 'Sem datas' ? <span className="viagens-resumo__dates">{datesLine}</span> : null}
            </header>

            <div className="viagens-resumo__stats" role="list">
                {STATS.map((s) => (
                    <div
                        key={s.key}
                        className={`viagens-resumo-stat viagens-resumo-stat--${s.tint}`}
                        title={s.hint}
                        role="listitem"
                    >
                        <span className="viagens-resumo-stat__icon" aria-hidden>
                            <MaterialIcon name={s.icon} variant="app" opticalSize={14} />
                        </span>
                        <span className="viagens-resumo-stat__copy">
                            <span className="viagens-resumo-stat__value">
                                {stats[s.key]}
                                {s.unit ? <span className="viagens-resumo-stat__unit"> {s.unit}</span> : null}
                            </span>
                            <span className="viagens-resumo-stat__label">{s.label}</span>
                        </span>
                    </div>
                ))}
            </div>

            {tags.length > 0 ? (
                <div className="viagens-resumo__tags" aria-label="Destinos">
                    {tags.map((t, i) => (
                        <span key={`${t.region}-${t.label}`} className={`viagens-resumo-tag viagens-resumo-tag--${i % 5}`}>
                            {t.region ? <span className="viagens-resumo-tag__region">{t.region}</span> : null}
                            <span className="viagens-resumo-tag__name">{t.label}</span>
                        </span>
                    ))}
                </div>
            ) : (
                <p className="viagens-muted viagens-resumo__no-dest">{trip.cityCount ?? 0} destinos</p>
            )}

            <div className="viagens-resumo__spacer" aria-hidden />

            <div className="viagens-resumo__meter">
                <div className="viagens-resumo__meter-chips">
                    <button
                        type="button"
                        className={`viagens-resumo-chip viagens-resumo-chip--ouro${budgetFocus === 'goal' ? ' is-focus' : ''}`}
                        onClick={() => toggleFocus('goal')}
                    >
                        <span>Meta</span>
                        <strong>{moneyLabel(goal)}</strong>
                    </button>
                    <button
                        type="button"
                        className={`viagens-resumo-chip viagens-resumo-chip--turquesa${budgetFocus === 'reserved' ? ' is-focus' : ''}`}
                        onClick={() => toggleFocus('reserved')}
                    >
                        <span>Cofrinho</span>
                        <strong>{moneyLabel(piggy)}</strong>
                    </button>
                    <button
                        type="button"
                        className={`viagens-resumo-chip viagens-resumo-chip--gastos${overBudget ? ' viagens-resumo-chip--coral' : ''}${budgetFocus === 'spent' ? ' is-focus' : ''}`}
                        onClick={() => toggleFocus('spent')}
                    >
                        <span>Gastos</span>
                        <strong>{moneyLabel(spentVal)}</strong>
                    </button>
                </div>
                <div
                    className="viagens-resumo__bar"
                    role="progressbar"
                    aria-valuenow={savePct}
                    aria-label="Progresso do cofrinho"
                    onClick={() => setBudgetFocus('overview')}
                >
                    <span className="viagens-resumo__bar-fill viagens-resumo__bar-fill--piggy" style={{ width: `${savePct}%` }} />
                    {spentVal > 0 ? (
                        <span
                            className={`viagens-resumo__bar-fill viagens-resumo__bar-fill--spent${overBudget ? ' is-over' : ''}`}
                            style={{ width: `${spentPct}%` }}
                        />
                    ) : null}
                </div>
                <p className="viagens-resumo__caption">{caption}</p>
            </div>
        </article>
    );
}
