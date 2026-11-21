import {
    canonicalCountryLabel,
    countryMapCenterForLabel,
    isCountryCatalogLabel,
    uniqueCountryLabels
} from '@motor/viagens/trip-countries.js';
import { extractIata, resolveFlightPlace } from '@motor/viagens/flight-route-geo.js';
import { isHomeDestination, routeStops } from '@motor/viagens/trip-places.js';
import { itineraryDays } from '@motor/viagens/trips-engine.js';
import { buildRemoteSnapshot, normalizeRemotePolicy } from '@motor/viagens/trip-scenario-remote.js';
import { workHolidayNameByDay } from '@motor/viagens/trip-work-holiday-calendar.js';
import {
    convertLocalHmToZoneDetail,
    guessTimeZoneForCountry,
    TRIP_DIARY_HOME_TZ
} from '@motor/viagens/trip-diary-feed.js';
import {
    applyManagedFlightInjections,
    FLIGHT_ITEM_PREFIX
} from '@motor/viagens/flight-itinerary-items.js';
import { flightStampParts, toDatetimeLocal } from '../../domain/flightDisplay';
import { chosenScenarioFromPayload, chosenScenarioRota, chosenScenarioSnapshot } from '../../domain/chosenScenarioResumo';
import { countryStayDateWindows } from '../../domain/tripScenarioDisplay';
import { snapshotDayBounds } from '../../domain/tripScenarioChosen';
import { countryNameFromPlace, hopDayKey } from '../../domain/tripTimeScenario';
import { effectiveTripPeriod } from '../../domain/tripResumoStats';
import { haversineKm } from '@motor/viagens/geo-distance.js';
import type {
    GeocodeHit,
    TripDestination,
    TripFlightSegment,
    TripItineraryDay,
    TripItineraryItem,
    TripPayload,
    TripStay
} from '../../types';
import {
    matchDestinationIdForStay,
    stayDisplayTitle,
    stayLatLng,
    suggestStayForDayKey
} from '../hospedagens/hospedagens-display';
import {
    coerceLatinGeocodeLabel,
    countryDisplayName,
    geocodeHitDisplayLabel,
    isLatinUiText,
    parentCityFromLatinAddress,
    pickAddressDisplayLine,
    snapGreatWallPlace
} from '../../utils/place-display';
import { todayKey } from '../../utils/tripCalendar';
import {
    ORCAMENTO_CATEGORIES,
    defaultOrcamentoCategoryLabel,
    orcamentoCategoryLabel,
    type OrcamentoCategoryId
} from '../orcamento/orcamento-model';

export const ROTEIRO_PIN_TINTS = ['coral', 'turquesa', 'oceano', 'ouro', 'coral'] as const;

export { FLIGHT_ITEM_PREFIX };
export const REMOTE_ITEM_PREFIX = 'rote-remote-';
export const HOLIDAY_ITEM_PREFIX = 'rote-holiday-';
const REMOTE_WORK_START = '09:00';
const REMOTE_WORK_END = '18:00';

export const PLACE_KIND_LABELS: Record<string, string> = {
    city: 'Cidade',
    neighborhood: 'Bairro',
    country: 'País',
    region: 'Região',
    poi: 'Ponto',
    airport: 'Aeroporto',
    lodging: 'Hospedagem',
    attraction: 'Ponto turístico',
    restaurant: 'Restaurante',
    shopping: 'Shopping',
    shop: 'Loja',
    other: 'Lugar'
};

/** Tipo de atividade do roteiro → categoria do orçamento (rótulo editável lá). */
export const ITINERARY_TO_ORCAMENTO: Partial<Record<string, OrcamentoCategoryId>> = {
    sight: 'passeios',
    food: 'comida',
    transport: 'transporte',
    lodging: 'hospedagem',
    shopping: 'extras'
};

export function itineraryCategoryLabel(
    category: string | null | undefined,
    payload?: TripPayload | null
): string {
    const key = String(category ?? 'sight').trim() || 'sight';
    const orcId = ITINERARY_TO_ORCAMENTO[key];
    if (orcId) {
        const def = ORCAMENTO_CATEGORIES.find((c) => c.id === orcId);
        const fallback = def?.label ?? defaultOrcamentoCategoryLabel(orcId);
        return orcamentoCategoryLabel(payload, orcId, fallback);
    }
    return ITINERARY_CAT_LABELS[key] ?? 'Atividade';
}

export const ITINERARY_CAT_LABELS: Record<string, string> = {
    sight: 'Passeio',
    food: 'Comida',
    transport: 'Transportes',
    lodging: 'Hospedagem',
    shopping: 'Compras',
    remote: 'Remoto',
    important: 'Importante'
};

export const ITINERARY_CAT_ICONS: Record<string, string> = {
    sight: 'photo_camera',
    food: 'restaurant',
    transport: 'directions_transit',
    lodging: 'hotel',
    shopping: 'shopping_bag',
    remote: 'laptop_mac',
    important: 'priority_high'
};

export function isRemoteItineraryItem(item: { id?: string; category?: string | null }): boolean {
    const id = String(item.id ?? '');
    return id.startsWith(REMOTE_ITEM_PREFIX) || String(item.category ?? '') === 'remote';
}

/** Slot automático do dia de feriado BR (atividade «Dia livre»; feriado só nas notas). */
export function isHolidayLeaveItem(item: { id?: string; category?: string | null }): boolean {
    return String(item.id ?? '').startsWith(HOLIDAY_ITEM_PREFIX);
}

function holidayLeaveNotes(
    holidayName: string,
    localSpan: string,
    localTz: string
): string {
    const head = `Feriado BR · ${holidayName}`;
    if (localTz === TRIP_DIARY_HOME_TZ) {
        return `${head} · ${REMOTE_WORK_START}–${REMOTE_WORK_END} Recife (sem remoto)`;
    }
    return `${head} · ${localSpan} local · ${REMOTE_WORK_START}–${REMOTE_WORK_END} Recife (sem remoto)`;
}

/** Dias de trabalho remoto do cenário escolhido. */
export function remoteDayKeysFromPayload(
    payload: TripPayload,
    destinations: TripDestination[] = [],
    startsOn?: string | null
): Set<string> {
    const scenario = chosenScenarioFromPayload(payload);
    if (!scenario) return new Set();
    const segments = payload.flight_segments ?? payload.flightSegments ?? [];
    const snap = chosenScenarioSnapshot(scenario, segments, destinations, startsOn?.trim() || undefined);
    const { start, end } = snapshotDayBounds(snap);
    if (!start || !end) return new Set();
    const hopStart = new Date(`${start}T12:00:00`);
    const hopEnd = new Date(`${end}T12:00:00`);
    const { remoteDayKeys } = buildRemoteSnapshot(scenario, hopStart, hopEnd);
    return remoteDayKeys;
}

/** Feriados BR no intervalo do cenário → nome (ex.: Tiradentes). */
export function holidayLeaveByDayFromPayload(
    payload: TripPayload,
    destinations: TripDestination[] = [],
    startsOn?: string | null,
    endsOn?: string | null
): Map<string, string> {
    const scenario = chosenScenarioFromPayload(payload);
    const segments = payload.flight_segments ?? payload.flightSegments ?? [];
    let start = (startsOn ?? '').trim().slice(0, 10);
    let end = (endsOn ?? '').trim().slice(0, 10);
    if (scenario) {
        const snap = chosenScenarioSnapshot(scenario, segments, destinations, start || undefined);
        const bounds = snapshotDayBounds(snap);
        if (bounds.start) start = bounds.start;
        if (bounds.end) end = bounds.end;
    }
    if (!start || !end) return new Map();
    const hopStart = new Date(`${start}T12:00:00`);
    const hopEnd = new Date(`${end}T12:00:00`);
    const remote = normalizeRemotePolicy(scenario?.remote);
    return workHolidayNameByDay(hopStart, hopEnd, remote.workTimeZone, remote.holidays);
}

export function orderedStops(destinations: TripDestination[]): TripDestination[] {
    return routeStops(destinations) as TripDestination[];
}

function foldedCountryKey(label: string): string {
    return canonicalCountryLabel(label).toLowerCase();
}

function foldAscii(text: string): string {
    return String(text ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .trim();
}

const MAP_DEST_COORD_EPS = 0.0008;

/** Id no payload para um pin mostrado no mapa (id ou mesmas coordenadas). */
export function resolvePayloadDestinationId(
    mapDest: TripDestination,
    destinations: TripDestination[]
): string | null {
    const byId = destinations.find((d) => d.id === mapDest.id);
    if (byId) return byId.id;
    const byCoord = destinations.find(
        (d) =>
            Math.abs(d.latitude - mapDest.latitude) < MAP_DEST_COORD_EPS &&
            Math.abs(d.longitude - mapDest.longitude) < MAP_DEST_COORD_EPS
    );
    return byCoord?.id ?? null;
}

export function destinationsNear(a: TripDestination, b: TripDestination): boolean {
    return (
        Math.abs(a.latitude - b.latitude) < MAP_DEST_COORD_EPS &&
        Math.abs(a.longitude - b.longitude) < MAP_DEST_COORD_EPS
    );
}

export function hiddenMapDestIds(payload: TripPayload): Set<string> {
    const raw = payload.roteMapHiddenDestIds ?? payload.rote_map_hidden_dest_ids;
    if (!Array.isArray(raw)) return new Set();
    return new Set(raw.filter((x): x is string => typeof x === 'string' && x.length > 0));
}

/** Qualquer pin do mapa (inclusive marcador manual) pode sair; paradas só do resumo somem da visualização. */
export function canRemoveMapDestination(_mapDest: TripDestination, _destinations: TripDestination[]): boolean {
    return true;
}

export function tripCountryLabels(payload: TripPayload, destinations: TripDestination[]): string[] {
    const raw = payload.tripCountries ?? payload.trip_countries;
    if (Array.isArray(raw) && raw.length) return uniqueCountryLabels(raw);
    const fromRoute = orderedStops(destinations)
        .map((d) => (d.country ?? d.name ?? '').trim())
        .filter(Boolean);
    return uniqueCountryLabels(fromRoute);
}

function virtualCountryStop(label: string): TripDestination | null {
    const country = canonicalCountryLabel(label);
    if (!country) return null;
    const center = countryMapCenterForLabel(country);
    if (!center) return null;
    const key = foldedCountryKey(country).replace(/\s+/g, '-');
    return {
        id: `rote-country-${key}`,
        name: country,
        country,
        kind: 'country',
        latitude: center.latitude,
        longitude: center.longitude,
        guideHighlights: [],
        guideAlerts: []
    };
}

/** Paradas para mapa e atalhos: roteiro + países da ficha com centro aproximado. */
export function roteiroNavStops(destinations: TripDestination[], payload: TripPayload): TripDestination[] {
    const labels = tripCountryLabels(payload, destinations);
    const route = orderedStops(destinations);
    if (!labels.length) return route;

    const byCountry = new Map<string, TripDestination>();
    for (const d of route) {
        const c = canonicalCountryLabel(d.country ?? d.name);
        if (c) byCountry.set(foldedCountryKey(c), d);
    }

    const merged: TripDestination[] = [];
    for (const label of labels) {
        const hit = byCountry.get(foldedCountryKey(label));
        if (hit) {
            const center = countryMapCenterForLabel(label);
            merged.push({
                ...hit,
                country: hit.country ?? canonicalCountryLabel(label),
                latitude: Number.isFinite(hit.latitude) ? hit.latitude : (center?.latitude ?? hit.latitude),
                longitude: Number.isFinite(hit.longitude) ? hit.longitude : (center?.longitude ?? hit.longitude)
            });
            continue;
        }
        const virtual = virtualCountryStop(label);
        if (virtual) merged.push(virtual);
    }

    if (merged.length) return merged;
    return route;
}

/** Reparte o intervalo da viagem entre paradas sem datas (só preenche lacunas). */
export function ensureStopDateWindows(
    stops: TripDestination[],
    startsOn: string,
    endsOn: string
): TripDestination[] {
    const start = (startsOn ?? '').trim();
    const end = (endsOn ?? '').trim();
    if (!start || !end || stops.length === 0) return stops;

    const keys = (itineraryDays(start, end, []) as TripItineraryDay[]).map((d) => dayKeyOf(d)).filter(Boolean);
    if (!keys.length) return stops;

    const needs = stops.some((s) => !(s.arrivedOn ?? '').trim() || !(s.departedOn ?? '').trim());
    if (!needs) return stops;

    const n = stops.length;
    const chunk = Math.max(1, Math.floor(keys.length / n));
    let cursor = 0;

    return stops.map((stop, idx) => {
        if ((stop.arrivedOn ?? '').trim() && (stop.departedOn ?? '').trim()) return stop;
        const arrivedOn = keys[cursor] ?? keys[0];
        const endIdx = idx === n - 1 ? keys.length - 1 : Math.min(keys.length - 1, cursor + chunk - 1);
        const departedOn = keys[endIdx] ?? arrivedOn;
        cursor = endIdx + 1;
        return { ...stop, arrivedOn, departedOn };
    });
}

/** Dias por país conforme resumo / cenário escolhido da viagem. */
export function resumoCountryDaysMap(
    payload: TripPayload,
    destinations: TripDestination[],
    tripStartsOn: string
): Map<string, number> {
    const rota = chosenScenarioRota(payload, destinations, tripStartsOn);
    const out = new Map<string, number>();
    for (const row of rota?.countries ?? []) {
        if (row.isLayoverOnly) continue;
        const key = foldedCountryKey(row.country);
        const prev = out.get(key) ?? 0;
        out.set(key, prev + Math.max(0, row.days));
    }
    return out;
}

export function resumoDaysForCountry(
    payload: TripPayload,
    destinations: TripDestination[],
    tripStartsOn: string,
    countryLabel: string
): number | null {
    const map = resumoCountryDaysMap(payload, destinations, tripStartsOn);
    const d = map.get(foldedCountryKey(countryLabel));
    return d != null && d > 0 ? d : null;
}

/** Preferir cidade/país âncora do voo; nunca POI/bairro (ex.: Furong) como parada do resumo. */
function pickResumoAnchorStop(
    stops: TripDestination[],
    country: string,
    preferredCity: string | undefined,
    usedIds: Set<string>
): TripDestination | null {
    const countryKey = foldedCountryKey(country);
    const candidates = stops.filter(
        (s) => !usedIds.has(s.id) && foldedCountryKey(s.country ?? s.name) === countryKey
    );
    if (!candidates.length) return null;

    const hopCity = foldAscii(preferredCity ?? '');
    const rep = foldAscii(countryRepresentativeCity(country));

    const score = (s: TripDestination): number => {
        if (s.kind === 'country' || isCountryOnlyDestination(s)) return 100;
        const label = foldAscii(cityLabelFromDestination(s) || String(s.name ?? ''));
        if (hopCity && (label === hopCity || label.includes(hopCity) || hopCity.includes(label))) return 90;
        if (rep && (label === rep || label.includes(rep))) return 85;
        if (s.kind === 'city' || s.kind === 'airport') return 40;
        if (s.kind === 'neighborhood' || s.kind === 'poi' || s.kind === 'shopping' || s.kind === 'shop')
            return 5;
        return 15;
    };

    const ranked = [...candidates].sort((a, b) => score(b) - score(a));
    const best = ranked[0];
    if (!best || score(best) < 40) return null;
    return best;
}

/** Janelas de chegada/saída por país a partir dos voos (cenário escolhido).
 * Inclui escalas com dias > 0 (ex.: 1d Madri). Pins POI não viram âncora do calendário.
 */
export function applyResumoStopWindows(
    stops: TripDestination[],
    payload: TripPayload,
    allDestinations: TripDestination[],
    startsOn: string,
    endsOn: string
): TripDestination[] {
    const period = effectiveTripPeriod(startsOn, endsOn, payload, allDestinations);
    const keys = (itineraryDays(period.startsOn, period.endsOn, []) as TripItineraryDay[])
        .map((d) => dayKeyOf(d))
        .filter(Boolean);
    if (!keys.length) return stops;

    const rota = chosenScenarioRota(payload, allDestinations, startsOn);
    const hopWindows = countryStayDateWindows(rota?.hops ?? []);
    const rows = (rota?.countries ?? []).filter((r) => r.days > 0);
    if (!rows.length && !hopWindows.length) {
        return ensureStopDateWindows(stops, period.startsOn, period.endsOn);
    }

    const windowByCountry = new Map(
        hopWindows.map((w) => [foldedCountryKey(w.country), w] as const)
    );

    const usedIds = new Set<string>();
    const withWindows: TripDestination[] = [];

    const countries = rows.length
        ? rows.map((r) => ({
              country: r.country,
              city: r.city ?? windowByCountry.get(foldedCountryKey(r.country))?.city,
              days: r.days
          }))
        : hopWindows.map((w) => ({ country: w.country, city: w.city, days: w.days }));

    let cursor = 0;
    for (const row of countries) {
        const win = windowByCountry.get(foldedCountryKey(row.country));
        const anchor =
            pickResumoAnchorStop(stops, row.country, row.city, usedIds) ??
            virtualCountryStop(row.country);
        if (!anchor) continue;
        if (!anchor.id.startsWith('rote-country-')) usedIds.add(anchor.id);

        let arrivedOn = win?.arrivedOn;
        let departedOn = win?.departedOn;
        if (!arrivedOn || !departedOn) {
            const dayCount = Math.max(1, win?.days ?? row.days ?? 1);
            const startIdx = Math.min(cursor, keys.length - 1);
            const endIdx = Math.min(keys.length - 1, startIdx + dayCount - 1);
            arrivedOn = keys[startIdx];
            departedOn = keys[endIdx];
            cursor = endIdx + 1;
        } else {
            const endIdx = keys.indexOf(departedOn);
            if (endIdx >= 0) cursor = Math.max(cursor, endIdx + 1);
        }

        const cityHint = row.city || win?.city || countryRepresentativeCity(row.country);
        withWindows.push({
            ...anchor,
            arrivedOn,
            departedOn,
            // Guarda cidade do voo para o feed (evita Furong/POI no rótulo).
            city: cityHint || anchor.city,
            country: anchor.country || canonicalCountryLabel(row.country) || row.country
        });
    }

    const extras = stops
        .filter((s) => !usedIds.has(s.id))
        .map((s) => ({ ...s, arrivedOn: undefined, departedOn: undefined }));

    return [...withWindows, ...extras];
}

export function sortedItineraryDays(days: TripItineraryDay[]): TripItineraryDay[] {
    return [...days].sort((a, b) => {
        const ka = dayKeyOf(a);
        const kb = dayKeyOf(b);
        if (ka && kb) return ka.localeCompare(kb);
        return 0;
    });
}

/** Cria destinos no payload a partir de `tripCountries` quando o roteiro ainda não tem pins. */
export function materializeTripCountryDestinations(
    destinations: TripDestination[],
    payload: TripPayload,
    startsOn: string,
    endsOn: string
): TripDestination[] | null {
    const labels = tripCountryLabels(payload, destinations);
    if (!labels.length) return null;

    const route = orderedStops(destinations);
    const have = new Set(route.map((d) => foldedCountryKey(d.country ?? d.name ?? '')));
    const missing = labels.filter((l) => !have.has(foldedCountryKey(l)));
    if (!missing.length) return null;

    const added: TripDestination[] = [];
    for (const label of missing) {
        const country = canonicalCountryLabel(label);
        const center = countryMapCenterForLabel(country);
        if (!country || !center) continue;
        added.push({
            id: crypto.randomUUID(),
            name: country,
            country,
            kind: 'country',
            latitude: center.latitude,
            longitude: center.longitude,
            guideHighlights: [],
            guideAlerts: []
        });
    }
    if (!added.length) return null;

    const merged = [...destinations, ...added];
    return ensureStopDateWindows(orderedStops(merged), startsOn, endsOn);
}

function mapPinPriority(dest: TripDestination): number {
    const k = String(dest.kind ?? '');
    if (k === 'city' || k === 'poi' || k === 'neighborhood' || k === 'shopping' || k === 'shop') return 4;
    if (k === 'airport') return 2;
    if (k === 'country') return 1;
    return 3;
}

function pruneMapDestinations(list: TripDestination[]): TripDestination[] {
    const byCountry = new Map<string, TripDestination[]>();
    for (const d of list) {
        const key = foldedCountryKey(d.country ?? d.name ?? '');
        const bucket = byCountry.get(key) ?? [];
        bucket.push(d);
        byCountry.set(key, bucket);
    }
    const drop = new Set<string>();
    for (const bucket of byCountry.values()) {
        const specific = bucket.filter((d) => mapPinPriority(d) >= 3);
        if (specific.length > 0) {
            for (const d of bucket) {
                if (d.kind === 'country') drop.add(d.id);
            }
        }
    }
    return list.filter((d) => !drop.has(d.id));
}

export function destinationsForMap(
    destinations: TripDestination[],
    navStops: TripDestination[],
    hiddenIds?: Set<string>
): TripDestination[] {
    const out = [...destinations];
    const seen = new Set(out.map((d) => d.id));
    for (const nav of navStops) {
        if (seen.has(nav.id)) continue;
        seen.add(nav.id);
        out.push(nav);
    }
    let list = pruneMapDestinations(out);
    if (!hiddenIds?.size) return list;
    return list.filter((d) => !hiddenIds.has(d.id));
}

export function dayKeyOf(day: TripItineraryDay): string {
    return (day.dayKey ?? day.day_key ?? '').trim();
}

/** Dia do roteiro já passou no calendário (America/São_Paulo). */
export function itineraryDayHasPassed(dayKey: string, nowKey = todayKey()): boolean {
    const key = (dayKey ?? '').trim();
    if (!key) return false;
    return key < nowKey;
}

export function formatDayLabel(dayKey: string): { week: string; short: string; long: string } | null {
    if (!dayKey) return null;
    const d = new Date(`${dayKey}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return {
        week: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
        short: d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', ''),
        long: d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    };
}

export function nightsBetween(arrived?: string | null, departed?: string | null): number | null {
    const a = (arrived ?? '').trim();
    const b = (departed ?? '').trim();
    if (!a || !b) return null;
    const start = new Date(`${a}T12:00:00`);
    const end = new Date(`${b}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
    return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function daysForStop(
    dest: TripDestination,
    days: TripItineraryDay[],
    stops: TripDestination[]
): TripItineraryDay[] {
    const destCountry = foldedCountryKey(dest.country ?? dest.name ?? '');
    return days.filter((day) => {
        if (day.destinationId === dest.id) return true;
        if (day.destinationId) {
            const linked = stops.find((s) => s.id === day.destinationId);
            if (linked && foldedCountryKey(linked.country ?? linked.name ?? '') === destCountry) return true;
        }
        const key = dayKeyOf(day);
        if (!key) return false;
        const match = destinationForDate(key, stops);
        if (match?.id === dest.id) return true;
        if (match && foldedCountryKey(match.country ?? match.name ?? '') === destCountry) return true;
        return false;
    });
}

function stopStayDaySpan(dest: TripDestination): number {
    const inDate = (dest.arrivedOn ?? '').trim();
    const outDate = (dest.departedOn ?? '').trim();
    if (!inDate || !outDate) return Number.POSITIVE_INFINITY;
    const start = new Date(`${inDate}T12:00:00`).getTime();
    const end = new Date(`${outDate}T12:00:00`).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return Number.POSITIVE_INFINITY;
    return Math.round((end - start) / 86400000) + 1;
}

export function destinationForDate(dayKey: string, stops: TripDestination[]): TripDestination | null {
    if (!dayKey) return null;
    const matches: TripDestination[] = [];
    for (const dest of stops) {
        const inDate = (dest.arrivedOn ?? '').trim();
        const outDate = (dest.departedOn ?? '').trim();
        if (!inDate && !outDate) continue;
        if (inDate && dayKey < inDate) continue;
        if (outDate && dayKey > outDate) continue;
        matches.push(dest);
    }
    if (!matches.length) return null;
    if (matches.length === 1) return matches[0];
    return [...matches].sort((a, b) => stopStayDaySpan(a) - stopStayDaySpan(b))[0];
}

/** Paradas com janelas do resumo (cenário escolhido) — mesma base do panorama da viagem. */
export function resumoStopsForTrip(
    payload: TripPayload,
    destinations: TripDestination[],
    startsOn: string,
    endsOn: string
): TripDestination[] {
    const base = roteiroNavStops(destinations, payload);
    return applyResumoStopWindows(base, payload, destinations, startsOn, endsOn);
}

/** Cidade curta de uma parada do resumo (país → cidade do voo / representante). */
export function resumoStopCityLabel(dest: TripDestination | null | undefined): string {
    if (!dest) return '';
    const country = String(dest.country ?? dest.name ?? '').trim();
    const rep = countryRepresentativeCity(country);
    if (isCountryOnlyDestination(dest) || dest.kind === 'country') {
        return String(dest.city ?? '').trim() || rep || '';
    }
    const hint = String(dest.city ?? '').trim();
    if (hint) {
        const mapped = mapPlaceCityLabel(hint, dest.country) || hint;
        const head = mapped.split('/')[0]?.trim() || mapped;
        if (head && foldAscii(head) !== foldAscii(String(dest.name ?? ''))) return head;
        if (rep && foldAscii(head) === foldAscii(rep)) return head;
        // city gravada pelo resumo (Madri/Pequim) mesmo se o pin for país
        if (rep || hopCityLooksLikeBase(head)) return head;
    }
    if (dest.kind === 'neighborhood' || dest.kind === 'poi' || dest.kind === 'shopping' || dest.kind === 'shop') {
        return rep || '';
    }
    const fromDest = cityLabelFromDestination(dest);
    if (fromDest && rep && foldAscii(fromDest) !== foldAscii(rep)) {
        // POI/bairro com nome de cidade próprio (Furong) → representante do país
        if (dest.kind !== 'city' && dest.kind !== 'airport') return rep;
    }
    return fromDest || rep || '';
}

function hopCityLooksLikeBase(city: string): boolean {
    const k = foldAscii(city);
    return /^(madri|madrid|pequim|beijing|xangai|shanghai|lisboa|porto|paris|roma|berlim)$/.test(k);
}

/**
 * Local do dia no feed/resumo: janela do resumo (voos) define o país.
 * Antes da 1ª chegada no exterior → Recife. Hospedagem refina cidade no mesmo país.
 */
export function resolveDayLocationForResumo(
    day: TripItineraryDay,
    dayKey: string,
    resumoStops: TripDestination[],
    destinations: TripDestination[]
): { city: string; country: string; stop: TripDestination | null } {
    const stop = destinationForDate(dayKey, resumoStops);
    if (!stop) {
        const firstForeign = resumoStops
            .filter((s) => (s.arrivedOn ?? '').trim())
            .sort((a, b) => String(a.arrivedOn).localeCompare(String(b.arrivedOn)))[0];
        const firstArrive = (firstForeign?.arrivedOn ?? '').trim();
        if (!firstArrive || dayKey < firstArrive) {
            return { city: 'Recife', country: 'Brasil', stop: null };
        }
        return { city: 'Recife', country: 'Brasil', stop: null };
    }

    const resumoCountry =
        canonicalCountryLabel(String(stop?.country ?? stop?.name ?? '').trim()) ||
        countryLabelForDestination(stop, destinations) ||
        '';
    const resumoCity = resumoStopCityLabel(stop);

    const hasStay = Boolean((day.stayId ?? '').trim()) && !isDayStayDeclined(day);
    if (hasStay) {
        const userCountry = journalDayWhereLabel(day, resumoStops, destinations);
        const userCity = journalDayCityLabel(day, resumoStops, destinations);
        if (
            userCity &&
            resumoCountry &&
            userCountry &&
            foldedCountryKey(userCountry) === foldedCountryKey(resumoCountry)
        ) {
            return { city: userCity, country: resumoCountry, stop };
        }
    }

    if (resumoCountry || resumoCity) {
        return {
            city: resumoCity || countryRepresentativeCity(resumoCountry) || '',
            country: resumoCountry,
            stop
        };
    }

    const userCountry = journalDayWhereLabel(day, resumoStops, destinations);
    const userCity = journalDayCityLabel(day, resumoStops, destinations);
    return {
        city: userCity || '',
        country: userCountry || '',
        stop: null
    };
}

export function placeToCountryLabel(place: string, destinations: TripDestination[]): string {
    const raw = place.trim();
    if (!raw) return '';
    if (/^[A-Za-z]{3}$/.test(raw)) {
        const pt = resolveFlightPlace(raw, destinations);
        if (pt?.label) {
            const fromAirport = countryNameFromPlace(pt.label);
            if (fromAirport) return canonicalCountryLabel(fromAirport);
        }
    }
    return canonicalCountryLabel(countryNameFromPlace(raw) || raw);
}

function resolvePlaceById(
    id: string | null | undefined,
    destinations: TripDestination[],
    stops: TripDestination[]
): TripDestination | null {
    if (!id) return null;
    const d = destinations.find((x) => x.id === id) ?? stops.find((x) => x.id === id) ?? null;
    if (!d) return null;
    if (d.kind === 'country') return null;
    return d;
}

/** Cidade/local que o usuário fixou (atividade ou dia), sem país genérico nem voo de outro contexto. */
export function resolveUserDayPlace(
    day: TripItineraryDay,
    stops: TripDestination[],
    destinations: TripDestination[]
): TripDestination | null {
    const items = day.items ?? [];
    const manual = items.filter((i) => !i.id.startsWith(FLIGHT_ITEM_PREFIX));
    for (let i = manual.length - 1; i >= 0; i--) {
        const linked = resolvePlaceById(manual[i]?.destinationId, destinations, stops);
        if (linked) return linked;
        const saved = String(manual[i]?.placeName ?? manual[i]?.place_name ?? '').trim();
        if (saved) {
            return {
                id: `rote-place-label-${i}`,
                name: saved,
                kind: 'city',
                latitude: NaN,
                longitude: NaN,
                guideHighlights: [],
                guideAlerts: []
            };
        }
    }
    const dayLinked = resolvePlaceById(day.destinationId, destinations, stops);
    if (dayLinked) return dayLinked;
    const daySaved = String(day.placeName ?? day.place_name ?? '').trim();
    if (daySaved) {
        return {
            id: `rote-day-place-${day.id}`,
            name: daySaved,
            kind: 'city',
            latitude: NaN,
            longitude: NaN,
            guideHighlights: [],
            guideAlerts: []
        };
    }
    return null;
}

function journalDayFlightArrivalLabel(
    day: TripItineraryDay,
    destinations: TripDestination[]
): string | null {
    const items = day.items ?? [];
    const arrivals = items.filter(
        (i) =>
            i.id.startsWith(FLIGHT_ITEM_PREFIX) &&
            (i.title ?? '').trim().toLowerCase().startsWith('chegada')
    );
    if (!arrivals.length) return null;
    const last = arrivals[arrivals.length - 1];
    const linked = resolvePlaceById(last.destinationId, destinations, destinations);
    if (linked) return `Chegada · ${activityPlaceLabel(linked)}`;
    const place = (last.title ?? '').replace(/^chegada\s*·\s*/i, '').trim();
    return place ? `Chegada · ${place}` : null;
}

function countryLabelForDestination(
    dest: TripDestination | null | undefined,
    destinations: TripDestination[]
): string {
    if (!dest) return '';
    const c = canonicalCountryLabel(String(dest.country ?? '').trim());
    if (c && !isCountryOnlyPlaceName(c)) return c;
    const fromName = placeToCountryLabel(dest.name, destinations);
    return fromName && !isCountryOnlyPlaceName(fromName) ? fromName : c;
}

function journalDayCountryFromFlights(
    day: TripItineraryDay,
    destinations: TripDestination[]
): string {
    const items = day.items ?? [];
    const flightItems = items.filter((i) => i.id.startsWith(FLIGHT_ITEM_PREFIX));
    if (!flightItems.length) return '';

    const arrivals = flightItems.filter((i) => (i.title ?? '').trim().toLowerCase().startsWith('chegada'));
    if (arrivals.length) {
        const last = arrivals[arrivals.length - 1];
        const linked = resolvePlaceById(last.destinationId, destinations, destinations);
        const fromDest = countryLabelForDestination(linked, destinations);
        if (fromDest) return fromDest;
        const place = (last.title ?? '').replace(/^chegada\s*·\s*/i, '').trim();
        if (place) {
            const c = placeToCountryLabel(place, destinations);
            if (c) return c;
        }
    }

    const voos = flightItems.filter((i) => (i.title ?? '').includes('→'));
    if (!voos.length) return '';
    const sorted = [...voos].sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
    const title = sorted[sorted.length - 1]?.title ?? '';
    const destPart = title.split('→').pop()?.trim().split(/·/)[0]?.trim();
    if (destPart) {
        const destCountry = placeToCountryLabel(destPart, destinations);
        if (destCountry && foldedCountryKey(destCountry) !== foldedCountryKey('Brasil')) {
            return destCountry;
        }
    }
    const depMatch = title.match(/·\s*(.+?)\s*→/);
    const depPart = depMatch?.[1]?.trim();
    return depPart ? placeToCountryLabel(depPart, destinations) : '';
}

/** País do cabeçalho do dia: local escolhido ou voo do dia — sem inferir POI/resumo. */
export function journalDayCountryLabel(
    day: TripItineraryDay,
    stops: TripDestination[],
    destinations: TripDestination[]
): string {
    return journalDayWhereLabel(day, stops, destinations);
}

function catalogHasPlaceId(id: string | null | undefined, catalog: TripDestination[]): boolean {
    if (!id) return false;
    const linked = catalog.find((d) => d.id === id);
    return Boolean(linked && linked.kind !== 'country');
}

function sanitizeItineraryPlaceId(
    id: string | null | undefined,
    catalog: TripDestination[]
): string | null {
    if (!id) return null;
    const linked = catalog.find((d) => d.id === id);
    if (!linked) return id;
    if (isCountryOnlyDestination(linked)) return null;
    return id;
}

function hasActivityUserPlace(
    item: TripItineraryItem,
    catalog: TripDestination[]
): boolean {
    const saved = String(item.placeName ?? item.place_name ?? '').trim();
    if (saved && !isCountryOnlyPlaceName(saved)) return true;
    const id = item.destinationId ?? null;
    if (!id) return false;
    const linked = catalog.find((d) => d.id === id);
    return Boolean(linked && !isCountryOnlyDestination(linked));
}

/** Mantém cidade/local que o usuário já fixou ao sincronizar dias ou voos. */
export function mergeItineraryUserPlaces(
    prev: TripItineraryDay[],
    next: TripItineraryDay[],
    destinations: TripDestination[] = []
): TripItineraryDay[] {
    const byKey = new Map<string, TripItineraryDay>();
    for (const d of prev) {
        const k = dayKeyOf(d);
        if (k) byKey.set(k, d);
    }
    return next.map((day) => {
        const key = dayKeyOf(day);
        const old = key ? byKey.get(key) : null;
        if (!old) return day;
        const oldItems = new Map((old.items ?? []).map((it) => [it.id, it]));
        const items = (day.items ?? []).map((it) => {
            const prevItem = oldItems.get(it.id);
            if (!prevItem) return normalizeItineraryItem(it);
            if (hasActivityUserPlace(prevItem, destinations)) {
                return normalizeItineraryItem({
                    ...it,
                    destinationId: prevItem.destinationId ?? it.destinationId ?? null,
                    placeName: prevItem.placeName ?? it.placeName ?? null,
                    travelMode: it.travelMode ?? prevItem.travelMode ?? null,
                    groundTransportId: it.groundTransportId ?? prevItem.groundTransportId ?? null,
                    saved: it.saved ?? prevItem.saved ?? false
                });
            }
            return normalizeItineraryItem({
                ...it,
                destinationId: it.destinationId ?? prevItem.destinationId ?? null,
                placeName: it.placeName ?? prevItem.placeName ?? null,
                travelMode: it.travelMode ?? prevItem.travelMode ?? null,
                groundTransportId: it.groundTransportId ?? prevItem.groundTransportId ?? null,
                saved: it.saved ?? prevItem.saved ?? false
            });
        });
        const hasStayPlace =
            Boolean(old.stayIdManual) || Boolean((day.stayId ?? old.stayId ?? '').trim());
        return {
            ...day,
            dayKey: key || day.dayKey,
            // Sem hospedagem, o sync/resumo manda — não ressuscita destinationId preso (ex.: Madri).
            destinationId: hasStayPlace
                ? (day.destinationId ?? old.destinationId ?? null)
                : (day.destinationId ?? null),
            placeName: hasStayPlace
                ? (day.placeName ?? old.placeName ?? null)
                : (day.placeName ?? null),
            notes: day.notes ?? old.notes ?? null,
            stayId: old.stayIdManual
                ? (old.stayId ?? null)
                : (day.stayId ?? old.stayId ?? null),
            stayIdManual: old.stayIdManual ?? day.stayIdManual ?? null,
            saved: day.saved ?? old.saved ?? false,
            items
        };
    });
}

export function syncTripItinerary(
    startsOn: string,
    endsOn: string,
    existing: TripItineraryDay[],
    stops: TripDestination[],
    destinations: TripDestination[] = []
): TripItineraryDay[] {
    const catalog = [...destinations, ...stops];
    const seen = new Set<string>();
    const mergedCatalog = catalog.filter((d) => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
    });
    const raw = itineraryDays(startsOn, endsOn, existing) as TripItineraryDay[];
    return raw.map((day) => {
        const key = dayKeyOf(day);
        let destinationId = sanitizeItineraryPlaceId(day.destinationId ?? null, mergedCatalog);
        const hasStay = Boolean((day.stayId ?? '').trim()) && !(day.stayIdManual && !day.stayId);
        if (!hasStay && key) {
            const fromWindow = destinationForDate(key, stops);
            if (fromWindow) {
                const linked = destinationId
                    ? mergedCatalog.find((d) => d.id === destinationId)
                    : null;
                const linkedCountry = foldedCountryKey(
                    String(linked?.country ?? linked?.name ?? '').trim()
                );
                const windowCountry = foldedCountryKey(
                    String(fromWindow.country ?? fromWindow.name ?? '').trim()
                );
                if (!linked || (linkedCountry && windowCountry && linkedCountry !== windowCountry)) {
                    destinationId = sanitizeItineraryPlaceId(fromWindow.id, mergedCatalog);
                }
            }
        }
        const items = (day.items ?? []).map((item) => {
            const norm = normalizeItineraryItem(item);
            const destId = sanitizeItineraryPlaceId(norm.destinationId, mergedCatalog);
            if (destId === norm.destinationId) return norm;
            const placeName =
                destId && !isCountryOnlyPlaceName(norm.placeName ?? '')
                    ? norm.placeName
                    : destId
                      ? norm.placeName
                      : isCountryOnlyPlaceName(norm.placeName ?? '')
                        ? null
                        : norm.placeName;
            return { ...norm, destinationId: destId, placeName: placeName ?? null };
        });
        return { ...day, dayKey: key || day.dayKey, destinationId, items };
    });
}

const VALID_TRAVEL_MODES = new Set(['flight', 'ground', 'walk']);

export const ITINERARY_TRAVEL_LABELS: Record<string, string> = {
    flight: 'Voo',
    ground: 'Terrestre',
    walk: 'A pé'
};

export function normalizeTravelMode(raw: unknown): TripItineraryItem['travelMode'] {
    const m = String(raw ?? '').trim();
    return VALID_TRAVEL_MODES.has(m) ? (m as TripItineraryItem['travelMode']) : null;
}

export function normalizeItineraryItem(item: Partial<TripItineraryItem> & { id?: string }): TripItineraryItem {
    return {
        id: item.id ?? crypto.randomUUID(),
        title: item.title?.trim() || 'Nova atividade',
        destinationId: item.destinationId ?? null,
        time: item.time ?? null,
        category: item.category ?? 'sight',
        travelMode: normalizeTravelMode(item.travelMode),
        groundTransportId: item.groundTransportId ?? item.ground_transport_id ?? null,
        placeName: String(item.placeName ?? item.place_name ?? '').trim() || null,
        notes: item.notes ?? null,
        highlight: Boolean(item.highlight),
        saved: Boolean(item.saved)
    };
}

/** Locais do mapa filtrados pelo país do dia (ex.: só Espanha no dia na Espanha).
 * Pins sem país definido continuam na lista (ainda não classificados).
 */
export function filterPlannablePlacesByCountry(
    places: TripDestination[],
    countryLabel: string
): TripDestination[] {
    const needle = canonicalCountryLabel(String(countryLabel ?? '').trim());
    if (!needle) return places;
    const key = foldedCountryKey(needle);
    return places.filter((d) => {
        const c = countryLabelForDestination(d, places);
        if (!c) return true;
        return foldedCountryKey(c) === key;
    });
}

/** Tag do dia: só país (local escolhido na atividade, voo ou destino do dia). Vazio se ainda não houver. */
export function journalDayWhereLabel(
    day: TripItineraryDay,
    stops: TripDestination[],
    destinations: TripDestination[]
): string {
    const items = day.items ?? [];
    for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (!it || it.id.startsWith(FLIGHT_ITEM_PREFIX)) continue;
        const linked = resolvePlaceById(it.destinationId, destinations, stops);
        if (linked) {
            const c = countryLabelForDestination(linked, destinations);
            if (c) return c;
        }
    }

    const fromFlights = journalDayCountryFromFlights(day, destinations);
    if (fromFlights) return fromFlights;

    const dayLinked = resolvePlaceById(day.destinationId, destinations, stops);
    if (dayLinked) {
        const c = countryLabelForDestination(dayLinked, destinations);
        if (c) return c;
    }

    return '';
}

/** Cidade representativa quando só há país (bandeira = país, tag = cidade). */
const COUNTRY_CITY_FALLBACK: Record<string, string> = {
    espanha: 'Madri',
    espana: 'Madri',
    spain: 'Madri',
    portugal: 'Lisboa',
    franca: 'Paris',
    france: 'Paris',
    italia: 'Roma',
    italy: 'Roma',
    alemanha: 'Berlim',
    germany: 'Berlim',
    china: 'Pequim',
    japao: 'Tóquio',
    japan: 'Tóquio'
};

export function countryRepresentativeCity(countryLabel: string): string {
    const key = foldedCountryKey(canonicalCountryLabel(countryLabel) || countryLabel);
    return COUNTRY_CITY_FALLBACK[key] ?? '';
}

function shortCityToken(raw: string): string {
    const cleaned = stripAirportCodeLabel(String(raw ?? ''));
    const primary = cleaned.split('/')[0]?.trim();
    return primary || cleaned.trim();
}

export function cityLabelFromDestination(dest: TripDestination): string {
    const fromCity = mapPlaceCityLabel(dest.city ?? dest.neighborhood, dest.country);
    if (fromCity) return shortCityToken(fromCity);

    if (dest.kind === 'airport') {
        const codeName = String(dest.name ?? '')
            .split(/[,/·]/)[0]
            ?.trim();
        if (codeName && codeName.length > 3 && !isCountryOnlyPlaceName(codeName) && !/^[A-Za-z]{3}$/.test(codeName)) {
            return roteiroPlaceTitleCase(codeName);
        }
        const pt = resolveFlightPlace(codeName || String(dest.name ?? ''), [dest]);
        const head = String(pt?.label ?? '')
            .split(/[,/·]/)[0]
            ?.trim();
        if (head && !isCountryOnlyPlaceName(head) && !/^[A-Za-z]{3}$/.test(head)) {
            return roteiroPlaceTitleCase(head);
        }
        return '';
    }

    const nameHead = String(dest.name ?? '')
        .split(/[,/·]/)[0]
        ?.trim();
    if (nameHead && !isCountryOnlyPlaceName(nameHead)) {
        const asCity = mapPlaceCityLabel(nameHead, dest.country);
        if (asCity) return shortCityToken(asCity);
        if (nameHead.length <= 24) return roteiroPlaceTitleCase(nameHead);
    }

    return '';
}

function cityHintFromFlightPlace(place: string, destinations: TripDestination[]): string {
    const raw = place.trim();
    if (!raw || isCountryOnlyPlaceName(raw)) return '';

    const linkedId = destinationIdForFlightPlace(raw, destinations, null);
    if (linkedId) {
        const hit = destinations.find((d) => d.id === linkedId);
        if (hit) {
            const fromDest = cityLabelFromDestination(hit);
            if (fromDest) return fromDest;
        }
    }

    const pt = resolveFlightPlace(raw, destinations);
    if (pt?.label) {
        const head = String(pt.label)
            .split(/[,/·]/)[0]
            ?.trim();
        if (head && !isCountryOnlyPlaceName(head) && !/^[A-Za-z]{3}$/.test(head)) {
            return roteiroPlaceTitleCase(head);
        }
    }

    if (/^[A-Za-z]{3}$/.test(raw)) return '';

    return roteiroPlaceTitleCase(
        stripAirportCodeLabel(raw.split(/[,/]/)[0]?.trim() || raw)
    );
}

function journalDayCityFromFlights(day: TripItineraryDay, destinations: TripDestination[]): string {
    const items = day.items ?? [];
    const flightItems = items.filter((i) => i.id.startsWith(FLIGHT_ITEM_PREFIX));
    if (!flightItems.length) return '';

    const arrivals = flightItems.filter((i) => (i.title ?? '').trim().toLowerCase().startsWith('chegada'));
    if (arrivals.length) {
        const last = arrivals[arrivals.length - 1]!;
        const linked = resolvePlaceById(last.destinationId, destinations, destinations);
        if (linked) {
            const fromDest = cityLabelFromDestination(linked);
            if (fromDest) return fromDest;
        }
        const place = (last.title ?? '').replace(/^chegada\s*·\s*/i, '').trim();
        const fromPlace = cityHintFromFlightPlace(place, destinations);
        if (fromPlace) return fromPlace;
    }

    const voos = flightItems.filter((i) => (i.title ?? '').includes('→'));
    if (!voos.length) return '';
    const sorted = [...voos].sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
    const title = sorted[sorted.length - 1]?.title ?? '';
    const destPart = title.split('→').pop()?.trim().split(/·/)[0]?.trim();
    if (destPart) {
        const destCountry = placeToCountryLabel(destPart, destinations);
        if (destCountry && foldedCountryKey(destCountry) !== foldedCountryKey('Brasil')) {
            const city = cityHintFromFlightPlace(destPart, destinations);
            if (city) return city;
        }
    }
    const depMatch = title.match(/·\s*(.+?)\s*→/);
    const depPart = depMatch?.[1]?.trim();
    return depPart ? cityHintFromFlightPlace(depPart, destinations) : '';
}

/**
 * Cidade do cabeçalho do dia (tag): cidade/local, não o país.
 * A bandeira continua vindo de `journalDayWhereLabel`.
 */
export function journalDayCityLabel(
    day: TripItineraryDay,
    stops: TripDestination[],
    destinations: TripDestination[]
): string {
    const place = resolveUserDayPlace(day, stops, destinations);
    if (place) {
        const fromPlace = cityLabelFromDestination(place);
        if (fromPlace) return fromPlace;
        const raw = stripAirportCodeLabel(String(place.name ?? '').trim());
        if (raw && !isCountryOnlyPlaceName(raw)) {
            return roteiroPlaceTitleCase(raw.split(/[,/·]/)[0]!.trim());
        }
    }

    const fromFlights = journalDayCityFromFlights(day, destinations);
    if (fromFlights) return fromFlights;

    const dayLinked = resolvePlaceById(day.destinationId, destinations, stops);
    if (dayLinked) {
        const fromDay = cityLabelFromDestination(dayLinked);
        if (fromDay) return fromDay;
    }

    // Sem cidade definida no roteiro: tag fica só com a bandeira do país.
    return '';
}

/** Último local “de base” antes de um dia (para sugerir trecho terrestre/voo). */
export function placeAnchorBeforeDay(
    dayId: string,
    itinerary: TripItineraryDay[],
    destinations: TripDestination[],
    stops: TripDestination[]
): TripDestination | null {
    const sorted = sortedItineraryDays(itinerary);
    const idx = sorted.findIndex((d) => d.id === dayId);
    if (idx <= 0) return null;
    for (let i = idx - 1; i >= 0; i--) {
        const p = resolveUserDayPlace(sorted[i]!, stops, destinations);
        if (p) return p;
        const arrival = journalDayFlightArrivalLabel(sorted[i]!, destinations);
        if (arrival) {
            const flightItems = (sorted[i]!.items ?? []).filter((it) => it.id.startsWith(FLIGHT_ITEM_PREFIX));
            for (let j = flightItems.length - 1; j >= 0; j--) {
                const linked = resolvePlaceById(flightItems[j]?.destinationId, destinations, stops);
                if (linked) return linked;
            }
        }
    }
    return null;
}

export function isCountryOnlyPlaceName(label: string): boolean {
    const t = label.trim();
    if (!t) return true;
    // Só país do catálogo — cidades (Xangai, Madri) não contam como «só país».
    return isCountryCatalogLabel(t);
}

/** Locais adicionados no mapa que podem ser ligados às atividades do planner. */
export function mapPlannableDestinations(destinations: TripDestination[]): TripDestination[] {
    return destinations
        .filter(
            (d) =>
                !isCountryOnlyDestination(d) &&
                Number.isFinite(d.latitude) &&
                Number.isFinite(d.longitude)
        )
        .map(normalizeMapDestinationPlace)
        .sort((a, b) => mapPlaceCardTitle(a).localeCompare(mapPlaceCardTitle(b), 'pt-BR'));
}

const CONCRETE_PLACE_KINDS = new Set([
    'city',
    'neighborhood',
    'poi',
    'airport',
    'restaurant',
    'shopping',
    'shop',
    'attraction'
]);

export function isCountryOnlyDestination(dest: TripDestination | null | undefined): boolean {
    if (!dest) return false;
    if (dest.kind === 'country' || dest.kind === 'continent') return true;
    const kind = String(dest.kind ?? '').trim();
    // Cidade/POI concreto nunca é «só país» (evita Xangai→China via alias).
    if (kind && CONCRETE_PLACE_KINDS.has(kind)) return false;
    const name = coerceLatinGeocodeLabel({
        name: dest.name,
        country: dest.country,
        countryCode: undefined
    });
    const country = canonicalCountryLabel(dest.country ?? '');
    if (name && country && foldedCountryKey(name) === foldedCountryKey(country)) return true;
    if (name && isCountryCatalogLabel(name) && (!country || foldedCountryKey(name) === foldedCountryKey(country))) {
        return true;
    }
    return isCountryOnlyPlaceName(activityPlaceLabel(dest));
}

const PT_TITLE_LOWER = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'em', 'na', 'no', 'nas', 'nos']);

export function roteiroPlaceTitleCase(label: string): string {
    return label
        .trim()
        .split(/\s+/)
        .map((word, index) => {
            const lower = word.toLowerCase();
            if (index > 0 && PT_TITLE_LOWER.has(lower)) return lower;
            if (!lower) return '';
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .filter(Boolean)
        .join(' ');
}

/** Rótulo de cidade para cartões (Pequim/Beijing, etc.). */
function isGreatWallChinaDestination(dest: Pick<TripDestination, 'name' | 'country' | 'address'>): boolean {
    const country = canonicalCountryLabel(dest.country ?? '');
    const china =
        country === 'China' ||
        foldAscii(dest.country ?? '') === 'china' ||
        foldAscii(dest.address ?? '').includes('china');
    if (!china) return false;
    const n = foldAscii(dest.name);
    return (
        n.includes('muralha') ||
        n.includes('great wall') ||
        n.includes('wall of china') ||
        n.includes('badaling')
    );
}

function stripTrailingDashCountry(name: string, country?: string | null): string {
    const base = name.trim();
    if (!base || !country) return base;
    const suffix = ` - ${country}`;
    if (base.toLowerCase().endsWith(suffix.toLowerCase())) {
        return base.slice(0, -suffix.length).trim();
    }
    const canon = canonicalCountryLabel(country);
    if (canon && canon !== country) {
        const alt = ` - ${canon}`;
        if (base.toLowerCase().endsWith(alt.toLowerCase())) return base.slice(0, -alt.length).trim();
    }
    return base;
}

/** Corrige locais antigos com cidade/endereço só «China». */
export function normalizeMapDestinationPlace(dest: TripDestination): TripDestination {
    let city = dest.city ?? null;
    let address = dest.address ?? null;
    let country = dest.country ?? null;
    const countryCanon = canonicalCountryLabel(country ?? '') || (isCountryOnlyPlaceName(country ?? '') ? 'China' : '');

    if (city && isCountryOnlyPlaceName(city)) city = null;
    if (address && isCountryOnlyPlaceName(address)) address = null;
    if (!country && countryCanon) country = countryCanon;

    const name = stripTrailingDashCountry(dest.name, countryCanon || country);

    if ((!city || foldAscii(city) === foldAscii(name)) && address) {
        const parent = parentCityFromLatinAddress(address, name);
        if (parent) city = parent;
    }

    if (isGreatWallChinaDestination({ ...dest, name, country: countryCanon || country })) {
        city = city || 'Beijing';
        if (!address) {
            address = `${roteiroPlaceTitleCase(name) || 'Muralha da China'}, Pequim/Beijing, China`;
        }
        if (!country) country = 'China';
    }

    const snapped = snapGreatWallPlace({
        ...dest,
        name,
        city,
        address,
        country: country ?? dest.country
    });
    return {
        ...dest,
        ...snapped,
        name: snapped.name ?? name,
        city: snapped.city ?? city,
        address: snapped.address ?? address,
        country: snapped.country ?? country ?? dest.country,
        latitude: Number(snapped.latitude),
        longitude: Number(snapped.longitude),
        kind: (snapped.kind as TripDestination['kind']) ?? dest.kind
    };
}

export function mapPlaceCityLabel(city: string | null | undefined, country?: string | null): string {
    const raw = String(city ?? '').trim();
    if (!raw) return '';
    if (isCountryOnlyPlaceName(raw)) return '';
    const countryCanon = canonicalCountryLabel(country ?? '');
    if (countryCanon && foldedCountryKey(raw) === foldedCountryKey(countryCanon)) return '';
    const fold = foldAscii(raw);
    if (fold === 'beijing' || fold === 'peking' || fold === 'pequim') return 'Pequim/Beijing';
    if (fold === 'shanghai' || fold === 'xangai') return 'Xangai/Shanghai';
    if (fold === 'guangzhou' || fold === 'cantao' || fold === 'canton') return 'Cantão/Guangzhou';
    if (fold === 'hong kong') return 'Hong Kong';
    if (fold === 'changsha') return 'Changsha';
    return roteiroPlaceTitleCase(raw);
}

function displayCityForPlace(place: TripDestination): string {
    const name = roteiroPlaceTitleCase(place.name);
    let city = mapPlaceCityLabel(place.city ?? place.neighborhood, place.country);
    const nameFold = foldAscii(name);
    if (city && foldAscii(city) === nameFold) city = '';
    if (!city) {
        const parent = parentCityFromLatinAddress(String(place.address ?? ''), place.name);
        if (parent) city = mapPlaceCityLabel(parent, place.country);
    }
    if (
        !city &&
        canonicalCountryLabel(place.country ?? '') === 'China' &&
        (nameFold === 'furong' || nameFold.startsWith('furong '))
    ) {
        city = 'Changsha';
    }
    return city;
}

/** Título do cartão: «Muralha da China - Pequim/Beijing». */
export function mapPlaceCardTitle(dest: TripDestination): string {
    const place = normalizeMapDestinationPlace(dest);
    // Aeroporto na lista/tag: cidade (Madri, Pequim). Código IATA fica só no pin do mapa.
    if (place.kind === 'airport') {
        const fromCity = mapPlaceCityLabel(place.city, place.country) || String(place.city ?? '').trim();
        const head = (fromCity.split('/')[0] || fromCity).trim();
        if (head && !/^[A-Za-z]{3}$/.test(head)) return roteiroPlaceTitleCase(head);
        const stripped = String(place.name ?? '')
            .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
            .split(/[,/·]/)[0]
            ?.trim();
        if (stripped && !/^[A-Za-z]{3}$/.test(stripped)) return roteiroPlaceTitleCase(stripped);
        return roteiroPlaceTitleCase(head || stripped || place.name || 'Aeroporto');
    }
    const baseName = stripTrailingDashCountry(
        coerceLatinGeocodeLabel({
            name: place.name,
            country: place.country ?? undefined,
            countryCode: undefined
        }) || place.name,
        place.country
    );
    const name = roteiroPlaceTitleCase(baseName);
    let city = displayCityForPlace(place);
    if (!city && canonicalCountryLabel(place.country ?? '') === 'China') {
        const n = foldAscii(place.name);
        if (n.includes('muralha') || n.includes('great wall') || n.includes('wall of china')) {
            city = 'Pequim/Beijing';
        }
    }
    if (city && foldAscii(city) !== foldAscii(name)) return `${name} - ${city}`;
    return name || activityPlaceLabel(dest);
}

/** Endereço completo para sublinha (modal / lista). */
export function mapPlaceCardAddress(dest: TripDestination): string {
    const normalized = normalizeMapDestinationPlace(dest);
    const raw = String(normalized.address ?? '').trim();
    const country = canonicalCountryLabel(normalized.country ?? '');
    if (raw && !isCountryOnlyPlaceName(raw)) {
        const parts = raw
            .split(/[,;·]/)
            .map((s) => s.trim())
            .filter((s) => s && !isCountryOnlyPlaceName(s));
        if (parts.length) return parts.join(', ');
    }
    const city = mapPlaceCityLabel(normalized.city ?? normalized.neighborhood, normalized.country);
    const name = roteiroPlaceTitleCase(stripTrailingDashCountry(normalized.name, normalized.country));
    if (isGreatWallChinaDestination(normalized) && !raw) {
        return `${name || 'Muralha da China'}, Pequim/Beijing${country ? `, ${country}` : ''}`;
    }
    const bits = [name, city, country].filter((s) => s && String(s).trim());
    const out: string[] = [];
    for (const b of bits) {
        const t = String(b).trim();
        if (!t || isCountryOnlyPlaceName(t)) continue;
        if (out.some((x) => foldedCountryKey(x) === foldedCountryKey(t))) continue;
        out.push(t);
    }
    return out.length >= 2 ? out.join(', ') : '';
}

function resolveGeocodeCity(hit: GeocodeHit, searchQuery: string): string | null {
    const query = searchQuery.trim();
    const country = countryDisplayName(hit.country, hit.countryCode);
    const display = geocodeHitDisplayLabel(hit, query);

    const placeName = geocodeHitDisplayLabel(hit, query).title || hit.name;
    const direct = String(hit.city ?? '').trim();
  const directFold = foldAscii(direct);
  const nameFold = foldAscii(placeName);
    if (
        direct &&
        isLatinUiText(direct) &&
        !isCountryOnlyPlaceName(direct) &&
        (!country || foldedCountryKey(direct) !== foldedCountryKey(country)) &&
        directFold !== nameFold &&
        !(nameFold.length >= 3 && directFold.includes(nameFold))
    ) {
        return direct;
    }

    const addr = String(hit.address ?? '');
    for (const part of addr.split(/[,;·]/).map((s) => s.trim()).filter(Boolean)) {
        if (!isLatinUiText(part) || isCountryOnlyPlaceName(part)) continue;
        if (country && foldedCountryKey(part) === foldedCountryKey(country)) continue;
        if (display.title && foldedCountryKey(part) === foldedCountryKey(display.title)) continue;
        if (/^(great wall|muralha|china|chinese)$/i.test(foldAscii(part))) continue;
        return part;
    }

    for (const seg of String(display.subtitle ?? '')
        .split('·')
        .map((s) => s.trim())
        .filter(Boolean)) {
        if (!isLatinUiText(seg) || isCountryOnlyPlaceName(seg)) continue;
        if (country && foldedCountryKey(seg) === foldedCountryKey(country)) continue;
        return seg;
    }

    const q = foldAscii(query);
    if (
        country === 'China' &&
        (q.includes('muralha') || q.includes('great wall') || q.includes('wall'))
    ) {
        return 'Beijing';
    }

    return null;
}

function resolveGeocodeAddressLine(
    hit: GeocodeHit,
    searchQuery: string,
    placeName: string,
    city: string | null
): string | null {
    const country = countryDisplayName(hit.country, hit.countryCode);
    const raw = String(hit.address ?? '').trim();
    const picked = pickAddressDisplayLine({
        displayName: raw,
        countryCode: hit.countryCode,
        countryName: hit.country
    });

    const candidates: string[] = [];
    if (picked && !isCountryOnlyPlaceName(picked) && picked.length > 8) candidates.push(picked);
    if (raw && !isCountryOnlyPlaceName(raw) && raw.length > 8) candidates.push(raw);

    const cityLabel = city ? mapPlaceCityLabel(city, country) || city : '';
    const composed = [placeName, cityLabel, country]
        .map((s) => String(s ?? '').trim())
        .filter((s) => s && !isCountryOnlyPlaceName(s));

    const seen = new Set<string>();
    const out: string[] = [];
    for (const chunk of [...candidates, composed.join(', ')]) {
        for (const part of chunk.split(/[,;·]/).map((s) => s.trim()).filter(Boolean)) {
            if (!part || isCountryOnlyPlaceName(part)) continue;
            const key = foldedCountryKey(part);
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(part);
        }
    }

    if (out.length >= 2) return out.join(', ');
    return out.length === 1 && !isCountryOnlyPlaceName(out[0]!) ? out[0]! : null;
}

export function activityPlaceLabel(dest: TripDestination): string {
    const country = canonicalCountryLabel(dest.country ?? '');
    const name = coerceLatinGeocodeLabel({
        name: dest.name,
        country: dest.country,
        countryCode: undefined
    });
    if (dest.kind === 'airport') {
        const code = name.length <= 4 ? name : name.split(/\s+/)[0];
        return country ? `${country} · ${code}` : code;
    }
    if (name && country && foldedCountryKey(name) !== foldedCountryKey(country)) {
        return `${name} · ${country}`;
    }
    return name || country || '—';
}

export function placeKindLabel(dest: TripDestination): string {
    const k = (dest.kind ?? '').toString();
    if (k && PLACE_KIND_LABELS[k]) return PLACE_KIND_LABELS[k];
    if (dest.neighborhood?.trim()) return PLACE_KIND_LABELS.neighborhood;
    return PLACE_KIND_LABELS.city;
}

export function inferPlaceKind(hit: GeocodeHit): string {
    const k = (hit.kind ?? '').trim();
    if (k && k !== 'poi') return k;
    const name = hit.name.toLowerCase();
    if (name.includes('aeroporto') || name.includes('airport')) return 'airport';
    if (hit.country && hit.name === hit.country) return 'country';
    if (k) return k;
    return 'city';
}

export function destinationFromGeocode(hit: GeocodeHit, searchQuery = ''): TripDestination {
    const country = countryDisplayName(hit.country, hit.countryCode);
  const query = searchQuery.trim();
    const display = geocodeHitDisplayLabel(hit, query);
    let name =
        display.title && !isCountryOnlyPlaceName(display.title)
            ? display.title
            : coerceLatinGeocodeLabel(hit, query);
    if (!name || isCountryOnlyPlaceName(name)) {
        name = display.title || coerceLatinGeocodeLabel(hit, query) || query;
    }
    if (
        country &&
        name &&
        foldedCountryKey(name) === foldedCountryKey(country) &&
        hit.city &&
        foldedCountryKey(hit.city) !== foldedCountryKey(country)
    ) {
        name = coerceLatinGeocodeLabel({ ...hit, name: hit.city }, query);
    }
    if (isCountryOnlyPlaceName(name) && display.title && !isCountryOnlyPlaceName(display.title)) {
        name = display.title;
    }

    const apiKind = String(hit.kind ?? '').trim();
    let kind = apiKind && apiKind !== 'country' ? apiKind : inferPlaceKind(hit);
    if (kind === 'city' && apiKind && apiKind !== 'city') kind = apiKind;

    const cityResolved = resolveGeocodeCity(hit, query);
    let city = cityResolved
        ? coerceLatinGeocodeLabel({ ...hit, name: cityResolved }, query) || cityResolved
        : null;
    if (city && isCountryOnlyPlaceName(city)) city = null;
    let address = resolveGeocodeAddressLine(hit, query, name, city);
    if (isGreatWallChinaDestination({ name, country, address: address ?? undefined })) {
        city = city || 'Beijing';
        if (!address || isCountryOnlyPlaceName(address)) {
            address = `${roteiroPlaceTitleCase(name) || 'Muralha da China'}, Pequim/Beijing, China`;
        }
    }

    const snapped = snapGreatWallPlace({
        name,
        country,
        city,
        address,
        latitude: hit.latitude,
        longitude: hit.longitude,
        kind
    });

    return {
        id: crypto.randomUUID(),
        name: snapped.name || name,
        country: snapped.country || country || undefined,
        city: snapped.city ?? city,
        address: snapped.address ?? address,
        latitude: Number(snapped.latitude),
        longitude: Number(snapped.longitude),
        kind: (snapped.kind as TripDestination['kind']) || kind,
        guideHighlights: [],
        guideAlerts: []
    };
}

export function roteiroStats(
    destinations: TripDestination[],
    itinerary: TripItineraryDay[],
    startsOn: string,
    endsOn: string
) {
    const stops = orderedStops(destinations);
    const countries = new Set(stops.map((d) => (d.country ?? '').trim()).filter(Boolean));
    let activityCount = 0;
    let highlightCount = 0;
    for (const day of itinerary) {
        for (const item of day.items ?? []) {
            activityCount += 1;
            if (item.highlight) highlightCount += 1;
        }
    }
    const tripDays =
        startsOn && endsOn
            ? Math.max(0, (itineraryDays(startsOn, endsOn, []) as TripItineraryDay[]).length)
            : itinerary.length;
    return {
        stops: stops.length,
        countries: countries.size,
        tripDays,
        activityCount,
        highlightCount
    };
}

export function itineraryMatchesTrip(
    startsOn: string,
    endsOn: string,
    itinerary: TripItineraryDay[]
): boolean {
    const start = (startsOn ?? '').trim();
    const end = (endsOn ?? '').trim();
    if (!start || !end) return itinerary.length === 0;
    const expected = itineraryDays(start, end, []) as TripItineraryDay[];
    if (expected.length === 0) return true;
    if (itinerary.length !== expected.length) return false;
    return expected.every((exp, i) => dayKeyOf(itinerary[i] ?? {}) === dayKeyOf(exp));
}

export function formatTripPeriod(startsOn: string, endsOn: string): string {
    const a = (startsOn ?? '').trim();
    const b = (endsOn ?? '').trim();
    const fa = a ? formatDayLabel(a) : null;
    const fb = b ? formatDayLabel(b) : null;
    if (fa && fb) return `${fa.short} – ${fb.short}`;
    if (fa) return fa.long;
    if (fb) return fb.long;
    return '';
}

function timeFromFlightStamp(raw?: string | null): string | null {
    return flightStampParts(raw)?.time ?? null;
}

/** Dia do carimbo local do voo (mesmo critério do horário exibido). */
function dayKeyFromFlightStamp(raw?: string | null): string | null {
    const local = toDatetimeLocal(raw);
    if (local && /^\d{4}-\d{2}-\d{2}/.test(local)) {
        const key = local.slice(0, 10);
        return hopDayKey(key);
    }
    return hopDayKey(raw);
}

function foldPlaceLabel(s: string): string {
    return String(s ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .trim();
}

function destinationMatchesFlightPlace(dest: TripDestination, place: string): boolean {
    const raw = place.trim();
    if (!raw || !Number.isFinite(dest.latitude) || !Number.isFinite(dest.longitude)) return false;
    const pt = resolveFlightPlace(raw, [dest]);
    if (!pt) return false;
    return Math.abs(dest.latitude - pt.lat) < 0.14 && Math.abs(dest.longitude - pt.lng) < 0.14;
}

/** Liga voo confirmado ao destino certo (MAD, Madrid…) — não usa `tripDestinationId` genérico da ficha. */
function destinationIdForFlightPlace(
    place: string | null | undefined,
    destinations: TripDestination[],
    tripDestinationId?: string | null
): string | null {
    const raw = (place ?? '').trim();
    if (!raw) return null;
    const pt = resolveFlightPlace(raw, destinations);
    const eps = 0.1;
    if (pt) {
        const byCoord = destinations.find(
            (d) =>
                Number.isFinite(d.latitude) &&
                Number.isFinite(d.longitude) &&
                Math.abs(d.latitude - pt.lat) < eps &&
                Math.abs(d.longitude - pt.lng) < eps
        );
        if (byCoord && byCoord.kind !== 'country') return byCoord.id;
    }
    const iata = extractIata(raw);
    if (iata) {
        const byIata = destinations.find(
            (d) =>
                d.kind !== 'country' &&
                (extractIata(d.name ?? '') === iata ||
                    foldPlaceLabel(d.name).includes(iata.toLowerCase()))
        );
        if (byIata) return byIata.id;
    }
  const f = foldPlaceLabel(raw);
    const byName = destinations.find((d) => {
        if (d.kind === 'country') return false;
        const n = foldPlaceLabel(d.name ?? '');
        return n === f || n.includes(f) || f.includes(n);
    });
    if (byName && destinationMatchesFlightPlace(byName, raw)) return byName.id;
    if (tripDestinationId) {
        const linked = destinations.find((d) => d.id === tripDestinationId);
        if (linked && linked.kind !== 'country' && destinationMatchesFlightPlace(linked, raw)) {
            return tripDestinationId;
        }
    }
    return null;
}

function ephemeralFlightDestination(place: string, destinations: TripDestination[]): TripDestination | null {
    const raw = place.trim();
    if (!raw) return null;
    const pt = resolveFlightPlace(raw, destinations);
    if (!pt) return null;
    if (isHomeDestination({ name: pt.label ?? raw } as TripDestination)) return null;
    const code = extractIata(raw) ?? extractIata(pt.label ?? '') ?? '';
    const slug = code || foldPlaceLabel(raw).replace(/\s+/g, '-');
    return {
        id: `rote-flight-${slug}`,
        name: pt.label || raw,
        kind: 'airport',
        latitude: pt.lat,
        longitude: pt.lng,
        country: countryNameFromPlace(raw) || undefined,
        guideHighlights: [],
        guideAlerts: []
    };
}

function resolveFlightArrivalDestination(
    item: TripItineraryItem,
    destinations: TripDestination[],
    fallbackStops: TripDestination[]
): TripDestination | null {
    const place = (item.title ?? '').replace(/^chegada\s*·\s*/i, '').trim();
    const catalog = [...destinations, ...fallbackStops];
    if (place) {
        if (isHomeDestination({ name: place } as TripDestination)) return null;
        const id = destinationIdForFlightPlace(place, catalog, item.destinationId);
        if (id) {
            const hit = catalog.find((d) => d.id === id);
            if (hit && hit.kind !== 'country') return hit;
        }
        const ephemeral = ephemeralFlightDestination(place, catalog);
        if (ephemeral) return ephemeral;
    }
    const linked = resolvePlaceById(item.destinationId, destinations, fallbackStops);
    if (linked && linked.kind !== 'country') {
        if (!place || destinationMatchesFlightPlace(linked, place)) return linked;
    }
    return null;
}

function upsertFlightItem(
    items: TripItineraryItem[],
    next: TripItineraryItem,
    archivedPrev?: TripItineraryItem
): TripItineraryItem[] {
    const idx = items.findIndex((i) => i.id === next.id);
    const prev = idx >= 0 ? items[idx] : archivedPrev;
    if (!prev) return [...items, normalizeItineraryItem(next)];
    const title = (prev.title ?? '').trim();
    const autoTitle =
        !title ||
        title.startsWith('Voo') ||
        title.startsWith('Chegada') ||
        prev.id.startsWith(FLIGHT_ITEM_PREFIX);
    const prevNotes = (prev.notes ?? '').trim();
    const staleFlightNote = /^voo confirmado$/i.test(prevNotes);
    const notes =
        prevNotes && !staleFlightNote
            ? prev.notes
            : (next.notes ?? (staleFlightNote ? null : prev.notes ?? null));
    const merged = normalizeItineraryItem({
        ...prev,
        ...next,
        time: next.time ?? prev.time ?? null,
        category: 'transport',
        notes,
        highlight: prev.highlight || Boolean(next.highlight),
        title: autoTitle ? next.title : prev.title,
        destinationId: next.destinationId ?? prev.destinationId ?? null,
        placeName: next.placeName ?? prev.placeName ?? null,
        travelMode: next.travelMode ?? prev.travelMode ?? 'flight'
    });
    if (idx < 0) return [...items, merged];
    return items.map((it, i) => (i === idx ? merged : it));
}

/** Injeta voos com status `escolhida` como atividades nos dias/horários corretos. */
export function mergeChosenFlightsIntoItinerary(
    days: TripItineraryDay[],
    segments: TripFlightSegment[],
    destinations: TripDestination[] = []
): TripItineraryDay[] {
    const chosen = (segments ?? [])
        .flatMap((s) => s.simulations ?? [])
        .filter((sim) => sim?.status === 'escolhida');
    if (!chosen.length) return days;

    const byDay = new Map<string, TripItineraryItem[]>();
    const queue = (dayKey: string, item: TripItineraryItem) => {
        const list = byDay.get(dayKey) ?? [];
        list.push(item);
        byDay.set(dayKey, list);
    };

    for (const sim of chosen) {
        const route = `${sim.origin?.trim() || '?'} → ${sim.destination?.trim() || '?'}`;
        const arriveDestId = destinationIdForFlightPlace(
            sim.destination,
            destinations,
            sim.tripDestinationId
        );
        const departDestId = destinationIdForFlightPlace(sim.origin, destinations, null);
        const originName = sim.origin?.trim() || null;
        const destName = sim.destination?.trim() || null;

        const depKey = dayKeyFromFlightStamp(sim.departsAt);
        if (depKey) {
            queue(depKey, {
                id: `${FLIGHT_ITEM_PREFIX}${sim.id}-ida-partida`,
                title: `Voo · ${route}`,
                time: timeFromFlightStamp(sim.departsAt),
                category: 'transport',
                notes: null,
                highlight: true,
                destinationId: departDestId,
                placeName: originName,
                travelMode: 'flight'
            });
        }
        const arrKey = dayKeyFromFlightStamp(sim.arrivesAt);
        if (arrKey) {
            queue(arrKey, {
                id: `${FLIGHT_ITEM_PREFIX}${sim.id}-ida-chegada`,
                title: `Chegada · ${destName || 'destino'}`,
                time: timeFromFlightStamp(sim.arrivesAt),
                category: 'transport',
                notes: null,
                highlight: false,
                destinationId: arriveDestId,
                placeName: destName,
                travelMode: 'flight'
            });
        }

        if (sim.returnDepartsAt || sim.returnArrivesAt) {
            const retRoute = `${sim.destination?.trim() || '?'} → ${sim.origin?.trim() || '?'}`;
            const retDepKey = dayKeyFromFlightStamp(sim.returnDepartsAt);
            if (retDepKey) {
                queue(retDepKey, {
                    id: `${FLIGHT_ITEM_PREFIX}${sim.id}-volta-partida`,
                    title: `Voo volta · ${retRoute}`,
                    time: timeFromFlightStamp(sim.returnDepartsAt),
                    category: 'transport',
                    notes: null,
                    highlight: true,
                    destinationId: arriveDestId,
                    placeName: destName,
                    travelMode: 'flight'
                });
            }
            const retArrKey = dayKeyFromFlightStamp(sim.returnArrivesAt);
            if (retArrKey) {
                queue(retArrKey, {
                    id: `${FLIGHT_ITEM_PREFIX}${sim.id}-volta-chegada`,
                    title: `Chegada · ${originName || 'origem'}`,
                    time: timeFromFlightStamp(sim.returnArrivesAt),
                    category: 'transport',
                    notes: null,
                    highlight: false,
                    destinationId: departDestId,
                    placeName: originName,
                    travelMode: 'flight'
                });
            }
        }
    }

    // Tira chegadas/partidas auto de todos os dias e reinsere só nas datas certas
    // (senão a chegada antiga fica no dia errado + a nova no dia certo).
    return applyManagedFlightInjections(days, byDay, {
        dayKeyOf,
        upsert: (items, next, archived) =>
            upsertFlightItem(items as TripItineraryItem[], next as TripItineraryItem, archived as TripItineraryItem | undefined)
    }) as TripItineraryDay[];
}

/**
 * Injeta «Trabalho remoto» nos dias remotos do cenário, no horário local
 * equivalente a 09:00–18:00 Recife. Editável (não trava como voo).
 */
export function mergeRemoteWorkIntoItinerary(
    days: TripItineraryDay[],
    remoteDayKeys: Set<string>,
    destinations: TripDestination[] = [],
    stops: TripDestination[] = []
): TripItineraryDay[] {
    if (!remoteDayKeys.size && !days.some((d) => (d.items ?? []).some((i) => isRemoteItineraryItem(i)))) {
        return days;
    }
    const catalogStops = stops.length ? stops : orderedStops(destinations);

    return days.map((day) => {
        const key = dayKeyOf(day);
        let items = [...(day.items ?? [])];
        const remoteId = `${REMOTE_ITEM_PREFIX}${key}`;

        if (!remoteDayKeys.has(key)) {
            const nextItems = items.filter(
                (i) => !String(i.id ?? '').startsWith(REMOTE_ITEM_PREFIX)
            );
            if (nextItems.length === items.length) return day;
            return { ...day, items: nextItems };
        }

        // Preserva edição do usuário (horário, título, notas, saved).
        if (items.some((i) => i.id === remoteId || isRemoteItineraryItem(i))) {
            return day;
        }

        const country = journalDayWhereLabel(day, catalogStops, destinations);
        const city = journalDayCityLabel(day, catalogStops, destinations);
        const localTz =
            guessTimeZoneForCountry(city) ||
            guessTimeZoneForCountry(country) ||
            TRIP_DIARY_HOME_TZ;
        const startLocal = convertLocalHmToZoneDetail(
            REMOTE_WORK_START,
            TRIP_DIARY_HOME_TZ,
            key,
            localTz
        );
        const endLocal = convertLocalHmToZoneDetail(
            REMOTE_WORK_END,
            TRIP_DIARY_HOME_TZ,
            key,
            localTz
        );
        const time = startLocal?.hm ?? REMOTE_WORK_START;
        const endHm = endLocal?.hm ?? REMOTE_WORK_END;
        const localSpan = `${time}–${endHm}`;
        const notes = remoteScheduleNotes(localSpan, localTz);

        items.push(
            normalizeItineraryItem({
                id: remoteId,
                title: 'Trabalho remoto',
                time,
                category: 'remote',
                notes,
                highlight: false,
                saved: false
            })
        );
        items.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
        return { ...day, items };
    });
}

const AUTO_HOLIDAY_NOTE_RE = /^Feriado BR ·/i;

function remoteScheduleNotes(localSpan: string, localTz: string): string {
    if (localTz === TRIP_DIARY_HOME_TZ) {
        return `${REMOTE_WORK_START}–${REMOTE_WORK_END} Recife`;
    }
    return `${localSpan} local · ${REMOTE_WORK_START}–${REMOTE_WORK_END} Recife`;
}

function dayLocalWorkWindow(
    day: TripItineraryDay,
    catalogStops: TripDestination[],
    destinations: TripDestination[]
): { time: string; endHm: string; localSpan: string; localTz: string } {
    const key = dayKeyOf(day);
    const country = journalDayWhereLabel(day, catalogStops, destinations);
    const city = journalDayCityLabel(day, catalogStops, destinations);
    const localTz =
        guessTimeZoneForCountry(city) ||
        guessTimeZoneForCountry(country) ||
        TRIP_DIARY_HOME_TZ;
    const startLocal = convertLocalHmToZoneDetail(
        REMOTE_WORK_START,
        TRIP_DIARY_HOME_TZ,
        key,
        localTz
    );
    const endLocal = convertLocalHmToZoneDetail(
        REMOTE_WORK_END,
        TRIP_DIARY_HOME_TZ,
        key,
        localTz
    );
    const time = startLocal?.hm ?? REMOTE_WORK_START;
    const endHm = endLocal?.hm ?? REMOTE_WORK_END;
    return { time, endHm, localSpan: `${time}–${endHm}`, localTz };
}

/**
 * Nos dias de feriado BR: remove o Remoto (não acontece) e grava aviso no dia
 * (`day.notes`) para um bloco sutil no planner — sem atividade/categoria nova.
 */
export function mergeHolidayLeaveIntoItinerary(
    days: TripItineraryDay[],
    holidayByDay: Map<string, string>,
    destinations: TripDestination[] = [],
    stops: TripDestination[] = []
): TripItineraryDay[] {
    const hasHolidayItems = days.some((d) => (d.items ?? []).some((i) => isHolidayLeaveItem(i)));
    const hasHolidayDayNotes = days.some((d) => AUTO_HOLIDAY_NOTE_RE.test(String(d.notes ?? '')));
    const hasHolidayRemoteNotes = days.some((d) =>
        (d.items ?? []).some(
            (i) => isRemoteItineraryItem(i) && AUTO_HOLIDAY_NOTE_RE.test(String(i.notes ?? ''))
        )
    );
    if (!holidayByDay.size && !hasHolidayItems && !hasHolidayDayNotes && !hasHolidayRemoteNotes) {
        return days;
    }
    const catalogStops = stops.length ? stops : orderedStops(destinations);

    return days.map((day) => {
        const key = dayKeyOf(day);
        let items = [...(day.items ?? [])];
        const holidayName = holidayByDay.get(key);

        // Remove atividades automáticas de feriado (legado Folga / Dia livre).
        items = items.filter(
            (i) =>
                !isHolidayLeaveItem(i) &&
                String(i.category ?? '') !== 'holiday' &&
                !(
                    String(i.category ?? '') === 'note' &&
                    (/^folga\b/i.test(String(i.title ?? '')) ||
                        /^dia livre$/i.test(String(i.title ?? '').trim()))
                )
        );

        if (!holidayName) {
            // Limpa aviso automático do dia; restaura notes do remoto se era feriado.
            const prevNotes = String(day.notes ?? '').trim();
            const dayNotes = AUTO_HOLIDAY_NOTE_RE.test(prevNotes) ? null : day.notes ?? null;
            items = items.map((i) => {
                if (!isRemoteItineraryItem(i)) return i;
                if (!AUTO_HOLIDAY_NOTE_RE.test(String(i.notes ?? ''))) return i;
                if (i.saved) return i;
                const win = dayLocalWorkWindow(day, catalogStops, destinations);
                return normalizeItineraryItem({
                    ...i,
                    notes: remoteScheduleNotes(win.localSpan, win.localTz)
                });
            });
            return { ...day, items, notes: dayNotes };
        }

        // Feriado: sem remoto (não acontece).
        items = items.filter((i) => !String(i.id ?? '').startsWith(REMOTE_ITEM_PREFIX));

        const win = dayLocalWorkWindow(day, catalogStops, destinations);
        const aviso = holidayLeaveNotes(holidayName, win.localSpan, win.localTz);
        const prevNotes = String(day.notes ?? '').trim();
        const dayNotes =
            !prevNotes || AUTO_HOLIDAY_NOTE_RE.test(prevNotes) ? aviso : prevNotes;

        return { ...day, items, notes: dayNotes };
    });
}

export type DayHolidayNotice = {
    name: string;
    schedule: string;
};

/** Aviso de feriado BR gravado no dia (bloco sutil no planner). */
export function dayHolidayNotice(day: TripItineraryDay | null | undefined): DayHolidayNotice | null {
    const notes = String(day?.notes ?? '').trim();
    if (!AUTO_HOLIDAY_NOTE_RE.test(notes)) return null;
    const parts = notes
        .replace(/^Feriado BR ·\s*/i, '')
        .replace(/\s*\(sem remoto\)\s*$/i, '')
        .split(/\s·\s/)
        .map((s) => s.trim())
        .filter(Boolean);
    const name = parts[0] || 'Feriado';
    const schedule = parts.slice(1).join(' · ');
    return { name, schedule };
}

/** Tira sufixo de aeroporto «Pequim (PEK)» → «Pequim». */
export function stripAirportCodeLabel(raw: string): string {
    return String(raw ?? '')
        .replace(/\s*\(([A-Za-z]{3})\)\s*$/g, '')
        .trim();
}

/** Destino/cidade do dia a partir da hospedagem escolhida (nunca grava só o país). */
export function dayPlaceFieldsFromStay(
    stay: TripStay | null | undefined,
    destinations: TripDestination[] = []
): { destinationId: string | null; placeName: string | null } {
    if (!stay) return { destinationId: null, placeName: null };

    const destinationId = matchDestinationIdForStay(stay, destinations);
    const matched = destinationId
        ? destinations.find((d) => d.id === destinationId && !isCountryOnlyDestination(d)) ?? null
        : null;

    let placeName =
        stripAirportCodeLabel(String(stay.city ?? '').trim()) ||
        (matched ? cityLabelFromDestination(matched) : '') ||
        stripAirportCodeLabel(String(stay.name ?? '').trim()) ||
        '';

    if (placeName && isCountryOnlyPlaceName(placeName)) {
        placeName = countryRepresentativeCity(placeName);
    }

    // Não usar nome genérico «Hospedagem 1» como cidade do dia.
    if (placeName && /^hospedagem(\s+\d+)?$/i.test(placeName)) {
        placeName = matched ? cityLabelFromDestination(matched) : '';
    }

    return {
        destinationId,
        placeName: placeName || null
    };
}

/** Usuário marcou explicitamente que não terá hospedagem neste dia. */
export function isDayStayDeclined(day: TripItineraryDay): boolean {
    return Boolean(day.stayIdManual) && !day.stayId;
}

/**
 * Banner de hospedagem abaixo do header do dia.
 * Esconde só em dia de deslocamento puro (ex. dia 1 só com voo),
 * sem stay escolhida/sugerida e sem recusa explícita.
 */
export function shouldShowDayStayBanner(day: TripItineraryDay, stays: TripStay[]): boolean {
    if (isDayStayDeclined(day)) return true;
    const catalog = stays ?? [];
    if (day.stayId && catalog.some((s) => s.id === day.stayId)) return true;
    const key = dayKeyOf(day);
    if (key && suggestStayForDayKey(catalog, key)) return true;
    const items = day.items ?? [];
    return items.some(
        (i) => !String(i.id ?? '').startsWith(FLIGHT_ITEM_PREFIX) && !isHolidayLeaveItem(i)
    );
}

/**
 * Sugere hospedagem do dia pelos check-in/out cadastrados (opcional; não sobrescreve escolha manual).
 * Também puxa destino/cidade da hospedagem para o dia quando ainda estiver vazio.
 */
export function mergeDayStayBasesIntoItinerary(
    days: TripItineraryDay[],
    stays: TripStay[] = [],
    destinations: TripDestination[] = []
): TripItineraryDay[] {
    if (!days.length) return days;
    const catalog = stays ?? [];
    let changed = false;
    const next = days.map((day) => {
        const key = dayKeyOf(day);
        if (day.stayIdManual) {
            // Se o stay sumiu do cadastro, limpa referência órfã.
            if (day.stayId && !catalog.some((s) => s.id === day.stayId)) {
                changed = true;
                return { ...day, stayId: null };
            }
            const manualStay = day.stayId ? catalog.find((s) => s.id === day.stayId) : null;
            if (!manualStay) return day;
            const place = dayPlaceFieldsFromStay(manualStay, destinations);
            // Preferência da hospedagem: corrige dia que herdou destino errado (ex. Madri).
            const nextDest = place.destinationId || day.destinationId || null;
            const nextPlace =
                place.placeName || String(day.placeName ?? day.place_name ?? '').trim() || null;
            if (nextDest === (day.destinationId ?? null) && nextPlace === (day.placeName ?? null)) {
                return day;
            }
            changed = true;
            return { ...day, destinationId: nextDest, placeName: nextPlace };
        }
        const suggested = key ? suggestStayForDayKey(catalog, key) : null;
        const nextId = suggested?.id ?? null;
        const stay = nextId ? catalog.find((s) => s.id === nextId) ?? null : null;
        const place = dayPlaceFieldsFromStay(stay, destinations);
        const nextDest = place.destinationId || day.destinationId || null;
        const nextPlace =
            place.placeName || String(day.placeName ?? day.place_name ?? '').trim() || null;
        if (
            (day.stayId ?? null) === nextId &&
            (day.destinationId ?? null) === nextDest &&
            (day.placeName ?? null) === nextPlace
        ) {
            return day;
        }
        changed = true;
        return {
            ...day,
            stayId: nextId,
            stayIdManual: false,
            destinationId: nextDest,
            placeName: nextPlace
        };
    });
    return changed ? next : days;
}

export function destinationCoords(
    dest: TripDestination | null | undefined
): { lat: number; lng: number } | null {
    if (!dest) return null;
    const lat = Number(dest.latitude);
    const lng = Number(dest.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

export type StayDistanceHint = {
    km: number;
    label: string;
    walkMin: number | null;
    driveMin: number | null;
    flightMin: number | null;
};

/** Distância hospedagem → local (haversine + estimativas por modo). */
export function stayDistanceToPoint(
    stay: TripStay | null | undefined,
    point: { lat: number; lng: number } | null | undefined
): StayDistanceHint | null {
    const from = stayLatLng(stay);
    if (!from || !point) return null;
    const km = haversineKm(from.lat, from.lng, point.lat, point.lng);
    if (km == null || !Number.isFinite(km)) return null;
    const walkMin = Math.max(1, Math.round((km / 4.5) * 60));
    const driveSpeed = km <= 12 ? 22 : km <= 40 ? 45 : 70;
    const driveMin = Math.max(1, Math.round((km / driveSpeed) * 60));
    const flightMin = Math.max(1, Math.round((km / 750) * 60) + (km < 1500 ? 40 : 25));
    const label =
        km < 1 ? `${Math.round(km * 1000)} m` : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
    return { km, label, walkMin, driveMin, flightMin };
}

/** Tempo de trajeto conforme o transporte escolhido no roteiro. */
export function stayTravelTimeSuffix(
    hint: StayDistanceHint,
    travelMode: TripItineraryItem['travelMode'] | null | undefined
): string {
    const mode = normalizeTravelMode(travelMode);
    if (mode === 'walk' && hint.walkMin != null) return ` · ~${hint.walkMin} min a pé`;
    if (mode === 'ground' && hint.driveMin != null) return ` · ~${hint.driveMin} min de carro`;
    if (mode === 'flight' && hint.flightMin != null) return ` · ~${hint.flightMin} min de voo`;
    if (hint.walkMin != null && hint.km <= 6) return ` · ~${hint.walkMin} min a pé`;
    if (hint.driveMin != null) return ` · ~${hint.driveMin} min de carro`;
    return '';
}

export function stayAsMapDestination(stay: TripStay): TripDestination | null {
    const pt = stayLatLng(stay);
    if (!pt) return null;
    const title = stayDisplayTitle(stay) || 'Hospedagem';
    return {
        id: `rote-stay-${stay.id}`,
        name: title,
        country: stay.country ?? '',
        city: stay.city ?? null,
        address: stay.address ?? null,
        latitude: pt.lat,
        longitude: pt.lng,
        kind: 'lodging',
        guideHighlights: [],
        guideAlerts: []
    };
}

export function itineraryItemsSignature(days: TripItineraryDay[]): string {
    return days
        .map((d) => {
            const key = dayKeyOf(d);
            const items = (d.items ?? [])
                .map(
                    (i) =>
                        `${i.id}:${i.time ?? ''}:${i.title}:${i.category ?? ''}:${i.destinationId ?? ''}:${i.placeName ?? ''}:${i.travelMode ?? ''}:${i.groundTransportId ?? ''}:${i.saved ? '1' : '0'}`
                )
                .join('|');
            return `${key}@${d.destinationId ?? ''}:${d.saved ? '1' : '0'}:${d.notes ?? ''}:${d.stayId ?? ''}:${d.stayIdManual ? '1' : '0'}#${items}`;
        })
        .join(';');
}

/** Paradas do mapa na ordem cronológica do roteiro (dias + atividades). */
export function orderedTimelineDestinations(
    itinerary: TripItineraryDay[],
    destinations: TripDestination[],
    fallbackStops: TripDestination[]
): TripDestination[] {
    const byId = new Map<string, TripDestination>();
    for (const d of destinations) byId.set(d.id, normalizeMapDestinationPlace(d));
    for (const d of fallbackStops) {
        if (!byId.has(d.id)) byId.set(d.id, normalizeMapDestinationPlace(d));
    }

    const ordered: TripDestination[] = [];
    const seen = new Set<string>();
    const sorted = sortedItineraryDays(itinerary);

    const pushDest = (dest: TripDestination | null | undefined) => {
        if (!dest || !Number.isFinite(dest.latitude) || !Number.isFinite(dest.longitude)) return;
        if (dest.kind === 'country' || isHomeDestination(dest)) return;
        if (seen.has(dest.id)) return;
        seen.add(dest.id);
        byId.set(dest.id, dest);
        ordered.push(dest);
    };

    const pushId = (id: string | null | undefined) => {
        if (!id || seen.has(id)) return;
        pushDest(byId.get(id));
    };

    for (const day of sorted) {
        const items = [...(day.items ?? [])].sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
        let userPlace = false;
        for (const item of items) {
            if (item.id.startsWith(FLIGHT_ITEM_PREFIX)) continue;
            if (item.destinationId) userPlace = true;
            pushId(item.destinationId);
        }
        const dayPlace = resolvePlaceById(day.destinationId, destinations, fallbackStops);
        if (dayPlace) {
            pushDest(dayPlace);
            userPlace = true;
        }
        if (!userPlace) {
            let pushedFlight = false;
            for (const item of items) {
                if (!item.id.startsWith(FLIGHT_ITEM_PREFIX)) continue;
                if (!(item.title ?? '').trim().toLowerCase().startsWith('chegada')) continue;
                const before = ordered.length;
                pushDest(resolveFlightArrivalDestination(item, destinations, fallbackStops));
                if (ordered.length > before) pushedFlight = true;
            }
            if (!pushedFlight) {
                for (const item of items) {
                    if (!item.id.startsWith(FLIGHT_ITEM_PREFIX)) continue;
                    const title = item.title ?? '';
                    if (!title.includes('→')) continue;
                    const destPart = title.split('→').pop()?.trim().split(/·/)[0]?.trim();
                    if (!destPart) continue;
                    const id = destinationIdForFlightPlace(destPart, destinations, item.destinationId);
                    if (id) {
                        pushId(id);
                        continue;
                    }
                    pushDest(ephemeralFlightDestination(destPart, [...destinations, ...fallbackStops]));
                }
            }
        }
    }

    return trimItineraryRouteStops(ordered);
}

/** Pins do mapa: só cidades/locais ligados a dias ou atividades do roteiro (sem país da ficha). */
export function itineraryMapPins(
    itinerary: TripItineraryDay[],
    destinations: TripDestination[],
    catalogStops: TripDestination[] = []
): TripDestination[] {
    const ordered = orderedTimelineDestinations(itinerary, destinations, catalogStops);
    return ordered.filter((d) => d.kind !== 'country' && d.kind !== 'continent');
}

/** Paradas do mapa: ordem da viagem + cidades marcadas no roteiro (sem sumir com Espanha etc.). */
export function mergeTimelineWithRouteStops(
    itinerary: TripItineraryDay[],
    destinations: TripDestination[],
    routeStopsList: TripDestination[]
): TripDestination[] {
    const timeline = orderedTimelineDestinations(itinerary, destinations, routeStopsList);
    const base = routeStopsList.length ? routeStopsList : orderedStops(destinations);
    if (!timeline.length) return base;
    const out = [...base];
    const inChain = new Set(base.map((d) => d.id));
    for (const t of timeline) {
        if (inChain.has(t.id)) continue;
        const cc = foldedCountryKey(t.country ?? t.name ?? '');
        let insertAt = out.length;
        for (let i = out.length - 1; i >= 0; i--) {
            const bc = foldedCountryKey(out[i]!.country ?? out[i]!.name ?? '');
            if (cc && bc && cc === bc) {
                insertAt = i + 1;
                break;
            }
        }
        out.splice(insertAt, 0, t);
        inChain.add(t.id);
    }
    return trimItineraryRouteStops(out);
}

/** Evita país genérico duplicado; mantém aeroporto de chegada + cidade seguinte. */
function trimItineraryRouteStops(stops: TripDestination[]): TripDestination[] {
    const out: TripDestination[] = [];
    const seenCountryAirport = new Set<string>();
    for (const d of stops) {
        if (d.kind === 'country') continue;
        const cc = foldedCountryKey(d.country ?? '');
        if (d.kind === 'airport') {
            if (seenCountryAirport.has(cc)) continue;
            seenCountryAirport.add(cc);
        }
        out.push(d);
    }
    return out;
}

export function periodPinLabel(dest: TripDestination): string {
    const a = dest.arrivedOn?.trim();
    const b = dest.departedOn?.trim();
    if (a && b) {
        const nights = nightsBetween(a, b);
        const inL = formatDayLabel(a)?.short;
        const outL = formatDayLabel(b)?.short;
        if (inL && outL) {
            return nights != null ? `${inL} → ${outL} · ${nights}d` : `${inL} → ${outL}`;
        }
    }
    if (a) return `desde ${formatDayLabel(a)?.short ?? a}`;
    if (b) return `até ${formatDayLabel(b)?.short ?? b}`;
    return 'Datas em aberto';
}