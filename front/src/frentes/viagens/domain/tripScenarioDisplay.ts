import { countryStayWindow as stayWindowFromMotor, parseHopInstant as parseHopInstantMotor } from '@motor/viagens/country-schedule.js';
import { formatDuration } from '@motor/viagens/trip-scenario-engine.js';
import { dayKey as lifeOsDayKey } from '@motor/viagens/calendar-format.js';
import {
    countryNameFromPlace,
    hopCountry,
    hopDayKey,
    hopOriginCountry,
    sortHopsChronologically,
    type TripTimeHop
} from './tripTimeScenario';
import type { TripDestination } from '../types';
import type { ScenarioSnapshot } from './tripScenarioCriteria';

export function regionForCountry(country: string): string {
    const c = country.trim();
    if (/china|japão|japan|tailândia|thailand|índia|india|coreia|korea|vietnam|vietnã/i.test(c)) return 'Ásia';
    if (/portugal|holanda|netherlands|países baixos|espanha|spain|frança|france|itália|italy|alemanha|germany|reino unido|uk|inglaterra/i.test(c))
        return 'Europa';
    if (/brasil|brazil|estados unidos|united states|usa|méxico|mexico|canadá|canada|argentina|chile/i.test(c)) return 'Américas';
    return c || 'Destino';
}

export type CountryRow = {
    id: string;
    country: string;
    continent: string;
    days: number;
    hours: number;
    isLayoverOnly?: boolean;
    city?: string;
    cities?: string[];
};

/** Texto compacto no pin da rota (dias/horas reais, sem rótulo genérico «escala»). */
export function countryStayPinLabel(row: CountryRow): string {
    const hours = Math.max(0, row.hours ?? 0);
    const days = Math.max(0, row.days ?? 0);
    if (hours <= 0 && days <= 0) return '—';
    if (row.isLayoverOnly) {
        return formatDuration(hours);
    }
    if (days > 0) return `${days} d`;
    return formatDuration(hours);
}

export function cityForCountry(hops: TripTimeHop[], country: string): string {
    const match = hops.find((h) => {
        const c = hopCountry(h) || countryNameFromPlace(h.destinationCity ?? '');
        return c === country;
    });
    const city = match?.destinationCity?.trim();
    if (!city) return '';
    return city.replace(/\s*\([A-Z]{3}\)\s*$/i, '').trim();
}

function parseHopInstant(raw?: string | null): Date | null {
    return parseHopInstantMotor(raw);
}

function isPlausibleDeparture(dep: Date, hop: TripTimeHop, arrive: Date | null): boolean {
    const hopArrive = parseHopInstant(hop.arrivesAt ?? hop.arrives_at);
    if (hopArrive && dep.getTime() > hopArrive.getTime()) return false;
    if (arrive && dep.getTime() < arrive.getTime()) return false;
    return true;
}

/** Próxima saída do país: a partida mais cedo após a chegada, na ordem dos trechos. */
function leaveInstantForCountry(hops: TripTimeHop[], arriveIndex: number, country: string): Date | null {
    const arriveHop = hops[arriveIndex];
    const arrive = parseHopInstant(arriveHop?.arrivesAt ?? arriveHop?.arrives_at);
    const destHere = hopCountry(arriveHop);

    let best: Date | null = null;
    const consider = (dep: Date | null, hop: TripTimeHop) => {
        if (!dep || !arrive || !isPlausibleDeparture(dep, hop, arrive)) return;
        if (dep.getTime() < arrive.getTime()) return;
        if (!best || dep.getTime() < best.getTime()) best = dep;
    };

    for (let j = arriveIndex + 1; j < hops.length; j++) {
        const hop = hops[j];
        const dep = parseHopInstant(hop.departsAt ?? hop.departs_at);
        if (hopOriginCountry(hop) === country) {
            consider(dep, hop);
            continue;
        }
        if (destHere && hopOriginCountry(hop) === destHere && hopCountry(hop) !== destHere) {
            consider(dep, hop);
            continue;
        }
        if (hopCountry(hop) === 'Brasil' && hopOriginCountry(hop) === country) {
            consider(dep, hop);
        }
    }

    return best;
}

export function countryStayWindow(arrive: Date | null, leave: Date | null) {
    return stayWindowFromMotor(arrive, leave);
}

function countryStay(arrive: Date | null, leave: Date | null) {
    return countryStayWindow(arrive, leave);
}

function displayCity(rawName?: string | null): string {
    const city = rawName?.trim() ?? '';
    if (!city) return '';
    return city.replace(/\s*\([A-Z]{3}\)\s*$/i, '').trim();
}

export function countryScheduleFromDestinations(destinations: TripDestination[]): CountryRow[] {
    const stops = destinations.filter((d) => d.name?.trim());
    if (!stops.length) return [];

    const rows: CountryRow[] = [];
    for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        const country = (stop.country?.trim() || countryNameFromPlace(stop.name)).trim();
        if (!country || country === 'Brasil') continue;

        const arrive = parseHopInstant(stop.arrivedOn);
        if (!arrive) continue;

        const leave = parseHopInstant(stop.departedOn);
        if (!leave) continue;

        const stay = countryStay(arrive, leave);
        const city = displayCity(stop.name);
        const existing = rows.find((r) => r.country === country);
        if (existing) {
            existing.days += stay.days;
            existing.hours += stay.hours;
            existing.isLayoverOnly = existing.isLayoverOnly && stay.isLayoverOnly;
            if (city && !existing.cities?.includes(city)) {
                existing.cities = [...(existing.cities ?? []), city];
                existing.city = existing.city ?? city;
            }
        } else {
            rows.push({
                id: country,
                country,
                continent: regionForCountry(country),
                days: stay.days,
                hours: stay.hours,
                isLayoverOnly: stay.isLayoverOnly,
                city,
                cities: city ? [city] : []
            });
        }
    }
    return rows;
}

function mergeCountrySchedules(fromHops: CountryRow[], fromDest: CountryRow[]): CountryRow[] {
    if (!fromDest.length) return fromHops;
    if (!fromHops.length) return fromDest;

    const map = new Map<string, CountryRow>();
    for (const row of fromHops) map.set(row.country, { ...row });

    for (const destRow of fromDest) {
        const hopRow = map.get(destRow.country);
        if (!hopRow) {
            map.set(destRow.country, destRow);
            continue;
        }
        const hopLooksUnset =
            hopRow.days <= 1 && hopRow.isLayoverOnly && (hopRow.hours <= 36 || hopRow.hours === 24);
        if (hopLooksUnset && destRow.days > 0) {
            map.set(destRow.country, {
                ...destRow,
                city: destRow.city || hopRow.city,
                cities: destRow.cities?.length ? destRow.cities : hopRow.cities
            });
            continue;
        }
        map.set(destRow.country, {
            ...hopRow,
            city: hopRow.city || destRow.city,
            cities: hopRow.cities?.length ? hopRow.cities : destRow.cities
        });
    }

    return [...map.values()];
}

/** Destinos na ficha sem data de saída impedem contagem confiável por país (só hops/voos). */
export function destinationsNeedDepartureDates(destinations: TripDestination[]): boolean {
    return destinations.some((d) => Boolean(d.name?.trim() && d.arrivedOn?.trim() && !d.departedOn?.trim()));
}

function sanitizeHopTimestamps(hops: TripTimeHop[]): TripTimeHop[] {
    return hops.map((hop) => {
        const dep = parseHopInstant(hop.departsAt ?? hop.departs_at);
        const arr = parseHopInstant(hop.arrivesAt ?? hop.arrives_at);
        if (dep && arr && dep.getTime() > arr.getTime()) {
            return { ...hop, departsAt: null, departs_at: null };
        }
        return hop;
    });
}

export function countryScheduleFromHops(hops: TripTimeHop[]): CountryRow[] {
    const chain = sortHopsChronologically(sanitizeHopTimestamps(hops));
    if (chain.length === 0) return [];
    const rows: CountryRow[] = [];
    for (let i = 0; i < chain.length; i++) {
        const hop = chain[i];
        const country = hopCountry(hop) || countryNameFromPlace(hop.destinationCity ?? '');
        if (!country || country === 'Brasil') continue;
        const arrive = parseHopInstant(hop.arrivesAt ?? hop.arrives_at);
        const leave = leaveInstantForCountry(chain, i, country);
        const stay = countryStay(arrive, leave);
        const existing = rows.find((r) => r.country === country);
        if (existing) {
            existing.days += stay.days;
            existing.hours += stay.hours;
            existing.isLayoverOnly = existing.isLayoverOnly && stay.isLayoverOnly;
        } else {
            rows.push({
                id: country,
                country,
                continent: regionForCountry(country),
                days: stay.days,
                hours: stay.hours,
                isLayoverOnly: stay.isLayoverOnly
            });
        }
    }
    return rows;
}
export type CountryDateWindow = {
    country: string;
    city?: string;
    arrivedOn: string;
    departedOn: string;
    days: number;
    isLayoverOnly?: boolean;
};

function addDaysToDayKey(dayKey: string, delta: number): string {
    const d = new Date(`${dayKey}T12:00:00`);
    if (Number.isNaN(d.getTime())) return dayKey;
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Janelas civis por país a partir dos hops (chegada + dias do resumo). */
export function countryStayDateWindows(hops: TripTimeHop[]): CountryDateWindow[] {
    const chain = sortHopsChronologically(sanitizeHopTimestamps(hops));
    if (!chain.length) return [];
    const byCountry = new Map<string, CountryDateWindow>();
    for (let i = 0; i < chain.length; i++) {
        const hop = chain[i];
        const country = hopCountry(hop) || countryNameFromPlace(hop.destinationCity ?? '');
        if (!country || country === 'Brasil') continue;
        const arrive = parseHopInstant(hop.arrivesAt ?? hop.arrives_at);
        const leave = leaveInstantForCountry(chain, i, country);
        const stay = countryStay(arrive, leave);
        if (stay.days <= 0) continue;
        const arrivedOn =
            hopDayKey(hop.arrivesAt ?? hop.arrives_at) ||
            (arrive ? lifeOsDayKey(arrive) : null);
        if (!arrivedOn) continue;
        // 1d Madri → arrivedOn === departedOn; não usa a data do próximo hop.
        const departedOn = addDaysToDayKey(arrivedOn, Math.max(0, stay.days - 1));
        const city = displayCity(hop.destinationCity);
        const existing = byCountry.get(country);
        if (existing) {
            if (arrivedOn < existing.arrivedOn) existing.arrivedOn = arrivedOn;
            if (departedOn > existing.departedOn) existing.departedOn = departedOn;
            existing.days += stay.days;
            existing.isLayoverOnly = Boolean(existing.isLayoverOnly && stay.isLayoverOnly);
            if (city && !existing.city) existing.city = city;
        } else {
            byCountry.set(country, {
                country,
                city: city || undefined,
                arrivedOn,
                departedOn,
                days: stay.days,
                isLayoverOnly: stay.isLayoverOnly
            });
        }
    }
    return [...byCountry.values()];
}


export function enrichCountrySchedule(
    snap: ScenarioSnapshot,
    hops: TripTimeHop[],
    destinations: TripDestination[] = []
): CountryRow[] {
    const fromHops = countryScheduleFromHops(hops).map((row) => {
        const city = row.city ?? cityForCountry(hops, row.country);
        return {
            ...row,
            city,
            cities: row.cities?.length ? row.cities : city ? [city] : []
        };
    });
    const fromDest = countryScheduleFromDestinations(destinations);
    const merged = mergeCountrySchedules(fromHops, fromDest);
    if (merged.length) return merged;

    const existing = snap.countrySchedule ?? [];
    if (existing.length) {
        return existing.map((row, i) => {
            const country = row.country ?? '—';
            const cities = row.cities ?? [];
            return {
                id: row.id ?? `cs-${i}`,
                country,
                continent: row.continent?.trim() || regionForCountry(country),
                days: row.days ?? 0,
                hours: row.hours ?? 0,
                isLayoverOnly: row.isLayoverOnly,
                cities,
                city: cities[0] ?? cityForCountry(hops, country)
            };
        });
    }

    const counts = new Map<string, CountryRow>();
    for (const hop of hops) {
        const country = hopCountry(hop) || countryNameFromPlace(hop.destinationCity ?? '');
        if (!country) continue;
        if (!counts.has(country)) {
            const city = cityForCountry(hops, country);
            counts.set(country, {
                id: country,
                country,
                continent: regionForCountry(country),
                days: 1,
                hours: 24,
                city,
                cities: city ? [city] : []
            });
        }
    }
    return [...counts.values()];
}

export function uniqueContinents(rows: CountryRow[]): string[] {
    const seen: string[] = [];
    for (const row of rows) {
        if (!row.continent || seen.includes(row.continent)) continue;
        seen.push(row.continent);
    }
    return seen;
}

export function continentHours(snap: ScenarioSnapshot, continent: string, rows: CountryRow[]): number | null {
    const hit = (snap.continents ?? []).find((c) => c.name === continent);
    if (hit?.hours) return hit.hours;
    const sum = rows
        .filter((r) => {
            const c = r.continent?.trim() || regionForCountry(r.country ?? '');
            return c === continent;
        })
        .reduce((n, r) => n + (r.hours ?? 0), 0);
    return sum > 0 ? sum : null;
}