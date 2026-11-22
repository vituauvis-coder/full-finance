import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { chosenScenarioFromPayload, chosenScenarioRota } from '../domain/chosenScenarioResumo';
import { effectiveTripPeriod } from '../domain/tripResumoStats';
import type { TripVacationPeriod } from '../domain/tripTimeScenario';
import type { TripDestination, TripPayload } from '../types';
import {
    SCENARIO_CALENDAR_LEGEND,
    scenarioCellBlendStyle,
    scenarioLayerSetsFromSnapshot,
    scenarioLayersForKey,
    scenarioLayerTokens,
    type ScenarioDayLayers,
    type ScenarioLegendKind
} from '../utils/tripScenarioCalendarLayers';
import { anchorMonth, monthTitlePt, shiftMonth, toDateKeyLocal, todayKey, WEEK_SHORT_PT } from '../utils/tripCalendar';
import { TripFichaPanel, TripFichaPanelBody, TripFichaPanelFooter, TripFichaPanelHeader } from './ficha/TripFichaPanel';
import '../styles/trip-calendar.css';

function inRange(key: string, start: string, end: string): boolean {
    if (!start) return false;
    if (!end) return key === start;
    return key >= start && key <= end;
}

function monthCells(year: number, monthIndex: number): (number | null)[] {
    const first = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cells: (number | null)[] = Array(first).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
}

function tripRangeBlend(inR: boolean): CSSProperties | undefined {
    if (!inR) return undefined;
    return {
        background: 'color-mix(in srgb, var(--v-oceano, var(--viagens-accent)) 28%, transparent)'
    };
}

function layerDataAttrs(layers: ScenarioDayLayers): Record<string, string | undefined> {
    return {
        'data-vacation': layers.vacation ? '1' : undefined,
        'data-tourism': layers.tourism ? '1' : undefined,
        'data-br-holiday': layers.brHoliday ? '1' : undefined,
        'data-remote': layers.remote ? '1' : undefined,
        'data-travel': layers.travel ? '1' : undefined
    };
}

type Props = {
    startsOn: string;
    endsOn: string;
    payload: TripPayload;
    destinations: TripDestination[];
    /** Dia ISO da próxima tarefa (chip «Próxima tarefa»). */
    nextTaskDayKey?: string | null;
    scenarioCount?: number;
    onOpenSimulador?: () => void;
};

export function TripCalendarCard({
    startsOn,
    endsOn,
    payload,
    destinations,
    nextTaskDayKey,
    scenarioCount = 0,
    onOpenSimulador
}: Props) {
    const { startsOn: periodStart, endsOn: periodEnd } = useMemo(
        () => effectiveTripPeriod(startsOn, endsOn, payload, destinations),
        [startsOn, endsOn, payload, destinations]
    );
    const start = periodStart;
    const end = periodEnd;
    const today = todayKey();

    const [view, setView] = useState(() => anchorMonth(start, end));
    const [legendHover, setLegendHover] = useState<ScenarioLegendKind | null>(null);

    useEffect(() => {
        if (!start && !end) return;
        const next = anchorMonth(start, end);
        setView((prev) => (prev.year === next.year && prev.month === next.month ? prev : next));
    }, [start, end]);

    const monthTitle = monthTitlePt(view.year, view.month);

    const chosenRota = useMemo(
        () => chosenScenarioRota(payload, destinations, start || end),
        [payload, destinations, start, end]
    );
    const chosenScenario = useMemo(() => chosenScenarioFromPayload(payload), [payload]);
    const vacations = useMemo(
        () => (chosenScenario?.vacations as TripVacationPeriod[] | undefined) ?? [],
        [chosenScenario]
    );
    const layerSets = useMemo(
        () => scenarioLayerSetsFromSnapshot(chosenRota?.snapshot, chosenRota?.hops ?? [], vacations),
        [chosenRota, vacations]
    );

    const grid = useMemo(() => monthCells(view.year, view.month), [view.year, view.month]);

    const goMonth = useCallback((delta: number) => {
        setView((v) => shiftMonth(v.year, v.month, delta));
    }, []);

    const focusMonthOf = useCallback((key: string | null | undefined) => {
        if (!key?.trim()) return;
        const d = new Date(`${key.trim().slice(0, 10)}T12:00:00`);
        if (Number.isNaN(d.getTime())) return;
        setView({ year: d.getFullYear(), month: d.getMonth() });
    }, []);

    const tripAnchor = start || end;
    const calMod = legendHover ? ` viagens-cal--legend-${legendHover}` : '';

    return (
        <TripFichaPanel
            className={`viagens-panel--cal viagens-cal--smart viagens-ficha-panel--cal${calMod}`}
            aria-label="Calendário da viagem"
        >
            <TripFichaPanelHeader
                icon="calendar_month"
                title="Calendário"
                tone="turquesa"
                actions={
                    <nav className="viagens-cal__head-nav" aria-label="Mudar mês">
                        <button
                            type="button"
                            className="viagens-ficha-panel__icon-btn"
                            aria-label="Mês anterior"
                            onClick={() => goMonth(-1)}
                        >
                            <MaterialIcon name="chevron_left" variant="app" opticalSize={18} />
                        </button>
                        <button
                            type="button"
                            className="viagens-ficha-panel__icon-btn"
                            aria-label="Próximo mês"
                            onClick={() => goMonth(1)}
                        >
                            <MaterialIcon name="chevron_right" variant="app" opticalSize={18} />
                        </button>
                    </nav>
                }
            />

            <TripFichaPanelBody className="viagens-ficha-panel__body--cal">
            <div className="viagens-cal__chips" role="toolbar" aria-label="Atalhos do calendário">
                <button type="button" className="viagens-cal__chip" onClick={() => focusMonthOf(tripAnchor)}>
                    <MaterialIcon name="flag" variant="app" opticalSize={14} />
                    Viagem
                </button>
                <button
                    type="button"
                    className="viagens-cal__chip"
                    onClick={() => focusMonthOf(nextTaskDayKey ?? tripAnchor ?? today)}
                >
                    <MaterialIcon name="task_alt" variant="app" opticalSize={14} />
                    Próxima tarefa
                </button>
                <button type="button" className="viagens-cal__chip" onClick={() => focusMonthOf(today)}>
                    <MaterialIcon name="today" variant="app" opticalSize={14} />
                    Hoje
                </button>
            </div>

            <h3 className="viagens-cal__month-title">{monthTitle}</h3>

            <div className="viagens-cal__week" aria-hidden="true">
                {WEEK_SHORT_PT.map((w) => (
                    <span key={w}>{w}</span>
                ))}
            </div>

            <div className="viagens-cal__grid" role="grid" aria-label={`Dias de ${monthTitle}`}>
                {grid.map((day, i) => {
                    if (day == null) {
                        return <span key={`pad-${i}`} className="viagens-cal__cell viagens-cal__cell--empty" role="presentation" />;
                    }
                    const key = toDateKeyLocal(view.year, view.month, day);
                    const layers = chosenRota
                        ? scenarioLayersForKey(
                              key,
                              layerSets.vacKeys,
                              layerSets.flKeys,
                              layerSets.remoteKeys,
                              layerSets.tourismKeys,
                              layerSets.brHolidayTourism
                          )
                        : null;
                    const tokens = layers ? scenarioLayerTokens(layers) : [];
                    const scenarioStyle = layers ? scenarioCellBlendStyle(layers) : undefined;
                    const inR = inRange(key, start, end);
                    const rangeStyle = !tokens.length && inR ? tripRangeBlend(true) : undefined;
                    const style: CSSProperties | undefined =
                        scenarioStyle && rangeStyle
                            ? {
                                  ...scenarioStyle,
                                  boxShadow: `${scenarioStyle.boxShadow ?? ''}, inset 0 0 0 1.5px color-mix(in srgb, var(--v-oceano) 35%, transparent)`.trim()
                              }
                            : scenarioStyle ?? rangeStyle;

                    const classes = ['viagens-cal__cell'];
                    if (tokens.length) classes.push('viagens-cal__cell--layers', 'viagens-cal__cell--hit');
                    if (inR) classes.push('viagens-cal__cell--in-range');
                    if (start && key === start) classes.push('viagens-cal__cell--start');
                    if (end && key === end) classes.push('viagens-cal__cell--end');
                    if (key === today) classes.push('viagens-cal__cell--today');
                    if (nextTaskDayKey && key === nextTaskDayKey) classes.push('viagens-cal__cell--next-task');

                    return (
                        <span
                            key={key}
                            role="gridcell"
                            className={classes.join(' ')}
                            style={style}
                            {...(layers ? layerDataAttrs(layers) : {})}
                            aria-label={`Dia ${day}`}
                        >
                            <span className="viagens-cal__cell-day">{day}</span>
                            {tokens.length && layers ? (
                                <>
                                    <span className="viagens-cal__cell-icons" aria-hidden>
                                        {layers.vacation ? (
                                            <MaterialIcon
                                                name="beach_access"
                                                variant="app"
                                                opticalSize={9}
                                                className="viagens-cal__ico viagens-cal__ico--coral"
                                            />
                                        ) : null}
                                        {layers.tourism ? (
                                            <MaterialIcon
                                                name="explore"
                                                variant="app"
                                                opticalSize={9}
                                                className="viagens-cal__ico viagens-cal__ico--turquesa"
                                            />
                                        ) : null}
                                        {layers.brHoliday ? (
                                            <MaterialIcon
                                                name="flag"
                                                variant="app"
                                                opticalSize={9}
                                                className="viagens-cal__ico viagens-cal__ico--turquesa"
                                            />
                                        ) : null}
                                        {layers.remote ? (
                                            <MaterialIcon
                                                name="laptop_mac"
                                                variant="app"
                                                opticalSize={9}
                                                className="viagens-cal__ico viagens-cal__ico--ouro"
                                            />
                                        ) : null}
                                        {layers.travel ? (
                                            <MaterialIcon
                                                name="flight_takeoff"
                                                variant="app"
                                                opticalSize={9}
                                                className="viagens-cal__ico viagens-cal__ico--oceano"
                                            />
                                        ) : null}
                                    </span>
                                    <span className="viagens-cal__cell-stack" aria-hidden>
                                        {tokens.map((t) => (
                                            <span key={t} className={`viagens-cal__cell-stack-seg viagens-cal__cell-stack-seg--${t}`} />
                                        ))}
                                    </span>
                                </>
                            ) : null}
                            {nextTaskDayKey && key === nextTaskDayKey && !layers?.travel ? (
                                <MaterialIcon
                                    name="task_alt"
                                    variant="app"
                                    opticalSize={8}
                                    className="viagens-cal__ico viagens-cal__ico--meta"
                                    aria-hidden
                                />
                            ) : null}
                        </span>
                    );
                })}
            </div>

            <footer className="viagens-cal__legend" aria-label="Legenda do calendário">
                {SCENARIO_CALENDAR_LEGEND.map((item) => {
                    const pillClass = `viagens-cal__legend-pill${legendHover === item.kind ? ' viagens-cal__legend-pill--focus' : ''}`;
                    const tone = `viagens-cal__ico--${item.token}`;
                    return (
                        <button
                            key={item.kind}
                            type="button"
                            className={pillClass}
                            data-kind={item.kind}
                            aria-label={item.label}
                            onMouseEnter={() => setLegendHover(item.kind)}
                            onMouseLeave={() => setLegendHover((k) => (k === item.kind ? null : k))}
                            onFocus={() => setLegendHover(item.kind)}
                            onBlur={() => setLegendHover((k) => (k === item.kind ? null : k))}
                        >
                            <MaterialIcon name={item.icon} variant="app" opticalSize={10} className={tone} />
                            <span className="viagens-cal__legend-label">{item.label}</span>
                        </button>
                    );
                })}
            </footer>
            </TripFichaPanelBody>

            {onOpenSimulador ? (
                <TripFichaPanelFooter>
                    <button type="button" className="viagens-ficha-panel__cta viagens-cal__sim" onClick={onOpenSimulador}>
                        <MaterialIcon name="query_stats" variant="app" opticalSize={18} />
                        Simulador
                        <span className="viagens-badge">{scenarioCount}</span>
                    </button>
                </TripFichaPanelFooter>
            ) : null}
        </TripFichaPanel>
    );
}