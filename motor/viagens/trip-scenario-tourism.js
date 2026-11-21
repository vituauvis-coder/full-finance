/**
 * Turismo no cenário — férias, fins de semana no destino, feriados BR (fuso trabalho).
 */

import { addDays, dayKey, parseDayKey, startOfDayInLifeOS } from './calendar-format.js';
import { officialWorkHolidayKeys } from './trip-work-holiday-calendar.js';
import {
    hopInstantsFromScenario,
    normalizeRemotePolicy,
    staysFromInstants,
    expandedTripStart,
    expandedTripEnd
} from './trip-scenario-remote.js';

const COUNTRY_TIME_ZONES = {
    brasil: 'America/Sao_Paulo',
    brazil: 'America/Sao_Paulo',
    china: 'Asia/Shanghai',
    espanha: 'Europe/Madrid',
    spain: 'Europe/Madrid',
    portugal: 'Europe/Lisbon',
    frança: 'Europe/Paris',
    france: 'Europe/Paris',
    itália: 'Europe/Rome',
    italy: 'Europe/Rome',
    alemanha: 'Europe/Berlin',
    germany: 'Europe/Berlin',
    japão: 'Asia/Tokyo',
    japan: 'Asia/Tokyo',
    'estados unidos': 'America/New_York',
    'united states': 'America/New_York'
};

const WEEKDAY_NAME_TO_SWIFT = {
    Sunday: 1,
    Monday: 2,
    Tuesday: 3,
    Wednesday: 4,
    Thursday: 5,
    Friday: 6,
    Saturday: 7
};

function swiftWeekday(date, timeZone) {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(date);
    return WEEKDAY_NAME_TO_SWIFT[name] ?? 1;
}

export function dayKeyInTimeZone(workKey, timeZone) {
    const base = startOfDayInLifeOS(parseDayKey(workKey) ?? workKey);
    const noonBr = new Date(base.getTime() + 12 * 3600000);
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(noonBr);
    return parts;
}

function guessTimeZone(country) {
    const key = String(country ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
    return COUNTRY_TIME_ZONES[key] ?? 'America/Sao_Paulo';
}

function destinationContext(stays, instants, cursor) {
    const next = addDays(startOfDayInLifeOS(cursor), 1);
    const stay = stays.find(
        (s) =>
            !s.isLayover &&
            startOfDayInLifeOS(cursor).getTime() < s.depart.getTime() &&
            s.arrive.getTime() < next.getTime()
    );
    if (stay?.country) {
        const hop = instants.find((i) => i.destinationCountry === stay.country);
        const tz =
            hop?.hop?.destinationTimeZone ??
            hop?.hop?.destination_time_zone ??
            guessTimeZone(stay.country);
        return { country: stay.country, timeZone: tz };
    }
    for (const instant of instants) {
        if (instant.depart < next && instant.arrive >= cursor) {
            const tz =
                instant.hop?.destinationTimeZone ??
                instant.hop?.destination_time_zone ??
                guessTimeZone(instant.destinationCountry);
            return { country: instant.destinationCountry, timeZone: tz };
        }
    }
    return { country: '', timeZone: 'America/Sao_Paulo' };
}

function inStayOrTrip(stays, cursor, instants) {
    const next = addDays(startOfDayInLifeOS(cursor), 1);
    const inStay = stays.some(
        (s) =>
            !s.isLayover &&
            startOfDayInLifeOS(cursor).getTime() < s.depart.getTime() &&
            next.getTime() > s.arrive.getTime()
    );
    if (inStay) return true;
    return instants.some((i) => i.depart < next && i.arrive >= cursor);
}

function vacationKeysFromScenario(scenario) {
    const keys = new Set();
    for (const period of scenario.vacations ?? []) {
        const start = parseDayKey(period.startsOn ?? period.starts_on);
        if (!start) continue;
        const days = Math.max(1, Number(period.days ?? 18));
        for (let i = 0; i < days; i++) keys.add(dayKey(addDays(start, i)));
    }
    return keys;
}

export function buildTourismMetrics(scenario, hopDepart, hopArrive) {
    const empty = {
        fullDays: 0,
        partialDays: 0,
        hours: 0,
        layoverHours: 0,
        tourismDayKeys: [],
        brHolidayKeys: [],
        holidayLocalByKey: {}
    };
    if (!hopDepart || !hopArrive || hopArrive <= hopDepart) return empty;

    const remote = normalizeRemotePolicy(scenario.remote);
    const workWeekdays = new Set(remote.weekdays);
    const vacations = vacationKeysFromScenario(scenario);
    const instants = hopInstantsFromScenario(scenario.hops);
    const tripStart = expandedTripStart(hopDepart, scenario.vacations ?? []);
    const tripEnd = expandedTripEnd(hopArrive, scenario.vacations ?? []);
    const stays = staysFromInstants(instants, tripEnd);

    const official = officialWorkHolidayKeys(tripStart, tripEnd, remote.workTimeZone);
    const manual = new Set((remote.holidays ?? []).map(String));
    const brHolidays = new Set([...official, ...manual]);

    const tourismKeys = new Set();
    const holidayLocalByKey = {};

    let cursor = startOfDayInLifeOS(tripStart);
    const last = startOfDayInLifeOS(tripEnd);
    while (cursor.getTime() <= last.getTime()) {
        const key = dayKey(cursor);
        if (!inStayOrTrip(stays, cursor, instants)) {
            cursor = addDays(cursor, 1);
            continue;
        }

        if (vacations.has(key)) {
            tourismKeys.add(key);
            cursor = addDays(cursor, 1);
            continue;
        }

        const dest = destinationContext(stays, instants, cursor);
        const localKey = dayKeyInTimeZone(key, dest.timeZone);
        const localWd = swiftWeekday(parseDayKey(localKey) ?? cursor, dest.timeZone);

        if (brHolidays.has(key)) {
            tourismKeys.add(key);
            if (localKey !== key) {
                holidayLocalByKey[key] = {
                    localKey,
                    timeZone: dest.timeZone,
                    country: dest.country
                };
            }
            cursor = addDays(cursor, 1);
            continue;
        }

        const isWeekendDest = localWd === 1 || localWd === 7;
        if (isWeekendDest) {
            tourismKeys.add(key);
        } else if (!workWeekdays.has(swiftWeekday(cursor, remote.workTimeZone))) {
            tourismKeys.add(key);
        }

        cursor = addDays(cursor, 1);
    }

    const fullDays = tourismKeys.size;
    return {
        fullDays,
        partialDays: 0,
        hours: fullDays * 10,
        layoverHours: 0,
        tourismDayKeys: [...tourismKeys].sort(),
        brHolidayKeys: [...brHolidays].sort(),
        holidayLocalByKey
    };
}