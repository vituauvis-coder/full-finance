import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isHomeDestination } from '@motor/viagens/trip-places.js';
import {
    convertLocalHmToZoneDetail,
    countryFlagEmoji,
    guessTimeZoneForCountry,
    TRIP_DIARY_HOME_LABEL,
    TRIP_DIARY_HOME_TZ
} from '@motor/viagens/trip-diary-feed.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type {
    TripDestination,
    TripGroundTransport,
    TripItineraryDay,
    TripItineraryItem,
    TripPayload,
    TripStay
} from '../../types';
import { GROUND_TRANSPORT_KINDS, groundTransportLabel } from '../../domain/ground-transport';
import {
    lodgeDateShort,
    stayCheckIn,
    stayCheckOut,
    stayDisplayCity,
    stayDisplayTitle,
    sortStaysChronologically
} from '../hospedagens/hospedagens-display';
import {
    dayKeyOf,
    dayPlaceFieldsFromStay,
    destinationCoords,
    destinationForDate,
    formatDayLabel,
    activityPlaceLabel,
    mapPlaceCardTitle,
    mapPlaceCityLabel,
    isCountryOnlyDestination,
    isCountryOnlyPlaceName,
    ITINERARY_CAT_ICONS,
    ITINERARY_CAT_LABELS,
    ITINERARY_TRAVEL_LABELS,
    itineraryCategoryLabel,
    itineraryDayHasPassed,
    filterPlannablePlacesByCountry,
    dayHolidayNotice,
    isHolidayLeaveItem,
    isRemoteItineraryItem,
    journalDayCityLabel,
    journalDayWhereLabel,
    normalizeItineraryItem,
    orderedStops,
    shouldShowDayStayBanner,
    sortedItineraryDays,
    stayDistanceToPoint,
    stayTravelTimeSuffix
} from './roteiros-display';
const CAT_KEYS = Object.keys(ITINERARY_CAT_LABELS).filter((k) => k !== 'remote');
const TRAVEL_KEYS = Object.keys(ITINERARY_TRAVEL_LABELS) as Array<keyof typeof ITINERARY_TRAVEL_LABELS>;

type Props = {
    destinations: TripDestination[];
    plannerStops?: TripDestination[];
    groundTransports?: TripGroundTransport[];
    plannablePlaces?: TripDestination[];
    tripPayload?: TripPayload | null;
    days: TripItineraryDay[];
    onChangeDays: (
        update: TripItineraryDay[] | ((prev: TripItineraryDay[]) => TripItineraryDay[])
    ) => void;
    onSelectActivityPlace?: (dayId: string, itemId: string, destinationId: string | null) => void;
};

export function RoteirosPlannerTimeline({
    destinations,
    plannerStops,
    groundTransports = [],
    plannablePlaces = [],
    tripPayload = null,
    days,
    onChangeDays,
    onSelectActivityPlace
}: Props) {
    const stops = plannerStops?.length ? plannerStops : orderedStops(destinations);
    const sorted = sortedItineraryDays(days);

    // Dia inteiro não trava mais a edição: se o dia estava "salvo", marca as atividades.
    const migratedDaySaved = useRef(false);
    useEffect(() => {
        if (migratedDaySaved.current || days.length === 0) return;
        migratedDaySaved.current = true;
        if (!days.some((d) => d.saved)) return;
        onChangeDays((prev) =>
            prev.map((d) => {
                if (!d.saved) return d;
                return {
                    ...d,
                    saved: false,
                    items: (d.items ?? []).map((it) =>
                        it.id.startsWith('rote-flight-') ? it : { ...it, saved: true }
                    )
                };
            })
        );
    }, [days, onChangeDays]);

    function patchItem(dayId: string, itemId: string, patch: Partial<TripItineraryItem>) {
        const onlySavedToggle = Object.keys(patch).length === 1 && 'saved' in patch;
        const lockedAuto =
            itemId.startsWith('rote-remote-') || itemId.startsWith('rote-holiday-');
        onChangeDays((prev) =>
            prev.map((d) => {
                if (d.id !== dayId) return d;
                const items = (d.items ?? []).map((it) => {
                    if (it.id !== itemId) return it;
                    const safePatch =
                        lockedAuto && 'category' in patch
                            ? (({ category: _c, ...rest }) => rest)(patch)
                            : patch;
                    const next = { ...it, ...safePatch };
                    if (lockedAuto) next.category = it.category ?? 'remote';
                    if (!onlySavedToggle) next.saved = false;
                    return next;
                });
                return { ...d, items };
            })
        );
    }

    function addItem(dayId: string) {
        onChangeDays((prev) =>
            prev.map((d) => {
                if (d.id !== dayId) return d;
                const next = normalizeItineraryItem({
                    destinationId: null,
                    placeName: null
                });
                return { ...d, items: [...(d.items ?? []), next] };
            })
        );
    }

    function removeItem(dayId: string, itemId: string) {
        if (itemId.startsWith('rote-flight-')) return;
        if (itemId.startsWith('rote-remote-') || itemId.startsWith('rote-holiday-')) return;
        onChangeDays((prev) =>
            prev.map((d) => {
                if (d.id !== dayId) return d;
                return { ...d, items: (d.items ?? []).filter((it) => it.id !== itemId) };
            })
        );
    }

    const stays = useMemo(
        () => sortStaysChronologically(tripPayload?.stays ?? []),
        [tripPayload?.stays]
    );

    function patchDayStay(dayId: string, stayId: string | null) {
        onChangeDays((prev) =>
            prev.map((d) => {
                if (d.id !== dayId) return d;
                if (!stayId) {
                    return { ...d, stayId: null, stayIdManual: true };
                }
                const stay = stays.find((s) => s.id === stayId) ?? null;
                const place = dayPlaceFieldsFromStay(stay, [
                    ...destinations,
                    ...stops,
                    ...plannablePlaces
                ]);
                return {
                    ...d,
                    stayId,
                    stayIdManual: true,
                    destinationId: place.destinationId ?? d.destinationId ?? null,
                    placeName: place.placeName ?? d.placeName ?? null
                };
            })
        );
    }

    if (sorted.length === 0) {
        return (
            <div className="rote-planner rote-planner--empty" aria-label="Planner do roteiro">
                <header className="rote-planner__tab">
                    <span className="rote-planner__tab-title">
                        <MaterialIcon name="edit_note" variant="app" opticalSize={18} />
                        Roteiro
                    </span>
                </header>
                <div className="rote-tl-empty">
                    <MaterialIcon name="event" variant="app" opticalSize={32} />
                    <p>Defina as datas da viagem no resumo para liberar os dias aqui.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="rote-planner" aria-label="Planner do roteiro">
            <header className="rote-planner__tab">
                <span className="rote-planner__tab-title">
                    <MaterialIcon name="calendar_month" variant="app" opticalSize={18} filled />
                    Roteiro
                </span>
                <span className="rote-planner__tab-pill">{sorted.length}d</span>
            </header>
            <div className="rote-planner__grid" aria-hidden />
            <div className="rote-planner__body">
                <div className="rote-journal">
                    {sorted.map((day) => (
                        <JournalDay
                            key={day.id}
                            day={day}
                            tripPayload={tripPayload}
                            stays={stays}
                            stops={stops}
                            cityOptions={destinations}
                            plannablePlaces={plannablePlaces}
                            onPatchItem={(itemId, patch) => patchItem(day.id, itemId, patch)}
                            onPatchDayStay={(stayId) => patchDayStay(day.id, stayId)}
                            onAddItem={() => addItem(day.id)}
                            onRemoveItem={(itemId) => removeItem(day.id, itemId)}
                            groundTransports={groundTransports}
                            onSelectActivityPlace={
                                onSelectActivityPlace
                                    ? (itemId, destId) => onSelectActivityPlace(day.id, itemId, destId)
                                    : undefined
                            }
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function groundTicketsForActivity(
    tickets: TripGroundTransport[],
    activityDestId: string | null | undefined,
    dayDestId: string | null | undefined
): TripGroundTransport[] {
    if (!tickets.length) return [];
    const anchor = activityDestId ?? dayDestId ?? null;
    if (!anchor) return tickets;
    const matched = tickets.filter((t) => (t.tripDestinationId ?? t.trip_destination_id ?? null) === anchor);
    return matched.length ? matched : tickets;
}

function autoGroundTicketId(
    tickets: TripGroundTransport[],
    activityDestId: string | null | undefined,
    dayDestId: string | null | undefined
): string | null {
    const pool = groundTicketsForActivity(tickets, activityDestId, dayDestId);
    return pool.length === 1 ? pool[0]!.id : null;
}

function groundKindIcon(kind: string | undefined): string {
    return GROUND_TRANSPORT_KINDS.find((k) => k.id === kind)?.icon ?? 'directions_transit';
}

type ActivityClockPeer = {
    label: string;
    country: string;
    tz: string;
    flag: string;
};

function shortClockLabel(raw: string): string {
    const s = String(raw ?? '')
        .trim()
        .split('/')[0]
        ?.trim();
    if (!s) return '';
    return s.length > 16 ? `${s.slice(0, 14)}…` : s;
}

function peerLabelForDestination(dest: TripDestination): string {
    const city = mapPlaceCityLabel(dest.city ?? dest.neighborhood, dest.country);
    if (city) return shortClockLabel(city);
    const name = String(dest.name ?? '')
        .split(/[,/·]/)[0]
        ?.trim();
    if (name && !isCountryOnlyPlaceName(name) && name.length > 3) return shortClockLabel(name);
    return shortClockLabel(String(dest.country ?? '').trim());
}

/** Cidades da viagem (fusos distintos) para tooltip de horário. */
function buildTripClockPeers(destinations: TripDestination[]): ActivityClockPeer[] {
    const out: ActivityClockPeer[] = [];
    const seenTz = new Set<string>();

    const push = (label: string, country: string, tz: string | null | undefined) => {
        const lab = shortClockLabel(label);
        const zone = String(tz ?? '').trim();
        if (!lab || !zone || seenTz.has(zone)) return;
        seenTz.add(zone);
        out.push({
            label: lab,
            country: country || lab,
            tz: zone,
            flag: countryFlagEmoji(country || lab) || '🌍'
        });
    };

    push(TRIP_DIARY_HOME_LABEL, 'Brasil', TRIP_DIARY_HOME_TZ);

    for (const d of destinations) {
        if (!d || isHomeDestination(d) || d.kind === 'continent') continue;
        if (isCountryOnlyDestination(d)) {
            push(String(d.country ?? d.name ?? ''), String(d.country ?? d.name ?? ''), guessTimeZoneForCountry(d.country ?? d.name));
            continue;
        }
        const label = peerLabelForDestination(d);
        const country = String(d.country ?? '').trim() || label;
        const tz = guessTimeZoneForCountry(label) || guessTimeZoneForCountry(country);
        push(label, country, tz);
    }

    return out;
}

function activityLocalClock(
    day: TripItineraryDay,
    stops: TripDestination[],
    destinations: TripDestination[]
): { label: string; country: string; tz: string; flag: string } {
    const city = journalDayCityLabel(day, stops, destinations);
    const country = journalDayWhereLabel(day, stops, destinations);
    const label = city || country || 'Local';
    const tz =
        guessTimeZoneForCountry(city) ||
        guessTimeZoneForCountry(country) ||
        TRIP_DIARY_HOME_TZ;
    const flag = countryFlagEmoji(country || city) || (tz === TRIP_DIARY_HOME_TZ ? '🇧🇷' : '🌍');
    return { label: shortClockLabel(label) || 'Local', country: country || label, tz, flag };
}

/** Relógio do evento: voo usa o lugar do item (origem na partida = Recife), não o fuso do dia. */
function activityEventClock(
    item: TripItineraryItem,
    dayClock: { label: string; country: string; tz: string; flag: string }
): { label: string; country: string; tz: string; flag: string } {
    const isFlight = String(item.id ?? '').startsWith('rote-flight-');
    if (!isFlight) return dayClock;
    const place = String(item.placeName ?? item.place_name ?? '').trim();
    if (!place) {
        // Partida sem placeName → casa (Recife).
        if (String(item.id).includes('-partida')) {
            return {
                label: TRIP_DIARY_HOME_LABEL,
                country: 'Brasil',
                tz: TRIP_DIARY_HOME_TZ,
                flag: '🇧🇷'
            };
        }
        return dayClock;
    }
    const tz = guessTimeZoneForCountry(place) || dayClock.tz;
    const flag =
        countryFlagEmoji(place) || (tz === TRIP_DIARY_HOME_TZ ? '🇧🇷' : dayClock.flag);
    return {
        label: shortClockLabel(place) || dayClock.label,
        country: place,
        tz,
        flag
    };
}

function activityTimeTipLines(
    hm: string | null | undefined,
    dayKey: string,
    local: { tz: string },
    peers: ActivityClockPeer[]
): string[] {
    const time = String(hm ?? '').trim();
    if (!time || !dayKey) return [];
    const lines: string[] = [];
    for (const peer of peers) {
        if (peer.tz === local.tz) continue;
        const detail = convertLocalHmToZoneDetail(time, local.tz, dayKey, peer.tz);
        if (!detail) continue;
        const dateBit = detail.dateLabel ? ` · ${detail.dateLabel}` : '';
        lines.push(`${peer.flag} ${peer.label}: ${detail.hm}${dateBit}`);
    }
    return lines;
}

function ActivityTimeField({
    time,
    readOnly,
    flag,
    tipLines,
    onChange
}: {
    time: string | null | undefined;
    readOnly: boolean;
    flag: string;
    tipLines: string[];
    onChange: (next: string | null) => void;
}) {
    const hasTip = tipLines.length > 0;
    return (
        <label
            className={['rote-plan__time', hasTip ? 'rote-plan__time--tip' : ''].filter(Boolean).join(' ')}
        >
            <span className="rote-plan__time-flag" aria-hidden>
                {flag}
            </span>
            {readOnly ? (
                <span
                    className={['rote-plan__time-val', time ? '' : 'is-empty'].filter(Boolean).join(' ')}
                >
                    {time || '--:--'}
                </span>
            ) : (
                <input type="time" value={time ?? ''} onChange={(e) => onChange(e.target.value || null)} />
            )}
            {hasTip ? (
                <span className="rote-plan__time-tip" role="tooltip">
                    {tipLines.map((line) => (
                        <span key={line} className="rote-plan__time-tip-line">
                            {line}
                        </span>
                    ))}
                </span>
            ) : null}
        </label>
    );
}

function JournalDay({
    day,
    tripPayload,
    stays,
    stops,
    cityOptions,
    groundTransports,
    onPatchItem,
    onPatchDayStay,
    onAddItem,
    onRemoveItem,
    plannablePlaces,
    onSelectActivityPlace
}: {
    day: TripItineraryDay;
    tripPayload?: TripPayload | null;
    stays: TripStay[];
    stops: TripDestination[];
    cityOptions: TripDestination[];
    plannablePlaces: TripDestination[];
    groundTransports: TripGroundTransport[];
    onPatchItem: (itemId: string, patch: Partial<TripItineraryItem>) => void;
    onPatchDayStay: (stayId: string | null) => void;
    onAddItem: () => void;
    onRemoveItem: (itemId: string) => void;
    onSelectActivityPlace?: (itemId: string, destinationId: string | null) => void;
}) {
    const key = dayKeyOf(day);
    const label = formatDayLabel(key);
    const dayNum = key ? Number(key.slice(8, 10)) : null;
    const where = journalDayWhereLabel(day, stops, cityOptions);
    // Todos os pins do mapa; país do dia só ordena (mesmo país primeiro).
    const placesForDay = useMemo(() => {
        if (!where) return plannablePlaces;
        const matched = filterPlannablePlacesByCountry(plannablePlaces, where);
        const ids = new Set(matched.map((d) => d.id));
        const rest = plannablePlaces.filter((d) => !ids.has(d.id));
        return matched.length ? [...matched, ...rest] : plannablePlaces;
    }, [plannablePlaces, where]);
    const items = day.items ?? [];
    const dayPassed = itineraryDayHasPassed(key);
    const holidayAviso = dayHolidayNotice(day);
    const dayStay = stays.find((s) => s.id === day.stayId) ?? null;
    const placeById = useMemo(() => {
        const map = new Map<string, TripDestination>();
        for (const d of [...plannablePlaces, ...cityOptions, ...stops]) map.set(d.id, d);
        return map;
    }, [plannablePlaces, cityOptions, stops]);
    const localClock = useMemo(
        () => activityLocalClock(day, stops, cityOptions),
        [day, stops, cityOptions]
    );
    const clockPeers = useMemo(() => {
        const catalog = [
            ...cityOptions,
            ...stops,
            ...plannablePlaces,
            ...((tripPayload?.destinations ?? []) as TripDestination[])
        ];
        return buildTripClockPeers(catalog);
    }, [cityOptions, stops, plannablePlaces, tripPayload]);

    return (
        <article
            className={['rote-journal__day', dayPassed ? 'rote-journal__day--passed' : '']
                .filter(Boolean)
                .join(' ')}
        >
            <header className="rote-journal__head">
                <div className="rote-day-cal" aria-label={label?.long}>
                    <span className="rote-day-cal__num">{dayNum ?? '·'}</span>
                    <span className="rote-day-cal__meta">
                        <em>{label?.week ?? '—'}</em>
                        <span>{label?.short ?? ''}</span>
                    </span>
                </div>
                <div className="rote-journal__head-end">
                    {where ? <span className="rote-journal__where">{where}</span> : null}
                </div>
            </header>

            {stays.length > 0 && shouldShowDayStayBanner(day, stays) ? (
                <DayStayBanner
                    stays={stays}
                    stayId={day.stayId ?? null}
                    stayIdManual={Boolean(day.stayIdManual)}
                    destinations={placeById}
                    onChange={onPatchDayStay}
                />
            ) : null}

            {holidayAviso ? (
                <div className="rote-journal__aviso" role="status">
                    <span className="rote-journal__aviso-icon" aria-hidden>
                        <MaterialIcon name="celebration" variant="app" opticalSize={14} />
                    </span>
                    <div className="rote-journal__aviso-copy">
                        <span className="rote-journal__aviso-tag">Feriado BR</span>
                        <span className="rote-journal__aviso-name">{holidayAviso.name}</span>
                        {holidayAviso.schedule ? (
                            <span className="rote-journal__aviso-schedule">{holidayAviso.schedule}</span>
                        ) : null}
                    </div>
                </div>
            ) : null}

            <div className="rote-journal__body">
                {items.length === 0 ? (
                    <button type="button" className="rote-journal__empty" onClick={onAddItem}>
                        <MaterialIcon name="add_circle" variant="app" opticalSize={18} />
                        Plano do dia
                    </button>
                ) : (
                    <ul className="rote-journal__plans">
                        {items.map((item) => {
                            const isFlight = item.id.startsWith('rote-flight-');
                            const isRemote = isRemoteItineraryItem(item);
                            const isHolidaySlot = isHolidayLeaveItem(item);
                            const lockedSlot = isRemote || isHolidaySlot;
                            const itemView = Boolean(item.saved);
                            const showForm = !isFlight && !itemView;
                            const eventClock = activityEventClock(item, localClock);
                            const activityDest = item.destinationId
                                ? placeById.get(item.destinationId) ?? null
                                : null;
                            const distHint =
                                !isFlight && !isRemote
                                    ? stayDistanceToPoint(dayStay, destinationCoords(activityDest))
                                    : null;
                            return (
                                <li
                                    key={item.id}
                                    className={[
                                        'rote-plan',
                                        isFlight ? 'rote-plan--flight' : '',
                                        isRemote ? 'rote-plan--remote' : '',
                                        itemView ? 'rote-plan--view' : '',
                                        itemView ? 'rote-plan--saved' : '',
                                        item.highlight ? 'is-star' : '',
                                        item.category === 'important' ? 'is-warn' : ''
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                >
                                    <div className="rote-plan__row">
                                        <ActivityTimeField
                                            time={item.time}
                                            readOnly={itemView || isFlight}
                                            flag={eventClock.flag}
                                            tipLines={activityTimeTipLines(
                                                item.time,
                                                key,
                                                eventClock,
                                                clockPeers
                                            )}
                                            onChange={(next) => onPatchItem(item.id, { time: next })}
                                        />
                                        <span className="rote-plan__title-arrow" aria-hidden>
                                            <MaterialIcon name="arrow_forward" variant="app" opticalSize={12} />
                                        </span>
                                        <input
                                            className="rote-plan__title viagens-field"
                                            value={item.title}
                                            placeholder="Atividade"
                                            readOnly={itemView}
                                            onChange={(e) => onPatchItem(item.id, { title: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            className={`rote-plan__star${item.highlight ? ' is-on' : ''}`}
                                            aria-pressed={Boolean(item.highlight)}
                                            disabled={itemView}
                                            onClick={() => onPatchItem(item.id, { highlight: !item.highlight })}
                                        >
                                            <MaterialIcon name="star" variant="app" opticalSize={16} filled={item.highlight} />
                                        </button>
                                        {!isFlight ? (
                                            <button
                                                type="button"
                                                className={[
                                                    'rote-plan__save',
                                                    itemView ? 'rote-plan__save--view' : 'rote-plan__save--edit',
                                                    itemView ? 'is-on' : ''
                                                ]
                                                    .filter(Boolean)
                                                    .join(' ')}
                                                aria-pressed={!itemView}
                                                aria-label={itemView ? 'Editar atividade' : 'Salvar atividade'}
                                                title={itemView ? 'Editar atividade' : 'Salvar atividade'}
                                                onClick={() =>
                                                    onPatchItem(item.id, { saved: !itemView })
                                                }
                                            >
                                                <MaterialIcon
                                                    name={itemView ? 'edit' : 'check'}
                                                    variant="app"
                                                    opticalSize={16}
                                                    filled={!itemView}
                                                />
                                            </button>
                                        ) : null}
                                        {isFlight || lockedSlot || itemView ? null : (
                                            <button
                                                type="button"
                                                className="rote-plan__del"
                                                onClick={() => onRemoveItem(item.id)}
                                                aria-label="Remover"
                                            >
                                                <MaterialIcon name="close" variant="app" opticalSize={16} />
                                            </button>
                                        )}
                                    </div>
                                    {itemView || isFlight || isRemote ? (
                                        <ActivityPlanSnapshot
                                            item={item}
                                            tripPayload={tripPayload}
                                            destinations={cityOptions}
                                            plannablePlaces={plannablePlaces}
                                            groundTransports={groundTransports}
                                            dayDestinationId={day.destinationId}
                                            stayDistance={distHint}
                                        />
                                    ) : null}
                                    {showForm && !lockedSlot && distHint ? (
                                        <p className="rote-plan__stay-dist">
                                            <MaterialIcon name="near_me" variant="app" opticalSize={13} />
                                            {distHint.label} da hospedagem
                                            {stayTravelTimeSuffix(distHint, item.travelMode)}
                                        </p>
                                    ) : null}
                                    {showForm && !lockedSlot ? (
                                        <div className="rote-plan__pairs">
                                            <div className="rote-plan__pair">
                                                {onSelectActivityPlace ? (
                                                    <ActivityPlaceField
                                                        destinationId={item.destinationId}
                                                        placeName={item.placeName ?? item.place_name}
                                                        destinations={cityOptions}
                                                        plannablePlaces={placesForDay}
                                                        dayCountry={where}
                                                        readOnly={false}
                                                        onSelect={(destId) => onSelectActivityPlace(item.id, destId)}
                                                    />
                                                ) : null}
                                                <ActivityTypeField
                                                    category={item.category}
                                                    tripPayload={tripPayload}
                                                    readOnly={false}
                                                    onSelect={(cat) => onPatchItem(item.id, { category: cat })}
                                                />
                                            </div>
                                            <div className="rote-plan__pair rote-plan__pair--travel">
                                                <TravelModeField
                                                    travelMode={item.travelMode}
                                                    readOnly={false}
                                                    onSelect={(mode) => {
                                                        if (item.travelMode === mode) {
                                                            onPatchItem(item.id, {
                                                                travelMode: null,
                                                                groundTransportId: null
                                                            });
                                                            return;
                                                        }
                                                        if (mode === 'ground') {
                                                            const auto = autoGroundTicketId(
                                                                groundTransports,
                                                                item.destinationId,
                                                                day.destinationId
                                                            );
                                                            onPatchItem(item.id, {
                                                                travelMode: 'ground',
                                                                groundTransportId:
                                                                    item.groundTransportId ?? auto ?? null
                                                            });
                                                            return;
                                                        }
                                                        onPatchItem(item.id, {
                                                            travelMode: mode,
                                                            groundTransportId: null
                                                        });
                                                    }}
                                                />
                                                {groundTransports.length > 0 ? (
                                                    <GroundTicketField
                                                        tickets={groundTicketsForActivity(
                                                            groundTransports,
                                                            item.destinationId,
                                                            day.destinationId
                                                        )}
                                                        selectedId={item.groundTransportId ?? null}
                                                        readOnly={item.travelMode !== 'ground'}
                                                        inactive={item.travelMode !== 'ground'}
                                                        onSelect={(ticketId) =>
                                                            onPatchItem(item.id, {
                                                                travelMode: 'ground',
                                                                groundTransportId: ticketId
                                                            })
                                                        }
                                                    />
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : null}
                                    {(itemView || isRemote) &&
                                    item.notes &&
                                    !(isFlight && /^voo confirmado$/i.test(item.notes.trim())) ? (
                                        <p className="rote-plan__notes-read">{item.notes}</p>
                                    ) : showForm && !isRemote ? (
                                        <details className="rote-plan__notes">
                                            <summary>Notas</summary>
                                            <textarea
                                                className="viagens-field rote-sketch-field"
                                                value={item.notes ?? ''}
                                                rows={2}
                                                placeholder="Reserva, endereço…"
                                                onChange={(e) =>
                                                    onPatchItem(item.id, { notes: e.target.value || null })
                                                }
                                            />
                                        </details>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                )}
                {items.length > 0 ? (
                    <button type="button" className="rote-journal__add" onClick={onAddItem}>
                        <MaterialIcon name="add" variant="app" opticalSize={16} />
                        Mais uma
                    </button>
                ) : null}
            </div>
        </article>
    );
}

const TRAVEL_ICONS: Record<keyof typeof ITINERARY_TRAVEL_LABELS, string> = {
    flight: 'flight',
    ground: 'directions_car',
    walk: 'directions_walk'
};

function flightPlaceLabelFromTitle(item: TripItineraryItem): string | null {
    const title = String(item.title ?? '').trim();
    if (!title) return null;
    const chegada = title.match(/^chegada\s*·\s*(.+)$/i);
    if (chegada) return chegada[1].trim();
    const routeBody = title.replace(/^voo(?:\s+volta)?\s*·\s*/i, '').trim();
    const legs = routeBody.split(/\s*→\s*/).map((s) => s.trim()).filter(Boolean);
    if (!legs.length) return null;
    const id = item.id;
    if (id.includes('-partida')) return legs[0] ?? null;
    if (id.includes('-chegada')) return legs[legs.length - 1] ?? null;
    return legs[0] ?? null;
}

const STAY_DECLINE_OPTION_ID = '';
const STAY_PENDING_ACTIVE_ID = '__pending__';

function stayPickerOptions(stays: TripStay[]) {
    return [
        { id: STAY_DECLINE_OPTION_ID, label: 'Sem hospedagem', icon: 'block' },
        ...stays.map((s) => ({
            id: s.id,
            label: stayDisplayTitle(s) || 'Hospedagem',
            icon: 'hotel'
        }))
    ];
}

function useStayMenuOpen() {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        function onDoc(e: MouseEvent) {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false);
        }
        document.addEventListener('click', onDoc, true);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('click', onDoc, true);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return { open, setOpen, rootRef };
}

function DayStayBanner({
    stays,
    stayId,
    stayIdManual,
    destinations,
    onChange
}: {
    stays: TripStay[];
    stayId: string | null;
    stayIdManual: boolean;
    destinations: Map<string, TripDestination>;
    onChange: (stayId: string | null) => void;
}) {
    const { open, setOpen, rootRef } = useStayMenuOpen();
    const active = stays.find((s) => s.id === stayId) ?? null;
    const declined = Boolean(stayIdManual) && !stayId && !active;
    const pending = !active && !declined;
    const title = active
        ? stayDisplayTitle(active) || 'Hospedagem'
        : declined
          ? 'Sem hospedagem'
          : '—';
    const city = active ? stayDisplayCity(active, destinations) : '';
    const ci = active ? lodgeDateShort(stayCheckIn(active)) : '';
    const co = active ? lodgeDateShort(stayCheckOut(active)) : '';
    const schedule = active
        ? [city, ci && co && ci !== '—' && co !== '—' ? `${ci} → ${co}` : '']
              .filter(Boolean)
              .join(' · ')
        : declined
          ? 'Não terá base neste dia · toque para alterar'
          : 'Ainda não definida · toque para escolher';

    const options = stayPickerOptions(stays);
    const activeOptionId = active
        ? active.id
        : declined
          ? STAY_DECLINE_OPTION_ID
          : STAY_PENDING_ACTIVE_ID;

    return (
        <div
            ref={rootRef}
            className={`rote-journal__stay-banner${active ? '' : ' is-empty'}${declined ? ' is-declined' : ''}${open ? ' is-open' : ''}`}
        >
            <button
                type="button"
                className="rote-journal__stay-banner-btn"
                aria-expanded={open}
                aria-haspopup="listbox"
                onClick={() => setOpen((v) => !v)}
            >
                <span className="rote-journal__aviso-icon" aria-hidden>
                    <MaterialIcon name="hotel" variant="app" opticalSize={14} />
                </span>
                <span className="rote-journal__aviso-copy">
                    <span className="rote-journal__aviso-tag">Hospedagem</span>
                    <span className="rote-journal__aviso-name">{title}</span>
                    <span className="rote-journal__aviso-schedule">{schedule}</span>
                </span>
                <MaterialIcon
                    name={open ? 'expand_less' : 'expand_more'}
                    variant="app"
                    opticalSize={16}
                    className="rote-journal__stay-banner-chevron"
                />
            </button>
            {open ? (
                <div
                    className="rote-plan__fld-menu rote-journal__stay-banner-menu"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <RotePlanOptionList
                        activeId={activeOptionId}
                        options={options}
                        onPick={(id) => {
                            onChange(id || null);
                            setOpen(false);
                        }}
                    />
                </div>
            ) : null}
        </div>
    );
}

function ActivityPlanSnapshot({
    item,
    tripPayload,
    destinations,
    plannablePlaces,
    groundTransports,
    dayDestinationId,
    stayDistance
}: {
    item: TripItineraryItem;
    tripPayload?: TripPayload | null;
    destinations: TripDestination[];
    plannablePlaces: TripDestination[];
    groundTransports: TripGroundTransport[];
    dayDestinationId?: string | null;
    stayDistance?: ReturnType<typeof stayDistanceToPoint>;
}) {
    const isFlight = item.id.startsWith('rote-flight-');
    const catalog = useMemo(() => {
        const map = new Map<string, TripDestination>();
        for (const d of [...plannablePlaces, ...destinations]) map.set(d.id, d);
        return map;
    }, [plannablePlaces, destinations]);

    const destId = item.destinationId ?? null;
    const linked = destId ? (catalog.get(destId) ?? null) : null;
    let placeLabel = linked
        ? mapPlaceCardTitle(linked)
        : String(item.placeName ?? item.place_name ?? '').trim() || null;
    if (!placeLabel && isFlight) placeLabel = flightPlaceLabelFromTitle(item);

    const catKey = String(item.category ?? 'sight');
    const typeLabel = itineraryCategoryLabel(catKey, tripPayload);
    const typeIcon = ITINERARY_CAT_ICONS[catKey] ?? 'label';

    const mode = item.travelMode ?? (isFlight ? 'flight' : null);
    const travelLabel = mode ? ITINERARY_TRAVEL_LABELS[mode] : null;
    const travelIcon = mode ? TRAVEL_ICONS[mode as keyof typeof TRAVEL_ICONS] : 'route';

    const ticketId = item.groundTransportId ?? null;
    const tickets = groundTicketsForActivity(groundTransports, destId, dayDestinationId);
    const ticket = ticketId ? tickets.find((t) => t.id === ticketId) : null;
    const ticketLabel = ticket ? groundTransportLabel(ticket) : null;

    return (
        <div className="rote-plan__snapshot" aria-label="Resumo da atividade">
            {placeLabel ? (
                <span className="rote-plan__chip rote-plan__chip--place">
                    <MaterialIcon name="location_on" variant="app" opticalSize={13} filled />
                    {placeLabel}
                </span>
            ) : null}
            <span className="rote-plan__chip rote-plan__chip--type">
                <MaterialIcon name={typeIcon} variant="app" opticalSize={13} />
                {typeLabel}
            </span>
            {travelLabel ? (
                <span className="rote-plan__chip rote-plan__chip--travel">
                    <MaterialIcon name={travelIcon} variant="app" opticalSize={13} />
                    {travelLabel}
                </span>
            ) : null}
            {ticketLabel ? (
                <span className="rote-plan__chip rote-plan__chip--ticket">
                    <MaterialIcon name={groundKindIcon(ticket?.kind)} variant="app" opticalSize={13} />
                    {ticketLabel}
                </span>
            ) : null}
            {stayDistance ? (
                <span className="rote-plan__chip rote-plan__chip--stay-dist" title="Distância até a hospedagem do dia">
                    <MaterialIcon name="near_me" variant="app" opticalSize={13} />
                    {stayDistance.label}
                    {stayTravelTimeSuffix(stayDistance, item.travelMode)}
                </span>
            ) : null}
        </div>
    );
}

function RotePlanMenuField({
    label,
    valueLabel,
    placeholder = 'Escolher…',
    leadingIcon,
    open,
    onOpenChange,
    children,
    className = '',
    readOnly = false
}: {
    label: string;
    valueLabel: string;
    placeholder?: string;
    leadingIcon: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
    className?: string;
    readOnly?: boolean;
}) {
    const rootRef = useRef<HTMLDivElement>(null);
    const muted = !valueLabel.trim();

    useEffect(() => {
        if (!open) return;
        function onDoc(e: MouseEvent) {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) onOpenChange(false);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onOpenChange(false);
        }
        document.addEventListener('click', onDoc, true);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('click', onDoc, true);
            document.removeEventListener('keydown', onKey);
        };
    }, [onOpenChange, open]);

    return (
        <div
            ref={rootRef}
            className={[
                'rote-plan__fld',
                open ? 'rote-plan__fld--open' : '',
                readOnly ? 'rote-plan__fld--readonly' : '',
                className
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <span className="rote-plan__fld-kicker">{label}</span>
            {readOnly ? (
                <div className="rote-plan__fld-trigger rote-plan__fld-trigger--readonly" aria-label={label}>
                    <span className="rote-plan__fld-trigger-main">
                        <MaterialIcon name={leadingIcon} variant="app" opticalSize={18} />
                        <span className={`rote-plan__fld-value${muted ? ' is-placeholder' : ''}`}>
                            {muted ? placeholder || '—' : valueLabel}
                        </span>
                    </span>
                </div>
            ) : (
                <button
                    type="button"
                    className="rote-plan__fld-trigger"
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    onClick={() => onOpenChange(!open)}
                >
                    <span className="rote-plan__fld-trigger-main">
                        <MaterialIcon name={leadingIcon} variant="app" opticalSize={18} />
                        <span className={`rote-plan__fld-value${muted ? ' is-placeholder' : ''}`}>
                            {muted ? placeholder : valueLabel}
                        </span>
                    </span>
                    <MaterialIcon
                        name={open ? 'expand_less' : 'expand_more'}
                        variant="app"
                        opticalSize={18}
                        className="rote-plan__fld-chevron"
                    />
                </button>
            )}
            {!readOnly && open ? (
                <div className="rote-plan__fld-menu" onMouseDown={(e) => e.stopPropagation()}>
                    {children}
                </div>
            ) : null}
        </div>
    );
}

function RotePlanOptionList({
    options,
    activeId,
    onPick
}: {
    options: { id: string; label: string; icon: string }[];
    activeId: string | null;
    onPick: (id: string) => void;
}) {
    return (
        <ul className="rote-plan__fld-options" role="listbox">
            {options.map((opt) => {
                const on = activeId === opt.id;
                return (
                    <li key={opt.id} role="presentation">
                        <button
                            type="button"
                            role="option"
                            aria-selected={on}
                            className={['rote-plan__fld-opt', on ? 'rote-plan__fld-opt--on' : ''].join(' ')}
                            onClick={() => onPick(opt.id)}
                        >
                            <span className="rote-plan__fld-opt-main">
                                <MaterialIcon name={opt.icon} variant="app" opticalSize={17} filled={on} />
                                <span className="rote-plan__fld-opt-label">{opt.label}</span>
                            </span>
                            {on ? (
                                <MaterialIcon name="check" variant="app" opticalSize={16} className="rote-plan__fld-opt-check" />
                            ) : null}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

function TravelModeField({
    travelMode,
    onSelect,
    readOnly = false
}: {
    travelMode: TripItineraryItem['travelMode'];
    onSelect: (mode: keyof typeof ITINERARY_TRAVEL_LABELS) => void;
    readOnly?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const label = travelMode ? ITINERARY_TRAVEL_LABELS[travelMode] : '';
    const icon = travelMode ? TRAVEL_ICONS[travelMode] : 'route';
    const options = TRAVEL_KEYS.map((mode) => ({
        id: mode,
        label: ITINERARY_TRAVEL_LABELS[mode],
        icon: TRAVEL_ICONS[mode]
    }));

    return (
        <RotePlanMenuField
            label="Deslocamento"
            valueLabel={label}
            placeholder="Nenhum"
            leadingIcon={icon}
            open={open}
            readOnly={readOnly}
            onOpenChange={setOpen}
        >
            <RotePlanOptionList
                activeId={travelMode ?? null}
                options={options}
                onPick={(id) => {
                    onSelect(id as keyof typeof ITINERARY_TRAVEL_LABELS);
                    setOpen(false);
                }}
            />
        </RotePlanMenuField>
    );
}

function ActivityTypeField({
    category,
    tripPayload,
    onSelect,
    readOnly = false
}: {
    category: string | null | undefined;
    tripPayload?: TripPayload | null;
    onSelect: (cat: string) => void;
    readOnly?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const catKey = String(category ?? 'sight').trim() || 'sight';
    const label = itineraryCategoryLabel(catKey, tripPayload);
    const icon = ITINERARY_CAT_ICONS[catKey] ?? 'label';
    const options = CAT_KEYS.map((cat) => ({
        id: cat,
        label: itineraryCategoryLabel(cat, tripPayload),
        icon: ITINERARY_CAT_ICONS[cat] ?? 'label'
    }));

    return (
        <RotePlanMenuField
            label="Tipo"
            valueLabel={label}
            placeholder="Passeio"
            leadingIcon={icon}
            open={open}
            readOnly={readOnly}
            onOpenChange={setOpen}
        >
            <RotePlanOptionList
                activeId={catKey}
                options={options}
                onPick={(id) => {
                    onSelect(id);
                    setOpen(false);
                }}
            />
        </RotePlanMenuField>
    );
}

function GroundTicketField({
    tickets,
    selectedId,
    onSelect,
    readOnly = false,
    inactive = false
}: {
    tickets: TripGroundTransport[];
    selectedId: string | null;
    onSelect: (ticketId: string | null) => void;
    readOnly?: boolean;
    inactive?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const active = tickets.find((t) => t.id === selectedId) ?? null;
    const label = active ? groundTransportLabel(active) : '';
    const icon = active ? groundKindIcon(active.kind) : 'confirmation_number';

    return (
        <RotePlanMenuField
            className={['rote-plan__fld--transport', inactive ? 'rote-plan__fld--inactive' : '']
                .filter(Boolean)
                .join(' ')}
            label="Transporte"
            valueLabel={label}
            placeholder={inactive ? 'Terrestre' : 'Escolher…'}
            leadingIcon={icon}
            open={open}
            readOnly={readOnly}
            onOpenChange={setOpen}
        >
            <RotePlanOptionList
                activeId={selectedId}
                options={tickets.map((t) => ({
                    id: t.id,
                    label: groundTransportLabel(t),
                    icon: groundKindIcon(t.kind)
                }))}
                onPick={(id) => {
                    onSelect(selectedId === id ? null : id);
                    setOpen(false);
                }}
            />
        </RotePlanMenuField>
    );
}

function ActivityPlaceField({
    destinationId,
    placeName,
    destinations,
    plannablePlaces,
    dayCountry = '',
    onSelect,
    readOnly = false
}: {
    destinationId?: string | null;
    placeName?: string | null;
    destinations: TripDestination[];
    plannablePlaces: TripDestination[];
    dayCountry?: string;
    onSelect: (destinationId: string | null) => void;
    readOnly?: boolean;
}) {
    const catalog = useMemo(() => {
        const map = new Map<string, TripDestination>();
        for (const d of [...plannablePlaces, ...destinations]) map.set(d.id, d);
        return map;
    }, [plannablePlaces, destinations]);

    const selected = useMemo(() => {
        if (!destinationId) return null;
        const d = catalog.get(destinationId) ?? null;
        if (!d || isCountryOnlyDestination(d)) return null;
        return d;
    }, [catalog, destinationId]);

    const savedLabel = (placeName ?? '').trim();
    const displayLabel = selected
        ? mapPlaceCardTitle(selected)
        : savedLabel && !isCountryOnlyPlaceName(savedLabel)
          ? savedLabel
          : '';

    const options = useMemo(
        () =>
            plannablePlaces.map((d) => ({
                id: d.id,
                label: mapPlaceCardTitle(d),
                icon: 'location_on'
            })),
        [plannablePlaces]
    );

    const empty = options.length === 0;
    const [open, setOpen] = useState(false);
    const emptyHint = 'Adicione locais no mapa (busca acima)';

    return (
        <RotePlanMenuField
            className="rote-plan__fld--place"
            label="Local"
            valueLabel={displayLabel}
            placeholder={empty ? emptyHint : 'Escolher local…'}
            leadingIcon="location_on"
            open={open}
            readOnly={readOnly}
            onOpenChange={setOpen}
        >
            {empty ? (
                <p className="rote-plan__fld-empty">
                    Busque na barra do mapa ou marque um pin. Todos os locais do mapa aparecem aqui.
                </p>
            ) : (
                <RotePlanOptionList
                    activeId={destinationId ?? null}
                    options={options}
                    onPick={(id) => {
                        onSelect(destinationId === id ? null : id);
                        setOpen(false);
                    }}
                />
            )}
            {destinationId && !readOnly ? (
                <button
                    type="button"
                    className="rote-plan__fld-clear"
                    onClick={() => {
                        onSelect(null);
                        setOpen(false);
                    }}
                >
                    Remover local da atividade
                </button>
            ) : null}
        </RotePlanMenuField>
    );
}