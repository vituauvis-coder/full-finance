import {
    countryFlagEmoji,
    guessTimeZoneForCountry,
    tripDiaryDailyBudget,
    tripDiaryDayKeys,
    tripFeedClockZones,
    tripFeedCountdown,
    convertLocalHmToZoneDetail,
    TRIP_DIARY_HOME_TZ,
    TRIP_DIARY_HOME_LABEL
} from '@motor/viagens/trip-diary-feed.js';
import { countryTravelBrief } from '@motor/viagens/trip-country-travel.js';
import { routeStops } from '@motor/viagens/trip-places.js';
import type { Trip, TripCheckItem, TripDestination, TripItineraryDay } from '../types';
import type { TripDraft } from '../components/ViagemFicha';
import {
    dayKeyOf,
    destinationForDate,
    formatDayLabel,
    isCountryOnlyDestination,
    countryRepresentativeCity,
    holidayLeaveByDayFromPayload,
    isHolidayLeaveItem,
    isRemoteItineraryItem,
    isCountryOnlyPlaceName,
    mapPlaceCardTitle,
    mapPlaceCityLabel,
    stripAirportCodeLabel,
    mergeChosenFlightsIntoItinerary,
    mergeHolidayLeaveIntoItinerary,
    mergeRemoteWorkIntoItinerary,
    remoteDayKeysFromPayload,
    resolveDayLocationForResumo,
    resolveUserDayPlace,
    resumoStopsForTrip,
    sortedItineraryDays
} from '../components/roteiros/roteiros-display';
import { canonicalCountryLabel } from '@motor/viagens/trip-countries.js';
import { checkDueOn } from './tripChecklistUtils';
import { inclusiveDayCount, parseDayKey } from '@motor/viagens/calendar-format.js';

const FLIGHT_PREFIX = 'rote-flight-';
const REMOTE_WORK_START = '09:00';
const REMOTE_WORK_END = '18:00';

export type TripDiaryTimeTwin = {
    label: string;
    flag: string;
    hm: string;
    role: 'local' | 'home';
    /** Data civil neste fuso (para tooltip). */
    dateLabel: string;
    /** Texto completo da legenda flutuante. */
    tip: string;
};

export type TripDiaryHighlight = {
    id: string;
    kind: 'flight' | 'remote' | 'activity' | 'info';
    text: string;
    sub?: string;
    /** Horário do evento + equivalente Recife / local do dia. */
    times?: TripDiaryTimeTwin[];
};

export type TripDiaryDayEntry = {
    dayKey: string;
    dayIndex: number;
    label: { week: string; short: string; long: string } | null;
    placeName: string;
    countryLabel: string;
    countryFlag: string;
    currencyCode: string;
    timeZone: string;
    homeTimeLabel: string;
    budget: ReturnType<typeof tripDiaryDailyBudget>;
    highlights: TripDiaryHighlight[];
    checklist: TripCheckItem[];
    isToday: boolean;
};

export type TripFeedCityPin = { id: string; name: string; sub?: string; country?: string };

export function buildTripDiaryFeed(draft: TripDraft, trip: Trip, now = new Date()): {
    countdown: ReturnType<typeof tripFeedCountdown>;
    clocks: ReturnType<typeof tripFeedClockZones>;
    days: TripDiaryDayEntry[];
    cityTrail: TripFeedCityPin[];
} {
    const destinations = draft.payload.destinations ?? [];
    const stops = routeStops(destinations);
    const resumoStops = resumoStopsForTrip(
        draft.payload,
        destinations,
        draft.startsOn,
        draft.endsOn
    );
    const keys = tripDiaryDayKeys(draft.startsOn, draft.endsOn);
    const todayKey = now.toISOString().slice(0, 10);

    const itinerary = enrichedItinerary(draft);
    const remoteKeys = remoteDayKeysForDraft(draft, destinations);
    const tripRef = { payload: draft.payload, budgetCaps: draft.budgetCaps };
    const checks = draft.payload.checks ?? [];
    const cityTrail = buildCityTrail(draft, destinations);

    const days: TripDiaryDayEntry[] = keys.map((key, index) => {
        const day = itinerary.find((d) => dayKeyOf(d) === key) ?? { id: key, dayKey: key, items: [] };
        const loc = resolveDayLocationForResumo(day, key, resumoStops, destinations);
        const place = loc.stop ?? resolveUserDayPlace(day, stops, destinations);
        const country =
            loc.country ||
            String(place?.country ?? '').trim() ||
            countryForDayKey(key, resumoStops.length ? resumoStops : stops);
        const cityLabel = loc.city;
        const timeZone =
            guessTimeZoneForCountry(cityLabel || place?.name || '') ||
            guessTimeZoneForCountry(country) ||
            'America/Sao_Paulo';
        // Tag do feed: cidade do resumo (não destinationId preso em Madri).
        const placeName = cityLabel;
        const countryFlag = countryFlagEmoji(country);
        // Trabalho remoto ancora em Recife (09–18); homeTimeLabel = fim do expediente BR.
        const homeHm = REMOTE_WORK_END.slice(0, 5);
        const currencyPlace =
            cityLabel || (country ? countryRepresentativeCity(country) : '') || country || '';
        const currencyCode = resolveDayCurrencyCode(currencyPlace, country, place);
        const dayCtx: DayHighlightCtx = {
            dayKey: key,
            timeZone,
            placeName: cityLabel || currencyPlace || 'Local',
            countryLabel: country,
            countryFlag
        };

        return {
            dayKey: key,
            dayIndex: index + 1,
            label: formatDayLabel(key),
            placeName,
            countryLabel: country,
            countryFlag,
            currencyCode,
            timeZone,
            homeTimeLabel: homeHm ?? '—',
            budget: tripDiaryDailyBudget({
                trip: tripRef,
                onDayKey: key,
                startsOn: draft.startsOn,
                endsOn: draft.endsOn,
                now
            }),
            highlights: dayHighlights(day, remoteKeys, dayCtx, destinations),
            checklist: checksForDay(checks, key),
            isToday: key === todayKey
        };
    });

    return {
        countdown: tripFeedCountdown({
            startsOn: draft.startsOn,
            endsOn: draft.endsOn,
            statusOverride: draft.statusOverride ?? trip.statusOverride,
            now
        }),
        clocks: tripFeedClockZones(FEED_CLOCK_PLACES),
        days,
        cityTrail
    };
}

/** Relógios da faixa: sempre Recife (casa) + Pequim + Madri — não seguem o roteiro. */
const FEED_CLOCK_PLACES: Array<{ label: string; country: string }> = [
    { label: 'Pequim', country: 'China' },
    { label: 'Madri', country: 'Espanha' }
];

function foldTrailKey(s: string): string {
    return String(s ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .trim();
}

/** Unifica PEK/Pek/Beijing/Pequim, MAD/Madrid/Madri, etc. */
const TRAIL_CITY_ALIASES: Record<string, string> = {
    pek: 'pequim',
    pkx: 'pequim',
    peking: 'pequim',
    beijing: 'pequim',
    pequim: 'pequim',
    pvg: 'xangai',
    sha: 'xangai',
    shanghai: 'xangai',
    xangai: 'xangai',
    mad: 'madri',
    madrid: 'madri',
    madri: 'madri',
    bio: 'bilbao',
    bilbao: 'bilbao',
    csg: 'changsha',
    changsha: 'changsha'
};

const TRAIL_CITY_DISPLAY: Record<string, string> = {
    pequim: 'Pequim',
    xangai: 'Xangai',
    madri: 'Madri',
    bilbao: 'Bilbao',
    changsha: 'Changsha'
};

function canonTrailCityKey(raw: string): string {
    const stripped = stripAirportCodeLabel(String(raw ?? '').trim());
    if (!stripped) return '';
    const head = foldTrailKey(stripped.split(/[,/·]/)[0] ?? '');
    if (!head) return '';
    if (TRAIL_CITY_ALIASES[head]) return TRAIL_CITY_ALIASES[head];
    const mapped = mapPlaceCityLabel(stripped);
    if (mapped) {
        const mk = foldTrailKey(mapped.split('/')[0] ?? '');
        if (TRAIL_CITY_ALIASES[mk]) return TRAIL_CITY_ALIASES[mk];
        if (mk) return mk;
    }
    return head;
}

function trailCityDisplayName(raw: string, key: string): string {
    if (TRAIL_CITY_DISPLAY[key]) return TRAIL_CITY_DISPLAY[key];
    const mapped = mapPlaceCityLabel(stripAirportCodeLabel(raw));
    if (mapped) return mapped.split('/')[0]!.trim();
    return (
        stripAirportCodeLabel(raw)
            .split(/[,/·]/)[0]
            ?.trim() || raw
    );
}

function trailCountryCovered(pins: TripFeedCityPin[], country: string): boolean {
    const c = foldTrailKey(canonicalCountryLabel(country) || country);
    if (!c) return false;
    return pins.some((p) => {
        const pc = foldTrailKey(p.country || '');
        const pn = canonTrailCityKey(p.name);
        if (pc && pc === c) return true;
        if (c.includes('espan') && /madri|madrid|barcel|bilbao|sevilh|valencia/.test(pn)) return true;
        if (c.includes('china') && /xangai|shanghai|pequim|beijing|changsha|cantao|guangzhou/.test(pn))
            return true;
        if (c.includes('portugal') && /lisboa|lisbon|porto/.test(pn)) return true;
        return pn === c;
    });
}

/**
 * Trilha do feed: cidades na ordem dos dias do roteiro (1ª aparição),
 * sem misturar POI/hotel nem duplicar Pek/Pequim.
 */
export function buildCityTrail(draft: TripDraft, destinations: TripDestination[]): TripFeedCityPin[] {
    const itinerary = enrichedItinerary(draft);
    const resumoStops = resumoStopsForTrip(
        draft.payload,
        destinations,
        draft.startsOn,
        draft.endsOn
    );
    const seen = new Set<string>();
    const pins: TripFeedCityPin[] = [];

    const pushCity = (raw: string, id: string, country?: string, sub?: string) => {
        const key = canonTrailCityKey(raw);
        if (!key || seen.has(key) || /^(brasil|brazil)$/.test(key)) return;
        seen.add(key);
        pins.push({
            id,
            name: key === 'recife' ? 'Recife' : trailCityDisplayName(raw, key),
            sub,
            country: country?.trim() || (key === 'recife' ? 'Brasil' : undefined)
        });
    };

    // Ordem = dias do roteiro com local do resumo (mesma lógica do panorama).
    for (const day of sortedItineraryDays(itinerary)) {
        const key = dayKeyOf(day);
        if (!key) continue;
        const loc = resolveDayLocationForResumo(day, key, resumoStops, destinations);
        if (!loc.city && !loc.country) continue;
        pushCity(
            loc.city || countryRepresentativeCity(loc.country) || loc.country,
            `trail-day-${key}`,
            loc.country
        );
    }

    // País do resumo ainda sem cidade na trilha → representante.
    for (const dest of resumoStops) {
        const country =
            canonicalCountryLabel(dest.country ?? dest.name ?? '') || String(dest.name ?? '').trim();
        if (!country || /brasil|brazil/i.test(country)) continue;
        if (trailCountryCovered(pins, country)) continue;
        const city = countryRepresentativeCity(country);
        if (!city) continue;
        pushCity(city, `trail-resumo-${dest.id}`, country, trailStaySub(dest));
    }

    return pins;
}

/** Rótulo curto do pin: cidade, nunca o título longo do POI. */
function trailPinLabel(dest: TripDestination): string {
    const fromCity = mapPlaceCityLabel(dest.city ?? dest.neighborhood, dest.country);
    if (fromCity) return shortenTrailCity(fromCity);

    const title = mapPlaceCardTitle(dest).trim();
    const dash = title.lastIndexOf(' - ');
    if (dash > 0) {
        const tail = title.slice(dash + 3).trim();
        if (tail && !isCountryOnlyDestination({ ...dest, name: tail, kind: 'city' })) {
            return shortenTrailCity(tail);
        }
    }

    const nameHead = String(dest.name ?? '')
        .split(/[,/]/)[0]
        ?.trim();
    if (nameHead && nameHead.length <= 18 && !/muralha|wall of china|great wall/i.test(nameHead)) {
        const asCity = mapPlaceCityLabel(nameHead, dest.country);
        if (asCity) return shortenTrailCity(asCity);
        if (!/\s-\s/.test(nameHead)) return shortenTrailCity(nameHead);
    }

    if (dash > 0) return shortenTrailCity(title.slice(dash + 3).trim() || title);
    return shortenTrailCity(title || String(dest.name ?? '').trim() || 'Local');
}

function shortenTrailCity(raw: string): string {
    const s = String(raw ?? '').trim();
    if (!s) return 'Local';
    // «Pequim/Beijing» → «Pequim»
    const primary = s.split('/')[0]?.trim() || s;
    if (primary.length <= 14) return primary;
    return `${primary.slice(0, 12)}…`;
}

function trailStaySub(dest: TripDestination): string | undefined {
    const inDate = (dest.arrivedOn ?? '').trim().slice(0, 10);
    const outDate = (dest.departedOn ?? '').trim().slice(0, 10);
    const a = parseDayKey(inDate);
    const b = parseDayKey(outDate);
    if (a && b) {
        const days = inclusiveDayCount(a, b);
        if (days > 0) return `${days}d`;
    }
    return undefined;
}

function enrichedItinerary(draft: TripDraft): TripItineraryDay[] {
    const base = draft.payload.itinerary ?? [];
    const segments = draft.payload.flight_segments ?? draft.payload.flightSegments ?? [];
    const dests = draft.payload.destinations ?? [];
    const remoteKeys = remoteDayKeysFromPayload(draft.payload, dests, draft.startsOn);
    const withFlights = !draft.startsOn || !draft.endsOn
        ? mergeChosenFlightsIntoItinerary(base, segments, dests)
        : (() => {
              const keys = tripDiaryDayKeys(draft.startsOn, draft.endsOn);
              const filled: TripItineraryDay[] = keys.map((key) => {
                  const found = base.find((d) => dayKeyOf(d) === key);
                  return found ?? { id: `feed-${key}`, dayKey: key, items: [] };
              });
              return mergeChosenFlightsIntoItinerary(filled, segments, dests);
          })();
    const withRemote = mergeRemoteWorkIntoItinerary(withFlights, remoteKeys, dests);
    return mergeHolidayLeaveIntoItinerary(
        withRemote,
        holidayLeaveByDayFromPayload(draft.payload, dests, draft.startsOn, draft.endsOn),
        dests
    );
}

function remoteDayKeysForDraft(draft: TripDraft, destinations: TripDestination[]): Set<string> {
    return remoteDayKeysFromPayload(draft.payload, destinations, draft.startsOn);
}

function countryForDayKey(key: string, stops: ReturnType<typeof routeStops>): string {
    const dest = destinationForDate(key, stops);
    return String(dest?.country ?? dest?.name ?? '').trim();
}

/** Moeda do dia: país → cidade → país do destino. */
function resolveDayCurrencyCode(
    placeName: string,
    countryLabel: string,
    place: TripDestination | null | undefined
): string {
    const candidates = [countryLabel, place?.country, placeName, place?.name]
        .map((s) => String(s ?? '').trim())
        .filter(Boolean);
    for (const label of candidates) {
        const code = countryTravelBrief(label).currency.code;
        if (code) return code;
    }
    return 'BRL';
}

function checksForDay(checks: TripCheckItem[], key: string): TripCheckItem[] {
    return checks.filter((c) => checkDueOn(c) === key);
}

type DayHighlightCtx = {
    dayKey: string;
    timeZone: string;
    placeName: string;
    countryLabel: string;
    countryFlag: string;
};

function normalizeHm(raw: string): string | null {
    const m = String(raw ?? '')
        .trim()
        .match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
}

function shortPlaceLabel(raw: string): string {
    const s = raw.trim();
    if (!s) return 'Local';
    const iata = s.match(/\b([A-Z]{3})\b/);
    if (iata) {
        const known: Record<string, string> = {
            MAD: 'Madri',
            BIO: 'Bilbao',
            PEK: 'Pequim',
            PVG: 'Xangai',
            SHA: 'Xangai',
            REC: 'Recife',
            GRU: 'São Paulo',
            GIG: 'Rio'
        };
        if (known[iata[1]]) return known[iata[1]];
    }
    const beforeParen = s.split('(')[0]?.trim() || s;
    const first = beforeParen.split(/[,/·–-]/)[0]?.trim() || beforeParen;
    return first.length > 18 ? `${first.slice(0, 16)}…` : first;
}

function eventTimeZone(placeHint: string, fallbackTz: string): string {
    return guessTimeZoneForCountry(placeHint) || fallbackTz;
}

function isBrazilHomeTz(tz: string): boolean {
    return tz === TRIP_DIARY_HOME_TZ || tz === 'America/Sao_Paulo';
}

function makeTwin(
    role: 'local' | 'home',
    label: string,
    flag: string,
    hm: string,
    dateLabel: string
): TripDiaryTimeTwin {
    return {
        role,
        label,
        flag,
        hm,
        dateLabel,
        tip: `${label}: ${hm} · ${dateLabel}`
    };
}

function twinFromDetail(
    role: 'local' | 'home',
    label: string,
    flag: string,
    detail: { hm: string; dateLabel: string }
): TripDiaryTimeTwin {
    return makeTwin(role, label, flag, detail.hm, detail.dateLabel);
}

/**
 * Horário do evento + (opcional) ponta do voo + sempre o equivalente no Brasil.
 */
function buildTimeTwins(
    eventHm: string,
    eventTz: string,
    eventLabel: string,
    eventFlag: string,
    ctx: DayHighlightCtx,
    other?: { tz: string; label: string; flag: string } | null
): TripDiaryTimeTwin[] {
    const localLabel = shortPlaceLabel(ctx.placeName) || shortPlaceLabel(ctx.countryLabel) || 'Local';
    const eventName = shortPlaceLabel(eventLabel) || localLabel;
    const eventDetail = convertLocalHmToZoneDetail(eventHm, eventTz, ctx.dayKey, eventTz);
    if (!eventDetail) return [];

    const twins: TripDiaryTimeTwin[] = [
        twinFromDetail(
            isBrazilHomeTz(eventTz) ? 'home' : 'local',
            eventName,
            eventFlag || ctx.countryFlag || '🌍',
            eventDetail
        )
    ];

    if (other && other.tz && other.tz !== eventTz && !isBrazilHomeTz(other.tz)) {
        const otherDetail = convertLocalHmToZoneDetail(eventHm, eventTz, ctx.dayKey, other.tz);
        if (otherDetail) {
            twins.push(
                twinFromDetail('local', shortPlaceLabel(other.label), other.flag || '🌍', otherDetail)
            );
        }
    }

    if (!twins.some((t) => t.role === 'home')) {
        const homeDetail = convertLocalHmToZoneDetail(eventHm, eventTz, ctx.dayKey, TRIP_DIARY_HOME_TZ);
        if (homeDetail) {
            twins.push(twinFromDetail('home', TRIP_DIARY_HOME_LABEL, '🇧🇷', homeDetail));
        }
    }

    return twins;
}

/**
 * Trabalho remoto: sempre 09:00–18:00 no Brasil (Recife),
 * traduzido para o fuso do local do dia.
 */
function buildRemoteWorkTwins(ctx: DayHighlightCtx): TripDiaryTimeTwin[] {
    const start = REMOTE_WORK_START.slice(0, 5);
    const end = REMOTE_WORK_END.slice(0, 5);

    const startHome = convertLocalHmToZoneDetail(start, TRIP_DIARY_HOME_TZ, ctx.dayKey, TRIP_DIARY_HOME_TZ);
    const endHome = convertLocalHmToZoneDetail(end, TRIP_DIARY_HOME_TZ, ctx.dayKey, TRIP_DIARY_HOME_TZ);
    if (!startHome || !endHome) return [];

    const homeDates =
        startHome.dateLabel === endHome.dateLabel
            ? startHome.dateLabel
            : `${startHome.dateLabel} – ${endHome.dateLabel}`;

    const twins: TripDiaryTimeTwin[] = [
        makeTwin('home', TRIP_DIARY_HOME_LABEL, '🇧🇷', `${startHome.hm}–${endHome.hm}`, homeDates)
    ];

    if (isBrazilHomeTz(ctx.timeZone)) return twins;

    const startLocal = convertLocalHmToZoneDetail(start, TRIP_DIARY_HOME_TZ, ctx.dayKey, ctx.timeZone);
    const endLocal = convertLocalHmToZoneDetail(end, TRIP_DIARY_HOME_TZ, ctx.dayKey, ctx.timeZone);
    if (!startLocal || !endLocal) return twins;

    const localDates =
        startLocal.dateLabel === endLocal.dateLabel
            ? startLocal.dateLabel
            : `${startLocal.dateLabel} – ${endLocal.dateLabel}`;
    const localLabel = shortPlaceLabel(ctx.placeName) || shortPlaceLabel(ctx.countryLabel) || 'Local';

    twins.push(
        makeTwin('local', localLabel, ctx.countryFlag || '🌍', `${startLocal.hm}–${endLocal.hm}`, localDates)
    );
    return twins;
}

function dayHighlights(
    day: TripItineraryDay,
    remoteKeys: Set<string>,
    ctx: DayHighlightCtx,
    destinations: TripDestination[]
): TripDiaryHighlight[] {
    const items = day.items ?? [];
    const out: TripDiaryHighlight[] = [];

    const flights = items.filter((i) => i.id.startsWith(FLIGHT_PREFIX));
    for (const f of flights) {
        const t = normalizeHm(f.time ?? '');
        const rawTitle = (f.title ?? 'Voo').trim();
        const isArrival = /^chegada\b/i.test(rawTitle);
        const route = rawTitle
            .replace(/^Voo volta ·\s*/i, '')
            .replace(/^Voo ·\s*/i, '')
            .replace(/^Chegada ·\s*/i, '');
        const placeHint = (f.placeName ?? f.place_name ?? '').trim();
        const legs = route.split(/\s*→\s*/).map((s) => s.trim()).filter(Boolean);
        const eventPlace = placeHint || (isArrival ? legs[1] || legs[0] : legs[0]) || ctx.placeName;
        const otherPlace = isArrival ? legs[0] : legs[1];
        const eventTz = eventTimeZone(eventPlace, ctx.timeZone);
        const eventFlag = countryFlagEmoji(eventPlace) || ctx.countryFlag || '🌍';
        const otherTz = otherPlace ? eventTimeZone(otherPlace, '') : '';
        const other =
            otherPlace && otherTz && otherTz !== eventTz
                ? {
                      tz: otherTz,
                      label: shortPlaceLabel(otherPlace),
                      flag: countryFlagEmoji(otherPlace) || '🌍'
                  }
                : null;
        out.push({
            id: f.id,
            kind: 'flight',
            text: isArrival ? `Chegada · ${shortPlaceLabel(route)}` : `Voo · ${route}`,
            sub: undefined,
            times: t ? buildTimeTwins(t, eventTz, eventPlace, eventFlag, ctx, other) : undefined
        });
    }

    const dayNotice = String(day.notes ?? '').trim();
    if (/^Feriado BR ·/i.test(dayNotice)) {
        out.push({
            id: `day-notice-${ctx.dayKey}`,
            kind: 'activity',
            text: dayNotice
        });
    }

    const remoteItem = items.find((i) => isRemoteItineraryItem(i));
    if (remoteItem || remoteKeys.has(ctx.dayKey)) {
        const title = (remoteItem?.title ?? 'Trabalho remoto').trim() || 'Trabalho remoto';
        // Se o usuário editou o horário no roteiro, usa esse instante local; senão 09–18 Recife.
        const editedHm = normalizeHm(remoteItem?.time ?? '');
        const times = editedHm
            ? buildTimeTwins(editedHm, ctx.timeZone, ctx.placeName, ctx.countryFlag || '🌍', ctx, null)
            : buildRemoteWorkTwins(ctx);
        out.push({
            id: remoteItem?.id ?? `remote-${ctx.dayKey}`,
            kind: 'remote',
            text: title,
            times
        });
    }

    for (const a of items.filter(
        (i) =>
            !i.id.startsWith(FLIGHT_PREFIX) &&
            !isRemoteItineraryItem(i) &&
            !isHolidayLeaveItem(i) &&
            (i.title ?? '').trim()
    )) {
        const t = normalizeHm(a.time ?? '');
        const title = (a.title ?? 'Atividade').trim();
        const linked = a.destinationId
            ? destinations.find((d) => d.id === a.destinationId) ?? null
            : null;
        const fromDest = linked
            ? mapPlaceCityLabel(linked.city ?? linked.neighborhood, linked.country) ||
              stripAirportCodeLabel(String(linked.name ?? '').split(/[,/·]/)[0]?.trim() || '') ||
              mapPlaceCardTitle(linked)
            : '';
        let place = stripAirportCodeLabel(fromDest || String(a.placeName ?? a.place_name ?? '').trim());
        if (place && isCountryOnlyPlaceName(place)) {
            place = stripAirportCodeLabel(ctx.placeName) || countryRepresentativeCity(place) || '';
        }
        const placeHint = place || ctx.placeName;
        const eventTz = eventTimeZone(placeHint, ctx.timeZone);
        out.push({
            id: a.id,
            kind: 'activity',
            text: place ? `Passeio em ${place}` : title,
            sub: place && place !== title ? title : undefined,
            times: t
                ? buildTimeTwins(t, eventTz, placeHint, ctx.countryFlag || '🌍', ctx, null)
                : undefined
        });
    }

    return out;
}
