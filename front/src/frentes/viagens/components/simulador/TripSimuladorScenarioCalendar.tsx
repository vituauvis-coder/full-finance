import { useMemo, useState } from 'react';
import { dayKey, parseDayKey } from '@motor/viagens/calendar-format.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { hopDayKey, vacationEndsOn, type TripTimeHop, type TripVacationPeriod } from '../../domain/tripTimeScenario';
import type { ScenarioSnapshot } from '../../domain/tripScenarioCriteria';
import { formatTripDayShort, monthTitlePt, WEEK_SHORT_PT } from '../../utils/tripCalendar';
import {
    SCENARIO_CALENDAR_LEGEND,
    scenarioCellBlendStyle,
    scenarioLayerKindOn,
    scenarioLayerSetsFromSnapshot,
    scenarioLayersForKey,
    scenarioLayerTokens,
    type ScenarioDayLayers,
    type ScenarioLegendKind,
    type ScenarioPaletteToken
} from '../../utils/tripScenarioCalendarLayers';

type DayLayers = ScenarioDayLayers;
type PaletteToken = ScenarioPaletteToken;
type LegendKind = ScenarioLegendKind;

function monthCells(year: number, monthIndex: number): (number | null)[] {
    const first = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cells: (number | null)[] = Array(first).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
}

function cellAriaLabel(
    key: string,
    layers: DayLayers,
    holidayLocal?: { localKey: string; country?: string }
): string {
    const bits: string[] = [formatTripDayShort(key)];
    for (const item of SCENARIO_CALENDAR_LEGEND) {
        if (scenarioLayerKindOn(layers, item.kind)) bits.push(item.label);
    }
    if (holidayLocal?.localKey) {
        const local = formatTripDayShort(holidayLocal.localKey);
        const where = holidayLocal.country?.trim();
        bits.push(where ? `Feriado no destino: ${local} (${where})` : `Feriado no destino: ${local}`);
    }
    return bits.join(' · ');
}

function vacationButtonLabel(periods: TripVacationPeriod[]): string {
    const primary = periods[0];
    if (!primary) return 'Definir férias';
    const days = Math.max(1, primary.days ?? 18);
    const start = (primary.starts_on ?? primary.startsOn ?? '').trim().slice(0, 10);
    if (!start) return `${days} dias · marcar início`;
    const end = vacationEndsOn(primary);
    if (end) return `${days} d · ${formatTripDayShort(start)} → ${formatTripDayShort(end)}`;
    return `${days} d · desde ${formatTripDayShort(start)}`;
}

type Props = {
    snapshot: ScenarioSnapshot;
    vacations: TripVacationPeriod[];
    hops: TripTimeHop[];
    onOpenVacations: () => void;
};

export function TripSimuladorScenarioCalendar({ snapshot, vacations, hops, onOpenVacations }: Props) {
    const tripStart =
        snapshot.tripStart instanceof Date
            ? dayKey(snapshot.tripStart)
            : snapshot.tripStart
              ? String(snapshot.tripStart).slice(0, 10)
              : null;
    const tripEnd =
        snapshot.tripEnd instanceof Date
            ? dayKey(snapshot.tripEnd)
            : snapshot.tripEnd
              ? String(snapshot.tripEnd).slice(0, 10)
              : null;

    const { vacKeys, flKeys, remoteKeys, tourismKeys, brHolidayTourism } = useMemo(
        () => scenarioLayerSetsFromSnapshot(snapshot, hops, vacations),
        [snapshot, hops, vacations]
    );

    const holidayLocalByKey = useMemo(() => {
        const raw = (snapshot.tourism as { holidayLocalByKey?: Record<string, { localKey: string; country?: string }> })
            ?.holidayLocalByKey;
        return raw ?? {};
    }, [snapshot.tourism]);

    const anchorStart = useMemo(() => {
        if (tripStart) return tripStart;
        const vac = vacations[0];
        const vStart = (vac?.starts_on ?? vac?.startsOn ?? '').trim().slice(0, 10);
        if (vStart) return vStart;
        for (const hop of hops) {
            const k = hopDayKey(hop.departsAt ?? hop.departs_at) ?? hopDayKey(hop.arrivesAt ?? hop.arrives_at);
            if (k) return k;
        }
        return null;
    }, [tripStart, vacations, hops]);

    const anchorEnd = tripEnd ?? anchorStart;

    const months = useMemo(() => {
        const start = anchorStart ? parseDayKey(anchorStart) : null;
        const end = anchorEnd ? parseDayKey(anchorEnd) : start;
        if (!start) return [] as { year: number; month: number }[];
        const endDate = end ?? start;
        const list: { year: number; month: number }[] = [];
        let y = start.getUTCFullYear();
        let m = start.getUTCMonth();
        const endY = endDate.getUTCFullYear();
        const endM = endDate.getUTCMonth();
        for (let guard = 0; guard < 24; guard++) {
            list.push({ year: y, month: m });
            if (y === endY && m === endM) break;
            m += 1;
            if (m > 11) {
                m = 0;
                y += 1;
            }
        }
        return list;
    }, [anchorStart, anchorEnd]);

    const rangeLabel =
        tripStart && tripEnd
            ? `${tripStart.slice(8, 10)} ${monthTitlePt(Number(tripStart.slice(0, 4)), Number(tripStart.slice(5, 7)) - 1).split(' ')[0]} → ${tripEnd.slice(8, 10)} ${monthTitlePt(Number(tripEnd.slice(0, 4)), Number(tripEnd.slice(5, 7)) - 1).split(' ')[0]}`
            : null;

    const feriasLabel = vacationButtonLabel(vacations);

    const [hoveredKey, setHoveredKey] = useState<string | null>(null);
    const [legendHover, setLegendHover] = useState<LegendKind | null>(null);

    const calMod =
        (legendHover ? ` viagens-sim-cal--legend-${legendHover}` : '') +
        (hoveredKey ? ' viagens-sim-cal--day-hover' : '');

    const renderCell = (year: number, month: number, day: number, emptyKey: string) => {
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const layers = scenarioLayersForKey(key, vacKeys, flKeys, remoteKeys, tourismKeys, brHolidayTourism);
        const tokens = scenarioLayerTokens(layers);
        const active = tokens.length > 0;
        const blend = scenarioCellBlendStyle(layers);
        const isHovered = hoveredKey === key;
        const cellClass =
            `viagens-sim-cal__cell${active ? ' viagens-sim-cal__cell--layers viagens-sim-cal__cell--hit' : ''}` +
            (isHovered ? ' viagens-sim-cal__cell--hovered' : '');
        const dataLayer: Record<string, string | undefined> = {
            'data-day-key': key,
            'data-vacation': layers.vacation ? '1' : undefined,
            'data-tourism': layers.tourism ? '1' : undefined,
            'data-br-holiday': layers.brHoliday ? '1' : undefined,
            'data-remote': layers.remote ? '1' : undefined,
            'data-travel': layers.travel ? '1' : undefined
        };
        const inner = (
            <>
                <span className="viagens-sim-cal__cell-day">{day}</span>
                {active ? (
                    <>
                        <span className="viagens-sim-cal__cell-icons" aria-hidden>
                            {layers.vacation ? (
                                <MaterialIcon
                                    name="beach_access"
                                    variant="app"
                                    opticalSize={9}
                                    className="viagens-sim-cal__ico viagens-sim-cal__ico--coral"
                                />
                            ) : null}
                            {layers.tourism ? (
                                <MaterialIcon
                                    name="explore"
                                    variant="app"
                                    opticalSize={9}
                                    className="viagens-sim-cal__ico viagens-sim-cal__ico--turquesa"
                                />
                            ) : null}
                            {layers.brHoliday ? (
                                <MaterialIcon
                                    name="flag"
                                    variant="app"
                                    opticalSize={9}
                                    className="viagens-sim-cal__ico viagens-sim-cal__ico--turquesa"
                                />
                            ) : null}
                            {layers.remote ? (
                                <MaterialIcon
                                    name="laptop_mac"
                                    variant="app"
                                    opticalSize={9}
                                    className="viagens-sim-cal__ico viagens-sim-cal__ico--ouro"
                                />
                            ) : null}
                            {layers.travel ? (
                                <MaterialIcon
                                    name="flight_takeoff"
                                    variant="app"
                                    opticalSize={9}
                                    className="viagens-sim-cal__ico viagens-sim-cal__ico--oceano"
                                />
                            ) : null}
                        </span>
                        <span className="viagens-sim-cal__cell-stack" aria-hidden>
                            {tokens.map((t) => (
                                <span key={t} className={`viagens-sim-cal__cell-stack-seg viagens-sim-cal__cell-stack-seg--${t}`} />
                            ))}
                        </span>
                    </>
                ) : null}
            </>
        );
        if (!active) {
            return (
                <span key={emptyKey} className="viagens-sim-cal__cell">
                    <span className="viagens-sim-cal__cell-day">{day}</span>
                </span>
            );
        }
        return (
            <button
                type="button"
                key={key}
                className={cellClass}
                style={blend}
                {...dataLayer}
                onMouseEnter={() => setHoveredKey(key)}
                aria-label={cellAriaLabel(key, layers, holidayLocalByKey[key])}
                onMouseLeave={() => setHoveredKey((k) => (k === key ? null : k))}
                onFocus={() => setHoveredKey(key)}
                onBlur={() => setHoveredKey((k) => (k === key ? null : k))}
            >
                {inner}
            </button>
        );
    };

    return (
        <section className={`viagens-sim-cal${calMod}`}>
            <header className="viagens-sim-cal__head">
                <MaterialIcon name="calendar_month" variant="app" opticalSize={16} />
                <span>Calendário</span>
                {rangeLabel ? <span className="viagens-sim-cal__range">{rangeLabel}</span> : null}
            </header>
            <button type="button" className="viagens-sim-cal__ferias-btn" onClick={onOpenVacations}>
                <MaterialIcon name="beach_access" variant="app" opticalSize={16} />
                <span className="viagens-sim-cal__ferias-text">{feriasLabel}</span>
                <MaterialIcon name="chevron_right" variant="app" opticalSize={18} />
            </button>
            {!months.length ? (
                <p className="viagens-muted viagens-sim-cal__empty">
                    Defina férias ou cadastre trechos para ver o calendário do cenário.
                </p>
            ) : (
                <div className="viagens-sim-cal__months">
                    {months.map(({ year, month }) => (
                        <div key={`${year}-${month}`} className="viagens-sim-cal__month">
                            <p className="viagens-sim-cal__month-title">{monthTitlePt(year, month)}</p>
                            <div className="viagens-sim-cal__week" aria-hidden>
                                {WEEK_SHORT_PT.map((w) => (
                                    <span key={w}>{w}</span>
                                ))}
                            </div>
                            <div className="viagens-sim-cal__grid">
                                {monthCells(year, month).map((day, i) => {
                                    if (day == null)
                                        return (
                                            <span key={`e-${i}`} className="viagens-sim-cal__cell viagens-sim-cal__cell--empty" />
                                        );
                                    return renderCell(year, month, day, `d-${year}-${month}-${day}`);
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <footer className="viagens-sim-cal__legend" aria-label="Legenda do calendário">
                {SCENARIO_CALENDAR_LEGEND.map((item) => {
                    const onLegend = legendHover === item.kind;
                    const pillClass = `viagens-sim-cal__legend-pill${onLegend ? ' viagens-sim-cal__legend-pill--focus' : ''}`;
                    const tone = `viagens-sim-cal__ico--${item.token}`;
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
                            <span className="viagens-sim-cal__legend-label">{item.label}</span>
                        </button>
                    );
                })}
            </footer>
        </section>
    );
}