import { useMemo } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { Trip, TripDestination, TripFinanceMovementLine } from '../types';
import type { TripDraft } from './ViagemFicha';
import { chosenScenarioFromPayload } from '../domain/chosenScenarioResumo';
import { destinationTags, tripResumoDatesLine, tripResumoDayStats } from '../domain/tripResumoStats';
import { buildOrcamentoSnapshot } from './orcamento/orcamento-model';
import { TripFichaPanel, TripFichaPanelBody, TripFichaPanelHeader } from './ficha/TripFichaPanel';
import { TripResumoOrcamentoViz } from './TripResumoOrcamentoViz';
import { TripResumoRotaSection } from './TripResumoRotaSection';

const STATS = [
    { key: 'days' as const, label: 'Dias', icon: 'calendar_month', tint: 'oceano', unit: '', hint: 'Dias civis do intervalo da viagem.' },
    { key: 'durationDays' as const, label: 'Duração', icon: 'schedule', tint: 'turquesa', unit: 'd', hint: 'Duração do intervalo (inclusive início e fim).' },
    { key: 'tourismDays' as const, label: 'Turismo', icon: 'wb_sunny', tint: 'turquesa', unit: 'd', hint: 'Dias de turismo no cenário ou no roteiro.' },
    { key: 'vacationDays' as const, label: 'Férias', icon: 'eco', tint: 'coral', unit: 'd', hint: 'Dias de férias consumidos.' },
    { key: 'remoteDays' as const, label: 'Remotos', icon: 'laptop', tint: 'ouro', unit: '', hint: 'Dias úteis em trabalho remoto.' },
    { key: 'layoverCount' as const, label: 'Escalas', icon: 'flight', tint: 'turquesa', unit: '', hint: 'Escalas com visita no plano.' }
];

type Props = {
    trip: Trip;
    draft: TripDraft;
    destinations: TripDestination[];
    financeMovements?: TripFinanceMovementLine[];
};

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

export function TripResumoPanel({ trip, draft, destinations, financeMovements = [] }: Props) {
    const orcSnap = useMemo(
        () => buildOrcamentoSnapshot(draft, new Date(), { financeMovements }),
        [draft, financeMovements]
    );
    const stats = useMemo(
        () => tripResumoDayStats(draft.startsOn, draft.endsOn, draft.payload, destinations),
        [draft.startsOn, draft.endsOn, draft.payload, destinations]
    );

    const tags = useMemo(() => destinationTags(destinations), [destinations]);
    const hasChosenScenario = Boolean(chosenScenarioFromPayload(draft.payload));
    const datesLine = useMemo(
        () => tripResumoDatesLine(draft.startsOn, draft.endsOn, draft.payload, destinations),
        [draft.startsOn, draft.endsOn, draft.payload, destinations]
    );
    const badge = planBadge(draft.payload, destinations, draft.startsOn, draft.endsOn);

    const meta =
        badge || datesLine !== 'Sem datas' ? (
            <>
                {badge ? (
                    <span
                        className="viagens-ficha-panel__pill viagens-ficha-panel__pill--turquesa"
                    >
                        <MaterialIcon
                            name={badge.kind === 'scenario' ? 'verified' : 'calendar_clock'}
                            variant="app"
                            opticalSize={13}
                        />
                        {badge.label}
                    </span>
                ) : null}
                {datesLine !== 'Sem datas' ? (
                    <span className="viagens-ficha-panel__meta-note">{datesLine}</span>
                ) : null}
            </>
        ) : null;

    return (
        <TripFichaPanel
            className="viagens-panel--resumo viagens-panel--resumo-mac viagens-ficha-panel--resumo"
            aria-label="Resumo da viagem"
        >
            <TripFichaPanelHeader icon="luggage" title="Resumo da viagem" tone="turquesa" meta={meta} />

            <TripFichaPanelBody className="viagens-ficha-panel__body--resumo">
                <section className="viagens-resumo__section viagens-resumo__section--stats" aria-label="Indicadores">
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
                </section>

                <section className="viagens-resumo__section viagens-resumo__section--route" aria-label="Rota e destinos">
                    {hasChosenScenario ? (
                        <TripResumoRotaSection draft={draft} destinations={destinations} />
                    ) : tags.length > 0 ? (
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
                </section>

                <section className="viagens-resumo__section viagens-resumo__section--orc" aria-label="Metas de valores">
                    <TripResumoOrcamentoViz snap={orcSnap} />
                </section>
            </TripFichaPanelBody>
        </TripFichaPanel>
    );
}
